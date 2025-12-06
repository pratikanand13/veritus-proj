import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { resolvePaper } from '@/lib/services/paper-service'
import { buildPhrases, buildPhrasesFromUserInput } from '@/lib/services/phrase-builder'
import { runCombinedSearch } from '@/lib/services/job-service'
import { buildGraph } from '@/lib/services/graph-builder'
import { buildCitationNetwork } from '@/lib/services/citation-network-builder'
import { buildTree } from '@/lib/services/tree-builder'
import { CitationNetworkRequest, CitationNetworkResponse } from '@/types/paper-api'
import { storePaperSearchInChat } from '@/lib/chat-paper-integration'
import { normalizeMockFlag } from '@/lib/config/mock-config'
import { getMockCitationNetworkResponse } from '@/lib/mock-data/mock-data-manager'

/**
 * Load mock data from file (with variation support)
 */
function loadMockCitationNetworkData(corpusId?: string, simple?: boolean): CitationNetworkResponse {
  // Use corpusId to deterministically select variant, or random if not provided
  const variant = corpusId ? parseInt(corpusId.slice(-1)) % 3 : undefined
  const mockData = getMockCitationNetworkResponse(variant) as any
  
  // If simple mode, return simplified structure
  if (simple) {
    return {
      paper: mockData.paper,
      similarPapers: mockData.searchResults || [],
      graph: {
        nodes: (mockData.citationNetwork?.nodes || []).map((n: any) => ({
          id: n.id,
          label: n.label,
          citations: n.citations,
          isRoot: n.isRoot,
        })),
        edges: (mockData.citationNetwork?.edges || []).map((e: any) => ({
          source: typeof e.source === 'string' ? e.source : e.source.id,
          target: typeof e.target === 'string' ? e.target : e.target.id,
          weight: e.weight,
        })),
      },
      meta: {
        ...mockData.meta,
        mode: 'simple',
      },
      isMocked: true,
    } as CitationNetworkResponse
  }
  
  return { ...mockData, isMocked: true } as CitationNetworkResponse
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

    const body: CitationNetworkRequest = await request.json()
    const {
      corpusId,
      depth = 50,
      chatId,
      simple = false,
      sortBy = 'relevance',
      weighting = 'balanced',
      keywords = [],
      authors = [],
      references = [],
    } = body
    
    // Normalize mock flag (supports both mock and isMocked)
    const useMock = normalizeMockFlag(body)

    // Validate input
    if (!corpusId && !useMock) {
      return NextResponse.json(
        { error: 'corpusId is required' },
        { status: 400 }
      )
    }

    // Validate sortBy parameter
    const validSortBy = ['relevance', 'citations', 'year']
    const sortAlgorithm = validSortBy.includes(sortBy) ? sortBy : 'relevance'
    const validWeighting = ['balanced', 'citations', 'recency', 'keywords']
    const weightingMode = validWeighting.includes(weighting as string) ? (weighting as any) : 'balanced'

    const limit = depth || 50
    let result: CitationNetworkResponse

    if (useMock) {
      // Handle mock requests with variation support
      const mockData = loadMockCitationNetworkData(corpusId, simple)
      
      if (simple) {
        // Simple mode: return Visualization-like structure
        const citationNetwork = mockData.citationNetwork || (mockData as any).graph
        const simpleGraph = {
          nodes: (citationNetwork?.nodes || []).map((node: any) => ({
            id: node.id,
            label: node.label || node.title,
            citations: node.citations || 0,
            isRoot: node.isRoot || false,
          })),
          edges: (citationNetwork?.edges || []).map((edge: any) => ({
            source: edge.source,
            target: edge.target,
            weight: edge.weight || 0.5,
          })),
        }
        
        result = {
          paper: mockData.paper,
          similarPapers:
            (citationNetwork?.nodes || [])
              .filter((n: any) => !n.isRoot)
              .map((n: any) => ({
                id: n.id,
                title: n.label || n.title,
                impactFactor: { citationCount: n.citations || 0 },
              })),
          graph: simpleGraph,
          meta: {
            phrases: mockData.meta?.phrases || [],
            query: mockData.meta?.query || '',
            depth: limit,
            mode: 'simple',
            sortBy: sortAlgorithm,
            weighting: weightingMode,
          },
          isMocked: true,
        }
      } else {
        // Full citation network mode
        result = {
          paper: mockData.paper,
          searchResults: (mockData as any).searchResults || [],
          citationNetwork: {
            nodes: mockData.citationNetwork?.nodes || [],
            edges: mockData.citationNetwork?.edges || [],
            stats: mockData.citationNetwork?.stats || {
              totalNodes: 0,
              totalEdges: 0,
              citingCount: 0,
              referencedCount: 0,
            },
            tree: mockData.citationNetwork?.tree || undefined,
          },
          meta: {
            ...mockData.meta,
            depth: limit,
            mode: 'full',
            sortBy: sortAlgorithm,
            weighting: weightingMode,
            userInputs: {
              keywords: keywords.length > 0 ? keywords : undefined,
              authors: authors.length > 0 ? authors : undefined,
              references: references.length > 0 ? references : undefined,
            },
          },
          isMocked: true,
        }
      }
    } else {
      // Call services directly
      try {
        console.log('Calling citation network services directly:', {
          corpusId,
          depth: limit,
          simple,
          sortBy: sortAlgorithm,
          weighting: weightingMode,
        })

        // Get the main paper
        const paper = await resolvePaper(null, corpusId)

        if (simple) {
          // Simple mode: Visualization-like output
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
              mode: 'simple',
              sortBy: sortAlgorithm,
            },
            isMocked: false,
          }
        } else {
          // Full citation network mode with user inputs
          const { phrases, query } = buildPhrasesFromUserInput({
            paper,
            keywords: Array.isArray(keywords) ? keywords : [],
            authors: Array.isArray(authors) ? authors : [],
            references: Array.isArray(references) ? references : [],
          })

          // Run combined search - this internally:
          // 1. Creates job via POST /v1/job/combinedSearch → returns jobId
          // 2. Polls job status via GET /v1/job/{jobId} every 2 seconds
          // 3. Returns results when status === "success"
          const searchResults = await runCombinedSearch(phrases, query, limit)

          // TODO: Fetch papers that this paper cites (references/backward citations)
          // This would require accessing paper.references or a separate API call
          // For now, we'll create an empty array - this should be implemented when citation data is available
          const referencedPapers: any[] = []

          // Build citation network graph structure with sorting
          const citationNetwork = buildCitationNetwork(
            paper,
            searchResults,
            referencedPapers,
            sortAlgorithm,
            {
              weighting: weightingMode,
              userInputs: {
                keywords: keywords as string[],
                authors: authors as string[],
                references: references as string[],
              },
            }
          )

          // Build tree structure
          const allPapers = [paper, ...searchResults]
          const tree = buildTree(paper, allPapers, citationNetwork.edges)

          result = {
            paper,
            searchResults: searchResults, // Return sorted search results
            citationNetwork: {
              nodes: citationNetwork.nodes,
              edges: citationNetwork.edges,
              stats: citationNetwork.stats,
              tree: tree ? {
                root: paper,
                levels: tree.levels.map(level => ({
                  level: level.level,
                  nodes: level.nodes as any, // Tree builder uses Paper type, but these are VeritusPaper
                  description: level.description,
                })),
                relationships: tree.relationships,
              } : undefined, // Add tree structure
            },
            meta: {
              networkType: 'citation',
              depth: limit,
              phrases,
              query,
              mode: 'full',
              sortBy: sortAlgorithm,
              weighting: weightingMode,
              userInputs: {
                keywords: keywords.length > 0 ? keywords : undefined,
                authors: authors.length > 0 ? authors : undefined,
                references: references.length > 0 ? references : undefined,
              },
            },
            isMocked: false,
          }
        }

        console.log('Citation network service response received')
      } catch (error: any) {
        console.error('Error calling citation network services:', error)
        if (error.message === 'Paper not found') {
          return NextResponse.json(
            { error: error.message },
            { status: 404 }
          )
        }
        return NextResponse.json(
          { error: error.message || 'Failed to get citation network' },
          { status: 500 }
        )
      }
    }

    // Optionally store in chat if chatId provided
    if (chatId) {
      try {
        await storePaperSearchInChat(chatId, result, 'citation-network')
      } catch (error: any) {
        // Log error but don't fail the request
        console.error('Error storing citation network in chat:', error)
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error in citation-network endpoint:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
