import connectDB from '@/lib/db'
import User from '@/models/User'
import { getVeritusApiKey } from '@/lib/veritus-auth'
import { createJob, getJobStatus } from '@/lib/veritus-api'
import { sendDailyPaperEmail } from '@/lib/utils/email-service'
import { VeritusPaper } from '@/types/veritus'

/**
 * Check if email was already sent today for a user
 * Compares dates in IST timezone (4:30 AM IST = 11:00 PM previous day UTC)
 */
function wasEmailSentToday(user: any): boolean {
  if (!user.lastEmailSentDate) {
    return false
  }

  const now = new Date()
  const lastSent = new Date(user.lastEmailSentDate)

  // Convert to IST (UTC+5:30) for comparison
  // 4:30 AM IST = 11:00 PM previous day UTC
  const istOffset = 5.5 * 60 * 60 * 1000 // 5.5 hours in milliseconds
  const nowIST = new Date(now.getTime() + istOffset)
  const lastSentIST = new Date(lastSent.getTime() + istOffset)

  // Compare dates (YYYY-MM-DD) in IST
  const todayIST = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate())
  const lastSentDateIST = new Date(lastSentIST.getFullYear(), lastSentIST.getMonth(), lastSentIST.getDate())

  return todayIST.getTime() === lastSentDateIST.getTime()
}

/**
 * Select one bookmark from user's bookmarks
 * For now, selects the first bookmark with keywords
 */
function selectBookmark(bookmarks: any[]): any | null {
  if (!bookmarks || bookmarks.length === 0) {
    return null
  }

  // Find first bookmark with keywords
  for (const bookmark of bookmarks) {
    if (bookmark.keywords && Array.isArray(bookmark.keywords) && bookmark.keywords.length > 0) {
      return bookmark
    }
  }

  return null
}

/**
 * Get top 5 keywords from bookmark
 * Returns first 5 keywords from the array
 */
function getTopKeywords(bookmark: any): string[] {
  if (!bookmark.keywords || !Array.isArray(bookmark.keywords)) {
    return []
  }

  return bookmark.keywords.slice(0, 5)
}

/**
 * Call combined search API with keywords
 * Uses the search-papers API endpoint internally
 */
async function performCombinedSearch(
  keywords: string[],
  apiKey: string
): Promise<VeritusPaper | null> {
  if (keywords.length === 0) {
    return null
  }

  try {
    // Pad keywords to meet API requirements (need at least 3 phrases for combinedSearch)
    let phrases = [...keywords]
    
    // If less than 3, pad with duplicates or generic terms
    while (phrases.length < 3) {
      if (phrases.length > 0) {
        phrases.push(phrases[0]) // Duplicate first keyword
      } else {
        phrases.push('research') // Fallback
      }
    }

    // Limit to 2 phrases as per API requirement (but we need 3 for combinedSearch)
    // Actually, let's use the first 2 keywords and create a query from the rest
    const searchPhrases = phrases.slice(0, 2)
    const queryText = phrases.slice(2, 5).join(' ') || phrases[0] || 'research paper'

    // Ensure query is at least 50 characters (API requirement)
    let query = queryText
    if (query.length < 50) {
      // Pad with generic research terms
      query = `${query} research paper academic study scientific investigation`
    }
    if (query.length > 5000) {
      query = query.substring(0, 5000)
    }

    // Create combined search job
    const jobResponse = await createJob(
      {
        jobType: 'combinedSearch',
        limit: 100, // Get up to 100 results to find best match
      },
      {
        phrases: searchPhrases,
        query: query,
      },
      { apiKey }
    )

    const jobId = jobResponse.jobId
    if (!jobId) {
      console.error('No job ID returned for combined search')
      return null
    }

    // Poll for job completion
    let attempts = 0
    const maxAttempts = 30 // 30 attempts * 2s = 60s timeout
    const pollInterval = 2000 // 2 seconds

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
      
      const jobStatus = await getJobStatus(jobId, { apiKey })
      
      if (jobStatus.status === 'success' && jobStatus.results && jobStatus.results.length > 0) {
        // Find the first paper with a valid TL;DR
        const papers = jobStatus.results
        const paperWithTLDR = papers.find((paper: VeritusPaper) => 
          paper.tldr && paper.tldr.trim().length > 0
        )

        // If no paper with TLDR, return the first paper
        return paperWithTLDR || papers[0] || null
      } else if (jobStatus.status === 'error') {
        console.error(`Job ${jobId} failed for combined search`)
        return null
      }

      attempts++
    }

    console.warn(`Job ${jobId} timed out for combined search`)
    return null
  } catch (error) {
    console.error('Error performing combined search:', error)
    return null
  }
}

/**
 * Process a single user and send daily email notification
 * - Selects one bookmark
 * - Gets top 5 keywords
 * - Calls combined search
 * - Sends email with TL;DR
 * - Updates lastEmailSentDate
 */
async function processUserDailyNotification(user: any): Promise<void> {
  // Check eligibility
  if (!user.emailNotificationsEnabled) {
    return
  }

  if (!user.bookmarks || user.bookmarks.length === 0) {
    return
  }

  // Check if email already sent today
  if (wasEmailSentToday(user)) {
    console.log(`Email already sent today for user ${user.email}, skipping`)
    return
  }

  try {
    // Select one bookmark
    const selectedBookmark = selectBookmark(user.bookmarks)
    if (!selectedBookmark) {
      console.log(`No bookmark with keywords found for user ${user.email}`)
      return
    }

    // Get top 5 keywords
    const keywords = getTopKeywords(selectedBookmark)
    if (keywords.length === 0) {
      console.log(`No keywords found in bookmark for user ${user.email}`)
      return
    }

    console.log(`Processing user ${user.email} with bookmark: ${selectedBookmark.title}, keywords: ${keywords.join(', ')}`)

    // Get API key
    const apiKey = await getVeritusApiKey()

    // Perform combined search
    const recommendedPaper = await performCombinedSearch(keywords, apiKey)
    
    if (!recommendedPaper || !recommendedPaper.tldr) {
      console.log(`No paper with TLDR found for user ${user.email}`)
      return
    }

    // Send email
    await sendDailyPaperEmail(
      user.email,
      user.name,
      {
        bookmarkTitle: selectedBookmark.title,
        paperTitle: recommendedPaper.title || 'Untitled',
        tldr: recommendedPaper.tldr,
        paperId: recommendedPaper.id ? String(recommendedPaper.id) : undefined,
        pdfLink: recommendedPaper.pdfLink ? String(recommendedPaper.pdfLink) : undefined,
      }
    )

    // Update lastEmailSentDate
    user.lastEmailSentDate = new Date()
    await user.save()

    // Also update emailNotificationHistory for tracking
    if (!user.emailNotificationHistory) {
      user.emailNotificationHistory = []
    }
    user.emailNotificationHistory.push({
      sentAt: new Date(),
      papersCount: 1,
    })
    await user.save()

    console.log(`Successfully sent daily email to ${user.email}`)
  } catch (error) {
    console.error(`Error processing daily notification for user ${user.email}:`, error)
    // Don't throw - continue with other users
  }
}

/**
 * Process all eligible users and send daily email notifications
 * This is called by the cron job at 4:30 AM IST
 */
export async function processAllDailyBookmarkNotifications(): Promise<void> {
  try {
    await connectDB()

    // Find all users with email notifications enabled and bookmarks
    const users = await User.find({
      emailNotificationsEnabled: true,
      bookmarks: { $exists: true, $ne: [] },
    })

    console.log(`Processing daily bookmark notifications for ${users.length} users`)

    // Process each user sequentially to avoid rate limiting
    for (const user of users) {
      await processUserDailyNotification(user)
      
      // Small delay between users to avoid overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    console.log('Daily bookmark notification processing completed')
  } catch (error) {
    console.error('Error processing daily bookmark notifications:', error)
    throw error
  }
}
