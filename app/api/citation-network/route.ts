import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import connectDB from '@/lib/db'
import Chat from '@/models/Chat'
import mongoose from 'mongoose'
import { VeritusPaper } from '@/types/veritus'
import { buildCitationGraphFromPapers } from '@/lib/utils/citation-graph-builder'
import { CitationNetworkResponse, GraphOptions, CitationNetwork } from '@/types/paper-api'

/**
 * POST /api/citation-network
 * Generate citation network graph from papers stored in chat messages
 * 
 * Query Parameters:
 * - chatId (required): Chat ID to fetch papers from
 * - paperId (optional): ID of paper to expand (if not provided, uses root paper from chatMetadata)
 * - sortBy (optional): relevance | citations | year | title (default: relevance)
 * - sortOrder (optional): asc | desc (default: desc)
 * - minCitations (optional): Filter papers by minimum citation count
 * - maxCitations (optional): Filter papers by maximum citation count
 * - minYear (optional): Filter papers by minimum year
 * - maxYear (optional): Filter papers by maximum year
 * - fieldsOfStudy (optional): Comma-separated list of fields to filter by
 * - authors (optional): Comma-separated list of authors to filter by
 * - publicationTypes (optional): Comma-separated list of publication types
 * - limit (optional): Maximum number of paper nodes (default: 100)
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

    // Parse query parameters from URL
    const { searchParams } = new URL(request.url)
    const chatId = searchParams.get('chatId')
    const paperId = searchParams.get('paperId') // Optional: paper to expand

    if (!chatId) {
      return NextResponse.json(
        { error: 'chatId query parameter is required' },
        { status: 400 }
      )
    }

    // Validate chatId format
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return NextResponse.json(
        { error: 'Invalid chatId format' },
        { status: 400 }
      )
    }

    // Parse query parameters
    const sortBy = (searchParams.get('sortBy') as GraphOptions['sortBy']) || 'relevance'
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
    const minCitations = searchParams.get('minCitations')
      ? parseInt(searchParams.get('minCitations')!, 10)
      : undefined
    const maxCitations = searchParams.get('maxCitations')
      ? parseInt(searchParams.get('maxCitations')!, 10)
      : undefined
    const minYear = searchParams.get('minYear')
      ? parseInt(searchParams.get('minYear')!, 10)
      : undefined
    const maxYear = searchParams.get('maxYear')
      ? parseInt(searchParams.get('maxYear')!, 10)
      : undefined
    const fieldsOfStudy = searchParams.get('fieldsOfStudy')
      ? searchParams.get('fieldsOfStudy')!.split(',').map((f) => f.trim()).filter(Boolean)
      : undefined
    const authors = searchParams.get('authors')
      ? searchParams.get('authors')!.split(',').map((a) => a.trim()).filter(Boolean)
      : undefined
    const publicationTypes = searchParams.get('publicationTypes')
      ? searchParams.get('publicationTypes')!.split(',').map((t) => t.trim()).filter(Boolean)
      : undefined
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : 100

    // Validate limit
    if (limit && (limit < 1 || limit > 1000)) {
      return NextResponse.json(
        { error: 'limit must be between 1 and 1000' },
        { status: 400 }
      )
    }

    // Connect to database
    await connectDB()

    // Fetch chat by chatId and userId (security: user can only access their own chats)
    const chat = await Chat.findOne({
      _id: chatId,
      userId: user.userId,
    })

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    // Extract all papers from messages
    const papersMap = new Map<string, VeritusPaper>()
    
    if (chat.messages && Array.isArray(chat.messages)) {
      chat.messages.forEach((message: any) => {
        // Extract from message.papers
        if (message.papers && Array.isArray(message.papers)) {
          message.papers.forEach((paper: VeritusPaper) => {
            if (paper && paper.id) {
              papersMap.set(paper.id, paper)
            }
          })
        }

        // Extract from citationNetwork.paper
        if (message.citationNetwork?.paper) {
          const paper = message.citationNetwork.paper
          if (paper && paper.id) {
            papersMap.set(paper.id, paper)
          }
        }

        // Extract from citationNetwork.similarPapers
        if (message.citationNetwork?.similarPapers && Array.isArray(message.citationNetwork.similarPapers)) {
          message.citationNetwork.similarPapers.forEach((paper: VeritusPaper) => {
            if (paper && paper.id) {
              papersMap.set(paper.id, paper)
            }
          })
        }

        // Extract from citationNetwork.citationNetwork.nodes
        if (message.citationNetwork?.citationNetwork?.nodes && Array.isArray(message.citationNetwork.citationNetwork.nodes)) {
          message.citationNetwork.citationNetwork.nodes.forEach((node: any) => {
            if (node.data && node.data.id) {
              papersMap.set(node.data.id, node.data)
            }
          })
        }
      })
    }

    // Convert map to array
    const papers = Array.from(papersMap.values())

    // CRITICAL: Restore parent→child relationships from chatstore
    // This ensures children are restored when reloading the graph
    const paperRelationships = (chat.chatMetadata?.paperRelationships as any) || {}
    if (Object.keys(paperRelationships).length > 0) {
      // For each parent paper, add its children to the papers array if they don't exist
      Object.entries(paperRelationships).forEach(([parentPaperId, relationship]: [string, any]) => {
        const childPapers = (relationship as any).childPapers || []
        childPapers.forEach((childPaper: any) => {
          // Check if child paper already exists in papersMap
          if (childPaper.id && !papersMap.has(childPaper.id)) {
            // Create a minimal paper object from stored child data
            // Note: Full paper data should be fetched separately if needed
            const childPaperData: VeritusPaper = {
              id: childPaper.id,
              title: childPaper.title,
              // Add other fields as needed or fetch full data separately
            } as VeritusPaper
            papersMap.set(childPaper.id, childPaperData)
          }
        })
      })
    }

    // Convert map to array again (now includes restored children)
    const allPapers = Array.from(papersMap.values())

    if (allPapers.length === 0) {
      return NextResponse.json(
        { error: 'No papers found in chat messages' },
        { status: 404 }
      )
    }

    // Determine root paper
    // If paperId is provided, use that paper as root; otherwise use chatMetadata.paperData or first paper
    let rootPaperId: string | undefined
    if (paperId) {
      // Check if paperId exists in the papers array
      const paperExists = allPapers.some((p) => p.id === paperId)
      if (paperExists) {
        rootPaperId = paperId
      } else {
        return NextResponse.json(
          { error: `Paper with ID ${paperId} not found in chat messages` },
          { status: 404 }
        )
      }
    } else if (chat.chatMetadata?.paperData?.id) {
      rootPaperId = chat.chatMetadata.paperData.id
    }

    // Create set of expandable paper IDs (all papers in chat messages can be expanded)
    const expandablePaperIds = new Set<string>(allPapers.map((p) => p.id))

    // Build graph options
    const graphOptions: GraphOptions = {
      rootPaperId,
      sortBy,
      sortOrder,
      filters: {
        minCitations,
        maxCitations,
        minYear,
        maxYear,
        fieldsOfStudy,
        authors,
        publicationTypes,
      },
      limit,
    }

    // Build citation network graph using simple graph builder (paper-only structure)
    // Include restored parent→child relationships from chatstore
    let citationNetwork: CitationNetwork | undefined
    try {
      citationNetwork = buildCitationGraphFromPapers(allPapers, graphOptions)
      
      // CRITICAL: Restore parent→child edges from chatstore relationships
      if (citationNetwork && citationNetwork.nodes && Object.keys(paperRelationships).length > 0) {
        // Store reference to avoid undefined issues in nested callbacks
        const network = citationNetwork
        
        // Build a map of paperId to node for quick lookup
        const nodeMap = new Map<string, any>()
        network.nodes.forEach((node: any) => {
          if (node.data && node.data.id) {
            nodeMap.set(node.data.id, node)
          }
        })

        // Ensure edges array exists
        if (!network.edges) {
          network.edges = []
        }

        // Restore edges from stored relationships
        Object.entries(paperRelationships).forEach(([parentPaperId, relationship]: [string, any]) => {
          const parentNode = nodeMap.get(parentPaperId)
          if (!parentNode) return

          const childPapers = (relationship as any).childPapers || []
          childPapers.forEach((childPaper: any) => {
            const childNode = nodeMap.get(childPaper.id)
            if (childNode && network.edges) {
              // Check if edge already exists
              const edgeExists = network.edges.some((edge: any) => {
                const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as any)?.id
                const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as any)?.id
                return sourceId === parentNode.id && targetId === childNode.id
              })

              if (!edgeExists) {
                network.edges.push({
                  source: String(parentNode.id),
                  target: String(childNode.id),
                  type: 'references' as const,
                  weight: 1.0,
                })
              }
            }
          })
        })
      }
    } catch (buildError: any) {
      console.error('Error building citation graph:', buildError)
      throw new Error(`Failed to build citation network: ${buildError.message || 'Unknown error'}`)
    }

    if (!citationNetwork || !citationNetwork.nodes || !Array.isArray(citationNetwork.nodes)) {
      throw new Error('Invalid citation network structure returned from builder')
    }

    // Get root paper
    const rootNode = citationNetwork.nodes.find((n) => n.isRoot)
    const rootPaper = rootNode?.data || allPapers.find((p) => p.id === rootPaperId) || allPapers[0]

    if (!rootPaper) {
      throw new Error('No root paper found')
    }

    // Build response
    const response: CitationNetworkResponse = {
      paper: rootPaper,
      citationNetwork,
      meta: {
        chatId,
        sortBy,
        sortOrder,
        depth: chat.depth || 100,
        filters: graphOptions.filters,
        limit,
      },
      isMocked: false,
    }

    return NextResponse.json(response, {
      headers: {
        'Content-Type': 'application/json',
      }
    })
  } catch (error: any) {
    console.error('Error in citation-network endpoint:', error)
    console.error('Error stack:', error.stack)
    
    // Ensure we always return JSON, never HTML
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : 'Internal server error'
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    )
  }
}
