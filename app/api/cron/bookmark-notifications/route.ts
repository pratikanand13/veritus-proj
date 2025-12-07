import { NextResponse } from 'next/server'
import { processAllDailyBookmarkNotifications } from '@/lib/services/bookmark-notification-service'

/**
 * POST /api/cron/bookmark-notifications
 * Cron job endpoint for daily bookmark notifications
 * Should be called at 4:30 AM IST daily
 * 
 * IST (Indian Standard Time) = UTC + 5:30
 * 4:30 AM IST = 11:00 PM UTC (previous day)
 * 
 * Cron expression for 4:30 AM IST: 0 0 * * * (runs at midnight UTC, adjust based on your scheduler)
 * 
 * For Vercel Cron Jobs (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/bookmark-notifications",
 *     "schedule": "0 23 * * *"  // 11:00 PM UTC = 4:30 AM IST next day
 *   }]
 * }
 * 
 * For external cron services:
 * - Set to run at 11:00 PM UTC (which is 4:30 AM IST)
 * - Or use timezone-aware schedulers that support IST
 * 
 * For local testing, you can call this endpoint manually
 */
export async function POST(request: Request) {
  try {
    // Authentication check
    // Vercel Cron Jobs automatically add 'x-vercel-signature' header
    // For manual/external calls, use CRON_SECRET Bearer token
    const vercelSignature = request.headers.get('x-vercel-signature')
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Allow if called by Vercel Cron (has signature) OR if no CRON_SECRET is set OR if Bearer token matches
    const isVercelCron = !!vercelSignature
    const hasValidToken = cronSecret && authHeader === `Bearer ${cronSecret}`
    const noAuthRequired = !cronSecret

    if (!isVercelCron && !hasValidToken && !noAuthRequired) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Log current time in IST for debugging
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000 // 5.5 hours in milliseconds
    const istTime = new Date(now.getTime() + istOffset)
    console.log(`Starting daily bookmark notification cron job at ${istTime.toISOString()} IST`)

    await processAllDailyBookmarkNotifications()

    return NextResponse.json({
      message: 'Daily bookmark notifications processed successfully',
      timestamp: new Date().toISOString(),
      istTime: istTime.toISOString(),
    })
  } catch (error: any) {
    console.error('Error in daily bookmark notification cron job:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to process daily bookmark notifications',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cron/bookmark-notifications
 * Manual trigger for testing
 */
export async function GET() {
  return NextResponse.json({
    message: 'Use POST to trigger bookmark notifications',
    endpoint: '/api/cron/bookmark-notifications',
    method: 'POST',
  })
}

