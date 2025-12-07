import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { loginSchema } from '@/lib/validators'
import { generateToken } from '@/lib/auth'

// Force dynamic rendering since this route uses cookies for authentication
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    await connectDB()

    const body = await request.json()
    
    // Validate input
    const validationResult = loginSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 }
      )
    }

    const { email, password } = validationResult.data

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Generate token - ensure academic users get 7 days
    // Since only academic users can sign up, isAcademic should always be true
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      isAcademic: user.isAcademic ?? true, // Default to true if not set (shouldn't happen for academic users)
    })

    // Create response
    const response = NextResponse.json(
      {
        message: 'Login successful',
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          areaOfInterest: user.areaOfInterest,
          isAcademic: user.isAcademic,
        },
      },
      { status: 200 }
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
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

