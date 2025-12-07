import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getVeritusApiKey } from '@/lib/veritus-auth'
import { searchPapers } from '@/lib/veritus-api'
import { normalizeMockFlag, isDebugMode } from '@/lib/config/mock-config'
import { getMockSearchResponse } from '@/lib/mock-data/mock-data-manager'
import { updateChatMetadata } from '@/lib/utils/chat-metadata'
import connectDB from '@/lib/db'
import Chat from '@/models/Chat'
import mongoose from 'mongoose'

/**
 * GET /api/v1/papers/search
 * Search papers by title using Veritus API
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const title = searchParams.get('title')
    const chatId = searchParams.get('chatId')

    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title parameter is required' },
        { status: 400 }
      )
    }

    // Check if mock mode should be used (DEBUG=true uses mock data)
    const useMock = normalizeMockFlag({ isMocked: searchParams.get('mock') === 'true' })

    let paper

    if (useMock) {
      // Return mock data with 3 second delay if DEBUG mode is enabled
      if (isDebugMode()) {
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
      const mockData = getMockSearchResponse()
      paper = mockData.paper
    } else {
      // Call Veritus API directly
      const apiKey = await getVeritusApiKey()
      const papers = await searchPapers({ title: title.trim() }, { apiKey })
      
      if (!papers || papers.length === 0) {
        return NextResponse.json(
          { error: 'No papers found' },
          { status: 404 }
        )
      }

      // Return the first paper (most relevant)
      paper = papers[0]
    }

    // Store in chat metadata if chatId provided
    // IMPORTANT: Metadata is scoped per chatId - each chat maintains its own isolated metadata
    if (chatId) {
      try {
        await connectDB()
        
        if (mongoose.Types.ObjectId.isValid(chatId)) {
          // Fetch the specific chat by chatId AND userId to ensure:
          // 1. User can only update their own chats (security)
          // 2. Metadata is isolated to this specific chat session
          const chat = await Chat.findOne({
            _id: chatId,
            userId: user.userId,
          })

          if (chat) {
            // Update metadata for THIS specific chat only
            await updateChatMetadata(chat, paper)
            await chat.save()
          }
        }
      } catch (error) {
        // Log error but don't fail the request
        console.error('Error updating chat metadata:', error)
      }
    }

    return NextResponse.json({
      paper,
      message: 'Paper found successfully',
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


