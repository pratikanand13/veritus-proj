import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import connectDB from '@/lib/db'
import User from '@/models/User'

/**
 * GET /api/user/email-notifications
 * Get email notification status and history
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const dbUser = await User.findById(user.userId)
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get last sent date and total count
    const history = (dbUser.emailNotificationHistory as any[]) || []
    const lastSent = history.length > 0 
      ? history[history.length - 1]?.sentAt 
      : null
    const totalSent = history.length

    return NextResponse.json({
      enabled: dbUser.emailNotificationsEnabled !== false,
      lastSent: lastSent ? new Date(lastSent).toISOString() : null,
      totalSent,
      history: history.slice(-10).map((h: any) => ({
        sentAt: new Date(h.sentAt).toISOString(),
        papersCount: h.papersCount || 0,
      })),
    })
  } catch (error: any) {
    console.error('Error fetching email notification status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch email notification status' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/user/email-notifications
 * Update email notification settings
 */
export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const body = await request.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled must be a boolean' },
        { status: 400 }
      )
    }

    const dbUser = await User.findById(user.userId)
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    dbUser.emailNotificationsEnabled = enabled
    await dbUser.save()

    return NextResponse.json({
      message: 'Email notification settings updated',
      enabled: dbUser.emailNotificationsEnabled,
    })
  } catch (error: any) {
    console.error('Error updating email notification settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update email notification settings' },
      { status: 500 }
    )
  }
}

