import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import connectDB from '@/lib/db'
import Chat from '@/models/Chat'
import mongoose from 'mongoose'
import { VeritusPaper } from '@/types/veritus'

/**
 * Save paper details to chat cache (stored in chat messages)
 */
export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const { chatId } = params
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return NextResponse.json({ error: 'Invalid chat ID' }, { status: 400 })
    }

    const body = await request.json()
    const { paperId, paper } = body

    if (!paperId || !paper) {
      return NextResponse.json(
        { error: 'paperId and paper are required' },
        { status: 400 }
      )
    }

    const chat = await Chat.findOne({
      _id: chatId,
      userId: user.userId,
    })

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    // Check if paper already exists in any message
    let paperExists = false
    for (const message of chat.messages) {
      if (message.papers && Array.isArray(message.papers)) {
        const existingPaper = message.papers.find((p: any) => p.id === paperId)
        if (existingPaper) {
          // Update existing paper with full details
          Object.assign(existingPaper, paper)
          paperExists = true
          break
        }
      }
    }

    // If paper doesn't exist, add it to the most recent message with papers, or create a new cache message
    if (!paperExists) {
      // Find the most recent message with papers
      let lastMessageWithPapers = null
      for (let i = chat.messages.length - 1; i >= 0; i--) {
        if (chat.messages[i].papers && Array.isArray(chat.messages[i].papers)) {
          lastMessageWithPapers = chat.messages[i]
          break
        }
      }

      if (lastMessageWithPapers) {
        // Add to existing message
        if (!lastMessageWithPapers.papers) {
          lastMessageWithPapers.papers = []
        }
        lastMessageWithPapers.papers.push(paper)
      } else {
        // Create a new cache message
        chat.messages.push({
          role: 'assistant',
          content: `Cached paper details: ${paper.title || paperId}`,
          timestamp: new Date(),
          papers: [paper],
        })
      }
    }

    await chat.save()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saving paper to chat cache:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Get all cached papers from chat
 */
export async function GET(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const { chatId } = params
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return NextResponse.json({ error: 'Invalid chat ID' }, { status: 400 })
    }

    const chat = await Chat.findOne({
      _id: chatId,
      userId: user.userId,
    })

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    // Extract all papers from all messages
    const papersMap = new Map<string, VeritusPaper>()
    for (const message of chat.messages) {
      if (message.papers && Array.isArray(message.papers)) {
        for (const paper of message.papers) {
          if (paper.id) {
            papersMap.set(paper.id, paper)
          }
        }
      }
    }

    return NextResponse.json({
      papers: Object.fromEntries(papersMap),
    })
  } catch (error: any) {
    console.error('Error getting paper cache from chat:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

