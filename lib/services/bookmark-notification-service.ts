import connectDB from '@/lib/db'
import User from '@/models/User'
import { getVeritusApiKey } from '@/lib/veritus-auth'
import { createJob, getJobStatus } from '@/lib/veritus-api'
import { sendPaperRecommendationsEmail } from '@/lib/utils/email-service'
import { VeritusPaper } from '@/types/veritus'

interface BookmarkRecommendation {
  bookmark: any
  highestScorePaper: VeritusPaper | null
}

/**
 * Search for similar papers based on bookmark keywords using job-based search
 * Returns the paper with the highest score
 */
async function searchSimilarPapersForBookmark(
  bookmark: any,
  apiKey: string
): Promise<VeritusPaper | null> {
  if (!bookmark.keywords || bookmark.keywords.length === 0) {
    return null
  }

  try {
    // Use keywords for job-based search (limit to 2 as per UI requirement)
    let keywords = bookmark.keywords.slice(0, 2)
    
    // Pad keywords to meet Veritus API requirement of at least 3 phrases
    // Use bookmark title and other metadata if available
    if (keywords.length < 3) {
      const paddedKeywords = [...keywords]
      
      // Add bookmark title if available and not already in keywords
      if (bookmark.title && !paddedKeywords.some(k => k.toLowerCase() === bookmark.title.toLowerCase())) {
        // Extract words from title (first few words)
        const titleWords = bookmark.title.split(/\s+/).slice(0, 2)
        for (const word of titleWords) {
          if (paddedKeywords.length >= 3) break
          if (word.length > 3 && !paddedKeywords.some(k => k.toLowerCase() === word.toLowerCase())) {
            paddedKeywords.push(word)
          }
        }
      }
      
      // If still less than 3, add generic terms
      while (paddedKeywords.length < 3 && paddedKeywords.length < bookmark.keywords.length) {
        const remainingKeywords = bookmark.keywords.slice(paddedKeywords.length)
        if (remainingKeywords.length > 0) {
          paddedKeywords.push(remainingKeywords[0])
        } else {
          break
        }
      }
      
      // If still less than 3, duplicate the first keyword (fallback)
      while (paddedKeywords.length < 3) {
        paddedKeywords.push(paddedKeywords[0] || 'research')
      }
      
      keywords = paddedKeywords.slice(0, 3)
    }
    
    // Create a keyword search job
    const jobResponse = await createJob(
      {
        jobType: 'keywordSearch',
        limit: 100, // Get up to 100 results to find highest score
      },
      {
        phrases: keywords,
      },
      { apiKey }
    )

    const jobId = jobResponse.jobId
    if (!jobId) {
      console.error('No job ID returned for bookmark search')
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
        // Find the paper with the highest score
        const papers = jobStatus.results
        const highestScorePaper = papers.reduce((highest: VeritusPaper | null, current: VeritusPaper) => {
          const currentScore = current.score || 0
          const highestScore = highest?.score || 0
          return currentScore > highestScore ? current : highest
        }, null as VeritusPaper | null)

        return highestScorePaper
      } else if (jobStatus.status === 'error') {
        console.error(`Job ${jobId} failed for bookmark ${bookmark.paperId}`)
        return null
      }

      attempts++
    }

    console.warn(`Job ${jobId} timed out for bookmark ${bookmark.paperId}`)
    return null
  } catch (error) {
    console.error('Error searching similar papers for bookmark:', error)
    return null
  }
}

/**
 * Process bookmarks for a single user and send email recommendations
 * For each bookmark, finds similar papers and gets the highest score paper's TLDR
 * If user has multiple bookmarks for the same paper, only processes once
 */
async function processUserBookmarks(user: any): Promise<void> {
  if (!user.emailNotificationsEnabled || !user.bookmarks || user.bookmarks.length === 0) {
    return
  }

  try {
    const apiKey = await getVeritusApiKey()
    
    // Group bookmarks by paperId to avoid processing duplicates
    const bookmarksByPaperId = new Map<string, any>()
    for (const bookmark of user.bookmarks) {
      if (!bookmarksByPaperId.has(bookmark.paperId)) {
        bookmarksByPaperId.set(bookmark.paperId, bookmark)
      }
    }

    // Process each unique bookmark (by paperId)
    const bookmarkRecommendations: BookmarkRecommendation[] = []
    
    for (const [paperId, bookmark] of bookmarksByPaperId.entries()) {
      if (!bookmark.keywords || bookmark.keywords.length === 0) {
        continue
      }

      // Search for similar papers and get the highest score paper
      const highestScorePaper = await searchSimilarPapersForBookmark(bookmark, apiKey)
      
      if (highestScorePaper) {
        bookmarkRecommendations.push({
          bookmark,
          highestScorePaper,
        })
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    // Collect TLDRs from highest score papers
    const emailRecommendations = bookmarkRecommendations
      .filter((rec) => rec.highestScorePaper && rec.highestScorePaper.tldr)
      .map((rec) => ({
        title: rec.highestScorePaper!.title || 'Untitled',
        tldr: rec.highestScorePaper!.tldr ?? undefined,
        pdfLink: rec.highestScorePaper!.pdfLink ?? undefined,
        // Include metadata about the original bookmark
        originalBookmarkTitle: rec.bookmark.title,
        score: rec.highestScorePaper!.score,
      }))

    // Send email if there are recommendations with TLDRs
    if (emailRecommendations.length > 0) {
      await sendPaperRecommendationsEmail(
        user.email,
        user.name,
        emailRecommendations.map((rec) => ({
          title: rec.title,
          tldr: rec.tldr,
          pdfLink: rec.pdfLink,
        }))
      )

      // Record email notification in user's history
      if (!user.emailNotificationHistory) {
        user.emailNotificationHistory = []
      }
      user.emailNotificationHistory.push({
        sentAt: new Date(),
        papersCount: emailRecommendations.length,
      })
      await user.save()
      
      console.log(`Sent email to ${user.email} with ${emailRecommendations.length} paper recommendations`)
    } else {
      console.log(`No recommendations with TLDRs found for ${user.email}`)
    }
  } catch (error) {
    console.error(`Error processing bookmarks for user ${user.email}:`, error)
  }
}

/**
 * Process all users with bookmarks and send email notifications
 * This is called by the cron job
 */
export async function processAllBookmarkNotifications(): Promise<void> {
  try {
    await connectDB()

    // Find all users with bookmarks and email notifications enabled
    const users = await User.find({
      emailNotificationsEnabled: true,
      bookmarks: { $exists: true, $ne: [] },
    })

    console.log(`Processing bookmark notifications for ${users.length} users`)

    // Process each user
    for (const user of users) {
      await processUserBookmarks(user)
    }

    console.log('Bookmark notification processing completed')
  } catch (error) {
    console.error('Error processing bookmark notifications:', error)
    throw error
  }
}

