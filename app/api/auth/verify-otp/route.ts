import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import OTP from '@/models/OTP'
import User from '@/models/User'
import { signupSchema } from '@/lib/validators'
import { generateToken } from '@/lib/auth'
import { classifyAcademicEmail } from '@/lib/academic-domains'
import { z } from 'zod'

const verifyOTPSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  areaOfInterest: z.string().min(1, 'Area of interest is required'),
})

/**
 * POST /api/auth/verify-otp
 * Verify OTP and complete user signup
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validate input
    const validationResult = verifyOTPSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 }
      )
    }

    const { email, otp, password, name, areaOfInterest } = validationResult.data
    const normalizedEmail = email.toLowerCase().trim()

    // Connect to database
    await connectDB()

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail })
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Find valid OTP
    const otpRecord = await OTP.findOne({
      email: normalizedEmail,
      otp,
      verified: false,
      expiresAt: { $gt: new Date() }, // Not expired
    })

    if (!otpRecord) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP. Please request a new one.' },
        { status: 400 }
      )
    }

    // Mark OTP as verified
    otpRecord.verified = true
    await otpRecord.save()

    // Classify email (fuzzy academic/research scoring)
    const classification = classifyAcademicEmail(normalizedEmail)

    // Create user
    const user = new User({
      email: normalizedEmail,
      password,
      name,
      areaOfInterest,
      isAcademic: classification.isAcademic,
    })

    await user.save()

    // Generate token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      isAcademic: classification.isAcademic,
    })

    // Create response
    const response = NextResponse.json(
      {
        message: 'User created successfully',
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          areaOfInterest: user.areaOfInterest,
          isAcademic: user.isAcademic,
          academicScore: classification.score,
          matchedKeywords: classification.matchedKeywords,
        },
      },
      { status: 201 }
    )

    // Set cookie on response - 7 days
    const cookieMaxAge = 60 * 60 * 24 * 7 // 7 days in seconds
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: cookieMaxAge,
      path: '/',
    })
    
    console.log(`User ${normalizedEmail} signed up successfully with OTP verification`)

    return response
  } catch (error: any) {
    console.error('Verify OTP error:', error)
    
    // Provide more specific error messages
    if (error.name === 'ValidationError' && error.errors) {
      const errorValues = Object.values(error.errors) as Array<{ message?: string }>
      const firstError = errorValues[0]
      return NextResponse.json(
        { error: firstError?.message || 'Validation error' },
        { status: 400 }
      )
    }
    
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error. Please try again.' },
      { status: 500 }
    )
  }
}

