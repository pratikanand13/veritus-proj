import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import connectDB from '@/lib/db'
import Chat from '@/models/Chat'
import mongoose from 'mongoose'
import { VeritusPaper } from '@/types/veritus'
import { buildCitationGraphFromPapers } from '@/lib/utils/citation-graph-builder'
import { CitationNetworkRequest, CitationNetworkResponse, GraphOptions } from '@/types/paper-api'
import { storePaperSearchInChat } from '@/lib/chat-paper-integration'

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
      chatId,
      depth = 50,
      simple = false,
      sortBy = 'relevance',
      weighting = 'balanced',
      keywords = [],
      authors = [],
      references = [],
    } = body

    // chatId is required - we need it to fetch papers from chat messages
    if (!chatId) {
      return NextResponse.json(
        { error: 'chatId is required to generate citation network from chat messages' },
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

    // Validate sortBy parameter
    const validSortBy = ['relevance', 'citations', 'year']
    const sortAlgorithm = validSortBy.includes(sortBy) ? sortBy : 'relevance'
    const validWeighting = ['balanced', 'citations', 'recency', 'keywords']
    const weightingMode = validWeighting.includes(weighting as string) ? (weighting as any) : 'balanced'

    const limit = depth || 50

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

    // Extract all papers from messages (from similar-search results)
    const papersMap = new Map<string, VeritusPaper>()
    
    if (chat.messages && Array.isArray(chat.messages)) {
      chat.messages.forEach((message: any) => {
        // Extract from message.papers (these are from similar-search)
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
      })
    }

    // Convert map to array
    const papers = Array.from(papersMap.values())

    if (papers.length === 0) {
      return NextResponse.json(
        { error: 'No papers found in chat messages. Please perform a similar paper search first.' },
        { status: 404 }
      )
    }

    // Determine root paper from chatMetadata
    let rootPaperId: string | undefined
    if (chat.chatMetadata?.paperData?.id) {
      rootPaperId = chat.chatMetadata.paperData.id
    } else if (papers.length > 0) {
      rootPaperId = papers[0].id
    }

    // Build graph options
    const graphOptions: GraphOptions = {
      rootPaperId,
      sortBy: sortAlgorithm as any,
      sortOrder: 'desc',
      limit,
    }

    // Build citation network graph from papers stored in chat
    const citationNetwork = buildCitationGraphFromPapers(papers, graphOptions)

    // Get root paper
    const rootNode = citationNetwork.nodes.find((n) => n.isRoot)
    const rootPaper = rootNode?.data || papers.find((p) => p.id === rootPaperId) || papers[0]

    let result: CitationNetworkResponse

    if (simple) {
      // Simple mode: return Visualization-like structure
      result = {
        paper: rootPaper,
        similarPapers: papers.filter(p => p.id !== rootPaperId).slice(0, limit),
        graph: {
          nodes: citationNetwork.nodes.map((n) => ({
            id: n.id,
            label: n.label,
            citations: n.citations || 0,
            isRoot: n.isRoot || false,
          })),
          edges: citationNetwork.edges.map((e) => ({
            source: e.source,
            target: e.target,
            weight: e.weight || 0.5,
          })),
        },
        meta: {
          depth: limit,
          mode: 'simple',
          sortBy: sortAlgorithm,
          weighting: weightingMode,
          chatId,
        },
        isMocked: false,
      }
    } else {
      // Full citation network mode
      result = {
        paper: rootPaper,
        similarPapers: papers.filter(p => p.id !== rootPaperId).slice(0, limit),
        citationNetwork: {
          nodes: citationNetwork.nodes,
          edges: citationNetwork.edges,
          stats: {
            totalNodes: citationNetwork.nodes.length,
            totalEdges: citationNetwork.edges.length,
            citingCount: citationNetwork.nodes.filter(n => !n.isRoot).length,
            referencedCount: 0,
            paperNodes: citationNetwork.nodes.length,
          },
        },
        meta: {
          networkType: 'citation',
          depth: limit,
          mode: 'full',
          sortBy: sortAlgorithm,
          weighting: weightingMode,
          chatId,
          userInputs: {
            keywords: keywords.length > 0 ? keywords : undefined,
            authors: authors.length > 0 ? authors : undefined,
            references: references.length > 0 ? references : undefined,
          },
        },
        isMocked: false,
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
