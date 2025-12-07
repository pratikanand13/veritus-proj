import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getVeritusApiKey } from '@/lib/veritus-auth'
import { createJob, getJobStatus } from '@/lib/veritus-api'
import { normalizeMockFlag, isDebugMode } from '@/lib/config/mock-config'
import { getMockCorpusResponse } from '@/lib/mock-data/mock-data-manager'
import { updateChatMetadata, extractMetadataFromPapers, mergeMetadata } from '@/lib/utils/chat-metadata'
import { ChatMetadata } from '@/models/Chat'
import connectDB from '@/lib/db'
import Chat from '@/models/Chat'
import mongoose from 'mongoose'
import { VeritusPaper } from '@/types/veritus'

// Valid field values
const VALID_FIELDS_OF_STUDY = [
  'Computer Science', 'Medicine', 'Chemistry', 'Biology', 'Materials Science',
  'Physics', 'Geology', 'Psychology', 'Art', 'History', 'Geography',
  'Sociology', 'Business', 'Political Science', 'Economics', 'Philosophy',
  'Mathematics', 'Engineering', 'Environmental Science',
  'Agricultural and Food Sciences', 'Education', 'Law', 'Linguistics'
]

const VALID_QUARTILE_RANKINGS = ['Q1', 'Q2', 'Q3', 'Q4']
const VALID_PUBLICATION_TYPES = ['journal', 'book series', 'conference']

interface SearchPapersRequest {
  fieldsOfStudy?: string | string[]
  minCitationCount?: number
  openAccessPdf?: boolean
  downloadable?: boolean
  quartileRanking?: string | string[]
  publicationTypes?: string | string[]
  sort?: string // Format: field:direction (e.g., "score:desc", "citationCount:asc")
  year?: string // Format: YYYY or YYYY:YYYY
  limit?: 100 | 200 | 300
  chatId?: string
  query?: string // Required for querySearch and combinedSearch (50-5000 characters)
  phrases?: string[] // Required for keywordSearch and combinedSearch (3-10 phrases)
  enrich?: boolean
  callbackUrl?: string
  isMocked?: boolean // Allow mock flag
  _skipJobCreation?: boolean // Internal flag: skip job creation and use provided papers
  _papers?: VeritusPaper[] // Internal: papers to use when skipping job creation
}

/**
 * POST /api/v1/papers/search-papers
 * Advanced paper search with filters using Veritus API job system
 * Mock data is allowed for Stage 4 testing
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Support both body and query parameters
    const { searchParams } = new URL(request.url)
    const body: SearchPapersRequest = await request.json()
    
    // Merge query params with body (body takes precedence)
    const fieldsOfStudy = body.fieldsOfStudy || searchParams.get('fieldsOfStudy') || undefined
    const minCitationCount = body.minCitationCount !== undefined 
      ? body.minCitationCount 
      : searchParams.get('minCitationCount') 
        ? parseInt(searchParams.get('minCitationCount')!, 10) 
        : undefined
    const openAccessPdf = body.openAccessPdf !== undefined
      ? body.openAccessPdf
      : searchParams.get('openAccessPdf')
        ? searchParams.get('openAccessPdf') === 'true'
        : undefined
    const downloadable = body.downloadable !== undefined
      ? body.downloadable
      : searchParams.get('downloadable')
        ? searchParams.get('downloadable') === 'true'
        : undefined
    const quartileRanking = body.quartileRanking || searchParams.get('quartileRanking') || undefined
    const publicationTypes = body.publicationTypes || searchParams.get('publicationTypes') || undefined
    const sort = body.sort || searchParams.get('sort') || undefined
    const year = body.year || searchParams.get('year') || undefined
    const chatId = body.chatId || searchParams.get('chatId') || undefined
    const query = body.query || searchParams.get('query') || undefined
    const phrases = body.phrases || (searchParams.get('phrases') ? searchParams.get('phrases')!.split(',').map(p => p.trim()) : undefined)
    const skipJobCreation = body._skipJobCreation || false
    const providedPapers = body._papers || undefined
    const limit = body.limit || (searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) as 100 | 200 | 300 : 100)

    // Check if mock mode should be used (Stage 4 - Similar Paper Search)
    const useMock = normalizeMockFlag(body as any)

    // Validate fieldsOfStudy
    let fieldsOfStudyArray: string[] = []
    if (fieldsOfStudy) {
      fieldsOfStudyArray = Array.isArray(fieldsOfStudy)
        ? fieldsOfStudy
        : fieldsOfStudy.split(',').map(f => f.trim())
      
      const invalidFields = fieldsOfStudyArray.filter(f => !VALID_FIELDS_OF_STUDY.includes(f))
      if (invalidFields.length > 0) {
        return NextResponse.json(
          { error: `Invalid fieldsOfStudy: ${invalidFields.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Validate minCitationCount
    if (minCitationCount !== undefined) {
      if (!Number.isInteger(minCitationCount) || minCitationCount < 0) {
        return NextResponse.json(
          { error: 'minCitationCount must be a positive integer' },
          { status: 400 }
        )
      }
    }

    // Validate quartileRanking
    let quartileArray: string[] = []
    if (quartileRanking) {
      quartileArray = Array.isArray(quartileRanking)
        ? quartileRanking
        : quartileRanking.split(',').map(q => q.trim())
      
      const invalidQuartiles = quartileArray.filter(q => !VALID_QUARTILE_RANKINGS.includes(q))
      if (invalidQuartiles.length > 0) {
        return NextResponse.json(
          { error: `Invalid quartileRanking: ${invalidQuartiles.join(', ')}. Valid values: Q1, Q2, Q3, Q4` },
          { status: 400 }
        )
      }
    }

    // Validate publicationTypes
    let publicationTypesArray: string[] = []
    if (publicationTypes) {
      publicationTypesArray = Array.isArray(publicationTypes)
        ? publicationTypes
        : publicationTypes.split(',').map(p => p.trim())
      
      const invalidTypes = publicationTypesArray.filter(p => !VALID_PUBLICATION_TYPES.includes(p))
      if (invalidTypes.length > 0) {
        return NextResponse.json(
          { error: `Invalid publicationTypes: ${invalidTypes.join(', ')}. Valid values: journal, book series, conference` },
          { status: 400 }
        )
      }
    }

    // Validate boolean fields
    if (openAccessPdf !== undefined && typeof openAccessPdf !== 'boolean') {
      return NextResponse.json(
        { error: 'openAccessPdf must be true or false' },
        { status: 400 }
      )
    }

    if (downloadable !== undefined && typeof downloadable !== 'boolean') {
      return NextResponse.json(
        { error: 'downloadable must be true or false' },
        { status: 400 }
      )
    }

    // Validate phrases and query before determining job type
    const hasPhrases = phrases && Array.isArray(phrases) && phrases.length > 0
    const hasQuery = query && typeof query === 'string' && query.trim().length > 0
    
    // Validate phrases count (1-2 for keywordSearch/combinedSearch - updated to match UI limit)
    if (hasPhrases) {
      if (phrases.length < 1 || phrases.length > 2) {
        return NextResponse.json(
          { error: 'phrases must contain between 1 and 2 items for keywordSearch or combinedSearch' },
          { status: 400 }
        )
      }
    }
    
    // Validate query length (50-5000 for querySearch/combinedSearch)
    if (hasQuery) {
      const queryLength = query.trim().length
      if (queryLength < 50 || queryLength > 5000) {
        return NextResponse.json(
          { error: 'query must be between 50 and 5000 characters for querySearch or combinedSearch' },
          { status: 400 }
        )
      }
    }

    let papers: VeritusPaper[] = []

    // If papers are provided directly (from frontend job polling), use them
    if (skipJobCreation && providedPapers && providedPapers.length > 0) {
      papers = providedPapers
    } else if (useMock) {
      // Return mock data (Stage 4 - Similar Paper Search)
      // Add 3 second delay if DEBUG mode is enabled
      if (isDebugMode()) {
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
      const mockData = getMockCorpusResponse()
      papers = [mockData.paper, ...mockData.similarPapers]
    } else {
      // Use Veritus API job system for advanced search
      const apiKey = await getVeritusApiKey()
      
      // Determine job type based on validated input
      let jobType: 'keywordSearch' | 'querySearch' | 'combinedSearch' = 'querySearch'
      let jobBody: any = {}

      // Pad phrases array if needed (Veritus API requires minimum 3 phrases)
      // When user selects only 1-2 keywords, we pad with paper metadata from chatstore
      let paddedPhrases = phrases ? [...phrases] : []
      if (hasPhrases && paddedPhrases.length < 3 && chatId) {
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
          // If we can't get paper data, we'll let the API validation handle it
        }
      }
      
      // If still less than 3 after padding, the API will reject it
      // But we've already validated 1-2 in our validation, so this should be rare

      if (hasPhrases && hasQuery) {
        // Both phrases and query provided -> combinedSearch
        jobType = 'combinedSearch'
        jobBody = { phrases: paddedPhrases, query: query.trim() }
      } else if (hasPhrases) {
        // Only phrases provided -> keywordSearch
        jobType = 'keywordSearch'
        jobBody = { phrases: paddedPhrases }
      } else if (hasQuery) {
        // Only query provided -> querySearch
        jobType = 'querySearch'
        jobBody = { query: query.trim() }
      } else {
        // No phrases or query -> use querySearch with empty query (filters only)
        jobType = 'querySearch'
        jobBody = { query: '' }
      }

      // Create job with filters
      const jobParams = {
        jobType,
        limit: limit as 100 | 200 | 300,
        fieldsOfStudy: fieldsOfStudyArray.length > 0 ? fieldsOfStudyArray : undefined,
        minCitationCount,
        openAccessPdf,
        downloadable,
        quartileRanking: quartileArray.length > 0 ? quartileArray : undefined,
        publicationTypes: publicationTypesArray.length > 0 ? publicationTypesArray : undefined,
      }

      const jobResponse = await createJob(jobParams, jobBody, { apiKey })
      const jobId = jobResponse.jobId

      // Poll for job completion
      // For mock mode: 3 second timeout, for real API: 60 second timeout (default)
      const isMock = jobId.startsWith('mock-job-') || process.env.DEBUG === 'true'
      let attempts = 0
      const maxAttempts = isMock ? 2 : 30 // Mock: 2 attempts * 1.5s ≈ 3s, Real: 30 attempts * 2s = 60s
      const pollInterval = isMock ? 1500 : 2000 // Mock: 1.5s, Real: 2s
      let jobStatus

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        jobStatus = await getJobStatus(jobId, { apiKey })
        
        if (jobStatus.status === 'success') {
          papers = jobStatus.results || []
          break
        } else if (jobStatus.status === 'error') {
          throw new Error('Job failed')
        }
        
        attempts++
      }

      // Check if we timed out or got results
      if (!papers || papers.length === 0) {
        if (isMock) {
          return NextResponse.json(
            { error: 'Search timed out or returned no results' },
            { status: 504 }
          )
        } else {
          // For real API, check final status
          const finalStatus = await getJobStatus(jobId, { apiKey })
          if (finalStatus.status === 'queued' || finalStatus.status === 'processing') {
            return NextResponse.json(
              { error: 'Search timed out after 60 seconds. The job is still processing. Please try again later.' },
              { status: 504 }
            )
          }
          return NextResponse.json(
            { error: 'Search timed out after 60 seconds or returned no results' },
            { status: 504 }
          )
        }
      }
    }

    // Store papers in chat messages and update chat store if chatId provided
    // IMPORTANT: This stores papers from similar-search for citation network generation
    if (chatId && papers.length > 0) {
      try {
        await connectDB()
        
        // Fetch the specific chat by chatId AND userId to ensure:
        // 1. User can only update their own chats (security)
        // 2. Metadata is isolated to this specific chat session
        if (mongoose.Types.ObjectId.isValid(chatId)) {
          const chat = await Chat.findOne({
            _id: chatId,
            userId: user.userId,
          })

          if (chat) {
            // Extract metadata from all papers (includes tldr, quartile, publishedAt)
            const metadata = extractMetadataFromPapers(papers)
            
            // Merge with existing metadata using utility function
            // This merges into THIS specific chat's metadata only
            const existingMetadata = chat.chatMetadata || {}
            const updatedMetadata = mergeMetadata(existingMetadata as ChatMetadata, metadata)
            
            // Update chat store with similar papers (limit to 5 for graph)
            // Find the root paper's heading from chatMetadata
            if (chat.chatMetadata) {
              const rootPaperHeading = chat.chatMetadata.paperData?.abstract || chat.chatMetadata.paperData?.title
              if (rootPaperHeading && chat.chatMetadata.chatStore) {
                const chatStore = chat.chatMetadata.chatStore as any
                if (chatStore[rootPaperHeading]) {
                  // Update similar papers (limit to 5)
                  chatStore[rootPaperHeading].similarPapers = papers.slice(0, 5)
                  chatStore[rootPaperHeading].apiResponse = {
                    papers,
                    total: papers.length,
                    isMocked: useMock,
                  }
                  updatedMetadata.chatStore = chatStore
                }
              }
            }
            
            chat.chatMetadata = updatedMetadata
            
            // Store papers in chat messages automatically
            // These papers will be used by citation-network API
            const searchMessage = {
              role: 'assistant' as const,
              content: `Found ${papers.length} similar papers`,
              timestamp: new Date(),
              papers: papers, // Store all papers in the message for citation network
            }
            
            chat.messages.push(searchMessage)
            chat.updatedAt = new Date()
            await chat.save()
          }
        }
      } catch (error) {
        // Log error but don't fail the request
        console.error('Error updating chat metadata and storing papers:', error)
      }
    }

    return NextResponse.json({
      papers,
      total: papers.length,
      isMocked: useMock,
    })
  } catch (error: any) {
    console.error('Error searching papers:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to search papers' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    )
  }
}
