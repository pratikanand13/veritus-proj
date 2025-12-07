import connectDB from '@/lib/db'
import User from '@/models/User'
import { getVeritusApiKey } from '@/lib/veritus-auth'
import { searchPapers } from '@/lib/veritus-api'
import { sendPaperRecommendationsEmail } from '@/lib/utils/email-service'
import { VeritusPaper } from '@/types/veritus'

interface BookmarkRecommendation {
  bookmark: any
  recommendations: VeritusPaper[]
}

/**
 * Search for related papers based on bookmark keywords
 */
async function searchRelatedPapers(
  keywords: string[],
  apiKey: string
): Promise<VeritusPaper[]> {
  if (keywords.length === 0) {
    return []
  }

  try {
    // Use first few keywords for search (limit to avoid too long queries)
    const searchKeywords = keywords.slice(0, 5).join(' ')
    
    // Search papers using title search (can be enhanced with job-based search)
    const papers = await searchPapers(
      { title: searchKeywords },
      { apiKey }
    )

    // Return top 5 most relevant papers
    return papers.slice(0, 5)
  } catch (error) {
    console.error('Error searching related papers:', error)
    return []
  }
}

/**
 * Process bookmarks for a single user and send email recommendations
 */
async function processUserBookmarks(user: any): Promise<void> {
  if (!user.emailNotificationsEnabled || !user.bookmarks || user.bookmarks.length === 0) {
    return
  }

  try {
    const apiKey = await getVeritusApiKey()
    const allRecommendations: VeritusPaper[] = []
    const seenPaperIds = new Set<string>()

    // Process each bookmark
    for (const bookmark of user.bookmarks) {
      if (!bookmark.keywords || bookmark.keywords.length === 0) {
        continue
      }

      // Search for related papers
      const relatedPapers = await searchRelatedPapers(bookmark.keywords, apiKey)

      // Add unique papers to recommendations
      for (const paper of relatedPapers) {
        if (paper.id && !seenPaperIds.has(paper.id)) {
          // Check if paper is not already bookmarked
          const isBookmarked = user.bookmarks.some(
            (b: any) => b.paperId === paper.id
          )

          if (!isBookmarked) {
            allRecommendations.push(paper)
            seenPaperIds.add(paper.id)
          }
        }
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    // Send email if there are recommendations
    if (allRecommendations.length > 0) {
      await sendPaperRecommendationsEmail(
        user.email,
        user.name,
        allRecommendations.map((paper) => ({
          title: paper.title || 'Untitled',
          tldr: paper.tldr ?? undefined,
          pdfLink: paper.pdfLink ?? undefined,
        }))
      )

      // Record email notification in user's history
      if (!user.emailNotificationHistory) {
        user.emailNotificationHistory = []
      }
      user.emailNotificationHistory.push({
        sentAt: new Date(),
        papersCount: allRecommendations.length,
      })
      await user.save()
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

