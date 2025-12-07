import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { signupSchema } from '@/lib/validators'
import { generateToken, setAuthCookie } from '@/lib/auth'
import { classifyAcademicEmail } from '@/lib/academic-domains'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validate input
    const validationResult = signupSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 }
      )
    }

    const { email, password, name, areaOfInterest } = validationResult.data

    // Connect to database
    try {
      await connectDB()
    } catch (dbError: any) {
      console.error('Database connection error:', dbError)
      return NextResponse.json(
        { error: 'Database connection failed. Please check your MongoDB connection.' },
        { status: 500 }
      )
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Classify email (fuzzy academic/research scoring). Do NOT block non-academic.
    const classification = classifyAcademicEmail(email)

    // Create user
    const user = new User({
      email: email.toLowerCase(),
      password,
      name,
      areaOfInterest,
      isAcademic: classification.isAcademic,
    })

    await user.save()

    // Generate token - keep 7-day session; caller can inspect isAcademic if needed
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

    // Set cookie on response - 7 days for academic users
    const cookieMaxAge = 60 * 60 * 24 * 7 // 7 days in seconds
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: cookieMaxAge,
      path: '/',
      // Don't set domain - let browser use default
    })
    
    console.log(`Cookie set with maxAge: ${cookieMaxAge} seconds (7 days), token length: ${token.length}`)

    return response
  } catch (error: any) {
    console.error('Signup error:', error)
    
    // Provide more specific error messages
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { error: Object.values(error.errors)[0]?.message || 'Validation error' },
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

