import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getVeritusApiKey } from '@/lib/veritus-auth'
import { getPaper } from '@/lib/veritus-api'
import { normalizeMockFlag } from '@/lib/config/mock-config'
import { getMockSearchResponse } from '@/lib/mock-data/mock-data-manager'
import { updateChatMetadata } from '@/lib/utils/chat-metadata'
import connectDB from '@/lib/db'
import Chat from '@/models/Chat'
import mongoose from 'mongoose'

/**
 * GET /api/v1/papers/{corpusId}
 * Get paper by corpus ID using Veritus API
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ corpusId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { corpusId } = await params
    const { searchParams } = new URL(request.url)
    const chatId = searchParams.get('chatId')

    if (!corpusId || corpusId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Corpus ID is required' },
        { status: 400 }
      )
    }

    // Check if mock mode should be used
    const useMock = normalizeMockFlag({ isMocked: searchParams.get('mock') === 'true' })

    let paper

    if (useMock) {
      // Return mock data (use corpusId to select variant)
      const mockData = getMockSearchResponse()
      paper = { ...mockData.paper, id: corpusId }
    } else {
      // Call Veritus API directly
      const apiKey = await getVeritusApiKey()
      paper = await getPaper(corpusId.trim(), { apiKey })
    }

    // Store in chat metadata if chatId provided
    if (chatId) {
      try {
        await connectDB()
        
        if (mongoose.Types.ObjectId.isValid(chatId)) {
          const chat = await Chat.findOne({
            _id: chatId,
            userId: user.userId,
          })

          if (chat) {
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
      message: 'Paper retrieved successfully',
      isMocked: useMock,
    })
  } catch (error: any) {
    console.error('Error fetching paper:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch paper' },
      { status: error.message?.includes('Unauthorized') ? 401 : error.message?.includes('not found') ? 404 : 500 }
    )
  }
}


