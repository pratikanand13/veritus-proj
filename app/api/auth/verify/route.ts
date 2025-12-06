import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import connectDB from '@/lib/db'
import User from '@/models/User'

export async function GET() {
  try {
    const payload = await getCurrentUser()
    
    if (!payload) {
      console.log('Verify: No payload found - token may be missing or invalid')
      return NextResponse.json(
        { error: 'Unauthorized - Session expired or invalid. Please login again.' },
        { status: 401 }
      )
    }

    console.log('Verify: Token valid, userId:', payload.userId)

    await connectDB()
    const user = await User.findById(payload.userId).select('-password')
    
    if (!user) {
      console.log('Verify: User not found for userId:', payload.userId)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        areaOfInterest: user.areaOfInterest,
        isAcademic: user.isAcademic,
      },
    })
  } catch (error: any) {
    console.error('Verify error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

