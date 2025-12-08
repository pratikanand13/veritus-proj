import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getVeritusApiKey } from '@/lib/veritus-auth'
import { createJob, getJobStatus } from '@/lib/veritus-api'
import { sendDailyPaperEmail } from '@/lib/utils/email-service'
import { VeritusPaper } from '@/types/veritus'
import { z } from 'zod'

const instantRunSchema = z.object({
  paperId: z.string().min(1, 'Paper ID is required'),
})

/**
 * Get top 5 keywords from bookmark
 */
function getTopKeywords(keywords: string[]): string[] {
  if (!keywords || !Array.isArray(keywords)) {
    return []
  }
  return keywords.slice(0, 5)
}

/**
 * Perform combined search with keywords
 */
async function performCombinedSearch(
  keywords: string[],
  apiKey: string
): Promise<VeritusPaper | null> {
  if (keywords.length === 0) {
    return null
  }

  try {
    // Pad keywords to meet API requirements (Veritus API requires at least 3 phrases for combinedSearch)
    let phrases = [...keywords]
    
    // CRITICAL: Veritus API requires exactly 3 phrases for combinedSearch
    // If we have less than 3, pad with duplicates
    while (phrases.length < 3) {
      if (phrases.length > 0) {
        phrases.push(phrases[0]) // Duplicate first keyword
      } else {
        phrases.push('research') // Fallback
      }
    }

    // Ensure we have exactly 3 phrases (API requirement for combinedSearch)
    // Take first 3, or pad if we have less
    let searchPhrases: string[] = []
    if (phrases.length >= 3) {
      searchPhrases = phrases.slice(0, 3)
    } else {
      // We already padded phrases to 3, but double-check
      searchPhrases = [...phrases]
      while (searchPhrases.length < 3) {
        searchPhrases.push(searchPhrases[0] || 'research')
      }
    }
    
    // Final validation - must have exactly 3 phrases
    if (searchPhrases.length !== 3) {
      console.error('ERROR: searchPhrases must have exactly 3 elements, but has:', searchPhrases.length)
      console.error('searchPhrases:', searchPhrases)
      console.error('original keywords:', keywords)
      console.error('padded phrases:', phrases)
      // Force to exactly 3
      searchPhrases = searchPhrases.slice(0, 3)
      while (searchPhrases.length < 3) {
        searchPhrases.push('research')
      }
    }
    
    // Use remaining keywords or first keyword for query
    const queryText = phrases.slice(3, 5).join(' ') || phrases[0] || 'research paper'

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
    // CRITICAL: Must send exactly 3 phrases for combinedSearch
    const jobResponse = await createJob(
      {
        jobType: 'combinedSearch',
        limit: 100,
      },
      {
        phrases: searchPhrases, // Guaranteed to have exactly 3 elements
        query: query,
      },
      { apiKey }
    )

    const jobId = jobResponse.jobId
    if (!jobId) {
      return null
    }

    // Poll for job completion
    let attempts = 0
    const maxAttempts = 30
    const pollInterval = 2000

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
      
      const jobStatus = await getJobStatus(jobId, { apiKey })
      
      if (jobStatus.status === 'success' && jobStatus.results && jobStatus.results.length > 0) {
        // Find the first paper with a valid TL;DR
        const papers = jobStatus.results
        const paperWithTLDR = papers.find((paper: VeritusPaper) => 
          paper.tldr && paper.tldr.trim().length > 0
        )
        return paperWithTLDR || papers[0] || null
      } else if (jobStatus.status === 'error') {
        return null
      }

      attempts++
    }

    return null
  } catch (error) {
    console.error('Error performing combined search:', error)
    return null
  }
}

/**
 * POST /api/bookmarks/instant-run
 * Trigger instant search for a specific bookmark and send results via email
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validationResult = instantRunSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 }
      )
    }

    const { paperId } = validationResult.data

    await connectDB()

    // Fetch user with bookmarks
    const dbUser = await User.findById(user.userId)
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if email notifications are enabled
    if (!dbUser.emailNotificationsEnabled) {
      return NextResponse.json(
        { error: 'Email notifications are disabled. Please enable them first.' },
        { status: 400 }
      )
    }

    // Check if user has bookmarks
    if (!dbUser.bookmarks || dbUser.bookmarks.length === 0) {
      return NextResponse.json(
        { error: 'No bookmarks found' },
        { status: 400 }
      )
    }

    // Find the specific bookmark
    const bookmark = dbUser.bookmarks.find((b: any) => b.paperId === paperId)
    if (!bookmark) {
      return NextResponse.json(
        { error: 'Bookmark not found' },
        { status: 404 }
      )
    }

    // Check if bookmark has keywords
    if (!bookmark.keywords || bookmark.keywords.length === 0) {
      return NextResponse.json(
        { error: 'Bookmark does not have keywords. Cannot perform search.' },
        { status: 400 }
      )
    }

    // Get top 5 keywords
    const keywords = getTopKeywords(bookmark.keywords)
    if (keywords.length === 0) {
      return NextResponse.json(
        { error: 'No valid keywords found in bookmark' },
        { status: 400 }
      )
    }

    // Get API key
    const apiKey = await getVeritusApiKey()

    // Perform combined search
    const recommendedPaper = await performCombinedSearch(keywords, apiKey)
    
    if (!recommendedPaper || !recommendedPaper.tldr) {
      return NextResponse.json(
        { error: 'No paper with TLDR found. Please try again later.' },
        { status: 404 }
      )
    }

    // Send email (handle errors gracefully)
    let emailSent = false
    try {
      console.log(`\n=== Sending Instant Run Email ===`)
      console.log(`Recipient: ${dbUser.email}`)
      console.log(`Recipient Name: ${dbUser.name}`)
      console.log(`Bookmark: ${bookmark.title}`)
      console.log(`Paper: ${recommendedPaper.title || 'Untitled'}`)
      console.log(`==================================\n`)
      
      await sendDailyPaperEmail(
        dbUser.email,
        dbUser.name,
        {
          bookmarkTitle: bookmark.title,
          paperTitle: recommendedPaper.title || 'Untitled',
          tldr: recommendedPaper.tldr,
          paperId: recommendedPaper.id ? String(recommendedPaper.id) : undefined,
          pdfLink: recommendedPaper.pdfLink ? String(recommendedPaper.pdfLink) : undefined,
        }
      )
      emailSent = true
      console.log(`✅ Email sent successfully to: ${dbUser.email}`)
    } catch (emailError: any) {
      console.error('❌ Failed to send instant run email:', emailError)
      console.error(`Failed recipient: ${dbUser.email}`)
      // In development mode, sendDailyPaperEmail won't throw, but just in case
      // In production, we still want to return success if search worked
      if (process.env.NODE_ENV === 'production') {
        // Log but don't fail the request
        console.error('Email sending failed, but search was successful')
      }
    }

    // Update email notification history only if email was sent
    if (emailSent) {
      if (!dbUser.emailNotificationHistory) {
        dbUser.emailNotificationHistory = []
      }
      dbUser.emailNotificationHistory.push({
        sentAt: new Date(),
        papersCount: 1,
      })
      await dbUser.save()
    }

    return NextResponse.json({
      success: true,
      message: emailSent 
        ? 'Email sent successfully with paper recommendation'
        : 'Search completed successfully. Email could not be sent (check SMTP configuration).',
      emailSent,
      paper: {
        title: recommendedPaper.title,
        tldr: recommendedPaper.tldr,
      },
    })
  } catch (error: any) {
    console.error('Instant run error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error. Please try again.' },
      { status: 500 }
    )
  }
}
