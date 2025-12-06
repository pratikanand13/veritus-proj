import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { resolvePaper } from '@/lib/services/paper-service'
import { buildPhrases } from '@/lib/services/phrase-builder'
import { runCombinedSearch } from '@/lib/services/job-service'
import { buildGraph } from '@/lib/services/graph-builder'
import { VisualizationRequest, VisualizationResponse } from '@/types/paper-api'
import { storePaperSearchInChat } from '@/lib/chat-paper-integration'
import { normalizeMockFlag } from '@/lib/config/mock-config'
import visualizationMockData from '@/lib/mock-data/visualization-response.json'

/**
 * Load mock data from file
 */
function loadMockVisualizationData(): VisualizationResponse {
  return { ...visualizationMockData, isMocked: true } as VisualizationResponse
}

/**
 * [DEPRECATED] This endpoint is deprecated.
 * Use /api/paper/citation-network with simple=true instead.
 * 
 * This endpoint internally calls citation-network logic with simple=true
 * for backward compatibility.
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

    const body: VisualizationRequest = await request.json()
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
    let result: VisualizationResponse

    if (useMock) {
      // Return mock data
      result = loadMockVisualizationData()
      // Apply depth limit to similar papers
      if (result.similarPapers) {
        result.similarPapers = result.similarPapers.slice(0, limit)
      }
      result.meta.depth = limit
      result.isMocked = true
    } else {
      // Call services directly (same as citation-network with simple=true)
      try {
        console.log('Calling visualization services directly (deprecated endpoint):', {
          corpusId,
          depth: limit,
        })

        const paper = await resolvePaper(null, corpusId)
        const { phrases, query } = buildPhrases(paper)
        const similarPapers = await runCombinedSearch(phrases, query, limit)
        const graph = buildGraph(paper, similarPapers.slice(0, limit))

        result = {
          paper,
          similarPapers: similarPapers.slice(0, limit),
          graph,
          meta: {
            phrases,
            query,
            depth: limit,
          },
          isMocked: false,
        }

        console.log('Visualization service response received')
      } catch (error: any) {
        console.error('Error calling visualization services:', error)
        if (error.message === 'Paper not found') {
          return NextResponse.json(
            { error: error.message },
            { status: 404 }
          )
        }
        return NextResponse.json(
          { error: error.message || 'Failed to get visualization' },
          { status: 500 }
        )
      }
    }

    // Optionally store in chat if chatId provided
    if (chatId) {
      try {
        await storePaperSearchInChat(chatId, result, 'visualization')
      } catch (error: any) {
        // Log error but don't fail the request
        console.error('Error storing visualization in chat:', error)
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error in visualization endpoint:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
