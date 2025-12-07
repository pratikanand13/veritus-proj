import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getVeritusApiKey } from '@/lib/veritus-auth'
import { createJob } from '@/lib/veritus-api'
import { isDebugMode } from '@/lib/config/mock-config'
import connectDB from '@/lib/db'
import Chat from '@/models/Chat'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobType: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { jobType } = await params

    if (!['keywordSearch', 'querySearch', 'combinedSearch'].includes(jobType)) {
      return NextResponse.json(
        { error: 'Invalid job type' },
        { status: 400 }
      )
    }

    // Check if DEBUG mode is enabled - return mock data
    if (isDebugMode()) {
      // Add 3 second delay for mock data
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Return mock job response
      return NextResponse.json({
        jobId: `mock-job-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        isMocked: true,
      })
    }

    const apiKey = await getVeritusApiKey()
    const { searchParams } = new URL(request.url)
    const body = await request.json()

    // Pad phrases array if needed (Veritus API requires minimum 3 phrases)
    // When user selects only 1-2 keywords, we pad with paper metadata from chatstore
    if ((jobType === 'keywordSearch' || jobType === 'combinedSearch') && body.phrases && Array.isArray(body.phrases)) {
      const originalPhrases = body.phrases
      if (originalPhrases.length > 0 && originalPhrases.length < 3) {
        const chatId = searchParams.get('chatId') || body.chatId
        let paddedPhrases = [...originalPhrases]
        
        if (chatId) {
          try {
            await connectDB()
            const chat = await Chat.findOne({ _id: chatId, userId: user.userId })
            if (chat?.chatMetadata?.paperData) {
              const paperData = chat.chatMetadata.paperData
              
              // Add paper title if not already in phrases
              if (paperData.title && !paddedPhrases.some(p => p.toLowerCase() === paperData.title.toLowerCase())) {
                paddedPhrases.push(paperData.title)
              }
              
              // Add fields of study if available
              if (paperData.fieldsOfStudy && Array.isArray(paperData.fieldsOfStudy)) {
                for (const field of paperData.fieldsOfStudy) {
                  if (paddedPhrases.length >= 3) break
                  if (field && !paddedPhrases.some(p => p.toLowerCase() === field.toLowerCase())) {
                    paddedPhrases.push(field)
                  }
                }
              }
              
              // Add publication type if available
              if (paperData.publicationType && paddedPhrases.length < 3) {
                if (!paddedPhrases.some(p => p.toLowerCase() === paperData.publicationType.toLowerCase())) {
                  paddedPhrases.push(paperData.publicationType)
                }
              }
            }
          } catch (error) {
            // If we can't get paper data, log but continue
            // We'll check if padding was successful below
          }
        }
        
        // If still less than 3 after padding attempt, return a helpful error
        if (paddedPhrases.length < 3) {
          return NextResponse.json(
            { 
              error: `Veritus API requires at least 3 phrases for ${jobType}. You provided ${originalPhrases.length} keyword(s). Please select more keywords or ensure chat has paper data for automatic padding.` 
            },
            { status: 400 }
          )
        }
        
        // Update body with padded phrases (now has at least 3)
        body.phrases = paddedPhrases
      }
    }

    const jobParams: any = {}
    if (searchParams.get('limit')) {
      const limit = parseInt(searchParams.get('limit')!)
      if ([100, 200, 300].includes(limit)) {
        jobParams.limit = limit as 100 | 200 | 300
      }
    }
    if (searchParams.get('fieldsOfStudy')) {
      jobParams.fieldsOfStudy = searchParams.get('fieldsOfStudy')!.split(',')
    }
    if (searchParams.get('minCitationCount')) {
      jobParams.minCitationCount = parseInt(searchParams.get('minCitationCount')!)
    }
    if (searchParams.get('openAccessPdf')) {
      jobParams.openAccessPdf = searchParams.get('openAccessPdf') === 'true'
    }
    if (searchParams.get('downloadable')) {
      jobParams.downloadable = searchParams.get('downloadable') === 'true'
    }
    if (searchParams.get('quartileRanking')) {
      jobParams.quartileRanking = searchParams.get('quartileRanking')!.split(',')
    }
    if (searchParams.get('publicationTypes')) {
      jobParams.publicationTypes = searchParams.get('publicationTypes')!.split(',')
    }
    if (searchParams.get('sort')) {
      jobParams.sort = searchParams.get('sort')!
    }
    if (searchParams.get('year')) {
      jobParams.year = searchParams.get('year')!
    }

    const result = await createJob(
      { jobType: jobType as any, ...jobParams },
      body,
      { apiKey }
    )

    return NextResponse.json(result)
  } catch (error: any) {
    // Extract error message properly to avoid "[object Object]"
    let errorMessage = 'Failed to create job'
    let statusCode = 500
    
    if (error instanceof Error) {
      errorMessage = error.message || errorMessage
    } else if (typeof error === 'string') {
      errorMessage = error
    } else if (error?.message) {
      errorMessage = String(error.message)
    } else if (error?.error) {
      errorMessage = typeof error.error === 'string' ? error.error : String(error.error)
    }
    
    // Determine status code
    if (errorMessage.includes('Unauthorized')) {
      statusCode = 401
    } else if (errorMessage.includes('Insufficient')) {
      statusCode = 403
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}

