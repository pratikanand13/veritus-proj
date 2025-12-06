import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { resolvePaper } from '@/lib/services/paper-service'
import { SearchPaperRequest, SearchPaperResponse } from '@/types/paper-api'
import { storePaperSearchInChat } from '@/lib/chat-paper-integration'
import { normalizeMockFlag } from '@/lib/config/mock-config'
import { getMockSearchResponse } from '@/lib/mock-data/mock-data-manager'

/**
 * Load mock data from file (with variation support)
 */
function loadMockSearchData(corpusId?: string): SearchPaperResponse {
  // Use corpusId to deterministically select variant, or random if not provided
  const variant = corpusId ? parseInt(corpusId.slice(-1)) % 4 : undefined
  const mockData = getMockSearchResponse(variant)
  return { ...mockData, isMocked: true } as SearchPaperResponse
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

    const body: SearchPaperRequest = await request.json()
    const { title, corpusId, chatId } = body
    
    // Normalize mock flag (supports both mock and isMocked)
    const useMock = normalizeMockFlag(body)

    // Validate input
    if (!title && !corpusId) {
      return NextResponse.json(
        { error: 'Either title or corpusId is required' },
        { status: 400 }
      )
    }

    let result: SearchPaperResponse

    if (useMock) {
      // Return mock data with variation support
      result = loadMockSearchData(corpusId)
    } else {
      // Call service directly
      try {
        console.log('Calling paper service directly:', { title, corpusId })
        const paper = await resolvePaper(title || null, corpusId || null)
        result = {
          paper,
          message: 'Paper found. Use corpusId to get corpus search or visualization.',
          isMocked: false,
        }
        console.log('Paper service response received')
      } catch (error: any) {
        console.error('Error calling paper service:', error)
        if (error.message === 'Paper not found') {
          return NextResponse.json(
            { error: error.message },
            { status: 404 }
          )
        }
        return NextResponse.json(
          { error: error.message || 'Failed to search paper' },
          { status: 500 }
        )
      }
    }

    // Optionally store in chat if chatId provided
    if (chatId) {
      try {
        await storePaperSearchInChat(chatId, result, 'search')
        
        // Also save to paper cache (paper is already saved via storePaperSearchInChat)
        // The cache will be loaded from chat messages when CitationTree initializes
      } catch (error: any) {
        // Log error but don't fail the request
        console.error('Error storing search in chat:', error)
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error in search endpoint:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
