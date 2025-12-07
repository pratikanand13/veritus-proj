import { NextResponse } from 'next/server'
import { processAllBookmarkNotifications } from '@/lib/services/bookmark-notification-service'

/**
 * POST /api/cron/bookmark-notifications
 * Cron job endpoint for daily bookmark notifications
 * Should be called at 7:55 AM daily
 * 
 * To set up cron job, use a service like:
 * - Vercel Cron Jobs (if deployed on Vercel)
 * - GitHub Actions scheduled workflows
 * - External cron service (cron-job.org, etc.)
 * 
 * For local testing, you can call this endpoint manually
 */
export async function POST(request: Request) {
  try {
    // Optional: Add authentication/authorization check
    // For example, check for a secret token in headers
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Starting bookmark notification cron job...')
    await processAllBookmarkNotifications()

    return NextResponse.json({
      message: 'Bookmark notifications processed successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error in bookmark notification cron job:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to process bookmark notifications',
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

