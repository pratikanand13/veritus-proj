import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getVeritusApiKey } from '@/lib/veritus-auth'
import { createJob, getJobStatus } from '@/lib/veritus-api'
import { normalizeMockFlag } from '@/lib/config/mock-config'
import { getMockCorpusResponse } from '@/lib/mock-data/mock-data-manager'
import { updateChatMetadata, extractMetadataFromPapers, mergeMetadata, ChatMetadata } from '@/lib/utils/chat-metadata'
import connectDB from '@/lib/db'
import Chat from '@/models/Chat'
import mongoose from 'mongoose'

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
}

/**
 * POST /api/v1/papers/search-papers
 * Advanced paper search with filters using Veritus API job system
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

    const body: SearchPapersRequest = await request.json()
    const {
      fieldsOfStudy,
      minCitationCount,
      openAccessPdf,
      downloadable,
      quartileRanking,
      publicationTypes,
      chatId,
      query,
      phrases,
    } = body

    // Check if mock mode should be used
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

    let papers: any[] = []

    if (useMock) {
      // Return mock data
      const mockData = getMockCorpusResponse()
      papers = [mockData.paper, ...mockData.similarPapers]
    } else {
      // Use Veritus API job system for advanced search
      const apiKey = await getVeritusApiKey()
      
      // Determine job type based on input
      let jobType: 'keywordSearch' | 'querySearch' | 'combinedSearch' = 'querySearch'
      let jobBody: any = {}

      if (phrases && phrases.length >= 3 && phrases.length <= 10) {
        jobType = phrases.length >= 3 && query ? 'combinedSearch' : 'keywordSearch'
        if (jobType === 'combinedSearch') {
          jobBody = { phrases, query: query || '' }
        } else {
          jobBody = { phrases }
        }
      } else if (query && query.length >= 50 && query.length <= 5000) {
        jobType = 'querySearch'
        jobBody = { query }
      } else {
        // Default: use query search with empty query (will use filters only)
        jobType = 'querySearch'
        jobBody = { query: '' }
      }

      // Create job with filters
      const jobParams = {
        jobType,
        limit: 100 as const,
        fieldsOfStudy: fieldsOfStudyArray.length > 0 ? fieldsOfStudyArray : undefined,
        minCitationCount,
        openAccessPdf,
        downloadable,
        quartileRanking: quartileArray.length > 0 ? quartileArray : undefined,
        publicationTypes: publicationTypesArray.length > 0 ? publicationTypesArray : undefined,
      }

      const jobResponse = await createJob(jobParams, jobBody, { apiKey })
      const jobId = jobResponse.jobId

      // Poll for job completion (simple polling, can be improved)
      let attempts = 0
      const maxAttempts = 30
      let jobStatus

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
        jobStatus = await getJobStatus(jobId, { apiKey })
        
        if (jobStatus.status === 'success') {
          papers = jobStatus.results || []
          break
        } else if (jobStatus.status === 'error') {
          throw new Error(jobStatus.error || 'Job failed')
        }
        
        attempts++
      }

      if (!papers || papers.length === 0) {
        return NextResponse.json(
          { error: 'Search timed out or returned no results' },
          { status: 504 }
        )
      }
    }

    // Store in chat metadata if chatId provided
    if (chatId && papers.length > 0) {
      try {
        await connectDB()
        
        if (mongoose.Types.ObjectId.isValid(chatId)) {
          const chat = await Chat.findOne({
            _id: chatId,
            userId: user.userId,
          })

          if (chat) {
            // Extract metadata from all papers (includes tldr, quartile, publishedAt)
            const metadata = extractMetadataFromPapers(papers)
            
            // Merge with existing metadata using utility function
            const existingMetadata = chat.chatMetadata || {}
            const updatedMetadata = mergeMetadata(existingMetadata as ChatMetadata, metadata)
            
            chat.chatMetadata = updatedMetadata
            chat.updatedAt = new Date()
            await chat.save()
          }
        }
      } catch (error) {
        // Log error but don't fail the request
        console.error('Error updating chat metadata:', error)
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

