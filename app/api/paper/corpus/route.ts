import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { resolvePaper } from '@/lib/services/paper-service'
import { buildPhrases } from '@/lib/services/phrase-builder'
import { runCombinedSearch } from '@/lib/services/job-service'
import { CorpusRequest, CorpusResponse } from '@/types/paper-api'
import { storePaperSearchInChat } from '@/lib/chat-paper-integration'
import { normalizeMockFlag } from '@/lib/config/mock-config'
import { getMockCorpusResponse } from '@/lib/mock-data/mock-data-manager'

/**
 * Load mock data from file (with variation support)
 */
function loadMockCorpusData(corpusId?: string): CorpusResponse {
  // Use corpusId to deterministically select variant, or random if not provided
  const variant = corpusId ? parseInt(corpusId.slice(-1)) % 3 : undefined
  const mockData = getMockCorpusResponse(variant)
  return { ...mockData, isMocked: true } as CorpusResponse
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: CorpusRequest = await request.json()
    const { corpusId, depth = 50, chatId } = body
    
    // Normalize mock flag (supports both mock and isMocked)
    const useMock = normalizeMockFlag(body)

    // Validate input
    if (!corpusId && !useMock) {
      return NextResponse.json(
        { error: 'corpusId is required' },
        { status: 400 }
      )
    }

    const limit = depth || 50
    let result: CorpusResponse

    if (useMock) {
      // Return mock data with depth limit applied and variation support
      const mockData = loadMockCorpusData(corpusId)
      result = {
        paper: mockData.paper,
        similarPapers: mockData.similarPapers.slice(0, limit),
        meta: { ...mockData.meta, depth: limit },
        isMocked: true,
      }
    } else {
      // Call services directly
      try {
        console.log('Calling corpus services directly:', { corpusId, depth: limit })
        
        // Get the paper first
        const paper = await resolvePaper(null, corpusId)

        // Build phrases and query for corpus search
        const { phrases, query } = buildPhrases(paper)

        // Run corpus search
        const similar = await runCombinedSearch(phrases, query, limit)

        result = {
          paper,
          similarPapers: similar.slice(0, limit),
          meta: { phrases, query, depth: limit },
          isMocked: false,
        }
        console.log('Corpus service response received')
      } catch (error: any) {
        console.error('Error calling corpus services:', error)
        if (error.message === 'Paper not found') {
          return NextResponse.json(
            { error: error.message },
            { status: 404 }
          )
        }
        return NextResponse.json(
          { error: error.message || 'Failed to get corpus' },
          { status: 500 }
        )
      }
    }

    // Optionally store in chat if chatId provided
    if (chatId) {
      try {
        await storePaperSearchInChat(chatId, result, 'corpus')
      } catch (error: any) {
        // Log error but don't fail the request
        console.error('Error storing corpus in chat:', error)
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error in corpus endpoint:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
