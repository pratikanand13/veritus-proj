import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import OTP from '@/models/OTP'
import User from '@/models/User'
import { sendOTPEmail } from '@/lib/utils/email-service'
import { z } from 'zod'

const sendOTPSchema = z.object({
  email: z.string().email('Invalid email address'),
})

/**
 * Generate a 6-digit OTP
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * POST /api/auth/send-otp
 * Send OTP to user's email for signup verification
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validate input
    const validationResult = sendOTPSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 }
      )
    }

    const { email } = validationResult.data
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

    // Generate OTP
    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now

    // Invalidate any existing unverified OTPs for this email
    await OTP.updateMany(
      { email: normalizedEmail, verified: false },
      { verified: true } // Mark as verified (effectively invalidating them)
    )

    // Create new OTP record
    const otpRecord = new OTP({
      email: normalizedEmail,
      otp,
      expiresAt,
      verified: false,
    })

    await otpRecord.save()

    // Send OTP email
    try {
      await sendOTPEmail(normalizedEmail, otp)
    } catch (emailError: any) {
      console.error('Failed to send OTP email:', emailError)
      
      // In development mode, if SMTP is not configured, we still allow it
      // (OTP is logged to console)
      const isDevMode = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true'
      const isSmtpNotConfigured = emailError.message?.includes('SMTP credentials not configured')
      
      if (isDevMode && isSmtpNotConfigured) {
        // In dev mode without SMTP, OTP is logged to console, so we continue
        console.log('Continuing in development mode - OTP logged to console')
      } else {
        // Delete the OTP record if email fails in production
        await OTP.deleteOne({ _id: otpRecord._id })
        return NextResponse.json(
          { error: 'Failed to send verification email. Please try again.' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      {
        message: 'OTP sent successfully',
        expiresIn: 10, // minutes
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Send OTP error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error. Please try again.' },
      { status: 500 }
    )
  }
}

