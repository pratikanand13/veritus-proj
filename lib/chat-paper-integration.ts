import connectDB from './db'
import Chat from '@/models/Chat'
import { getCurrentUser } from './auth'
import mongoose from 'mongoose'
import {
  SearchPaperResponse,
  CorpusResponse,
  VisualizationResponse,
  CitationNetworkResponse,
} from '@/types/paper-api'

/**
 * Store paper search result in chat messages
 */
export async function storePaperSearchInChat(
  chatId: string,
  searchResult: SearchPaperResponse | CorpusResponse | VisualizationResponse | CitationNetworkResponse,
  searchType: 'search' | 'corpus' | 'visualization' | 'citation-network'
): Promise<void> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  await connectDB()

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new Error('Invalid chat ID')
  }

  const chat = await Chat.findOne({
    _id: chatId,
    userId: user.userId,
  })

  if (!chat) {
    throw new Error('Chat not found')
  }

  // Create message content based on search type
  let content = ''
  let papers: any[] = []
  let citationNetwork: any = null

  switch (searchType) {
    case 'search':
      const searchResponse = searchResult as SearchPaperResponse
      content = `Searched for paper: ${searchResponse.paper.title}`
      papers = [searchResponse.paper]
      break

    case 'corpus':
      const corpusResponse = searchResult as CorpusResponse
      content = `Found ${corpusResponse.similarPapers.length} similar papers for: ${corpusResponse.paper.title}`
      papers = [corpusResponse.paper, ...corpusResponse.similarPapers]
      break

    case 'visualization':
      const vizResponse = searchResult as VisualizationResponse
      content = `Generated semantic similarity graph for: ${vizResponse.paper.title}`
      papers = [vizResponse.paper, ...vizResponse.similarPapers]
      break

    case 'citation-network':
      const citationResponse = searchResult as CitationNetworkResponse
      content = `Generated citation network for: ${citationResponse.paper.title}`
      papers = [citationResponse.paper]
      citationNetwork = citationResponse.citationNetwork
      break
  }

  // Add assistant message with search results
  chat.messages.push({
    role: 'assistant',
    content,
    timestamp: new Date(),
    papers,
    citationNetwork,
  })

  await chat.save()
}

/**
 * Get paper search history from a chat
 */
export async function getPaperSearchHistory(chatId: string): Promise<any[]> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  await connectDB()

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new Error('Invalid chat ID')
  }

  const chat = await Chat.findOne({
    _id: chatId,
    userId: user.userId,
  })

  if (!chat) {
    throw new Error('Chat not found')
  }

  // Extract all messages that have papers
  return chat.messages
    .filter((msg) => msg.papers && msg.papers.length > 0)
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
      papers: msg.papers,
      citationNetwork: msg.citationNetwork,
      timestamp: msg.timestamp,
    }))
}

