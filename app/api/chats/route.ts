import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Chat from '@/models/Chat'
import Project from '@/models/Project'
import { getCurrentUser } from '@/lib/auth'
import { createAnalyticsDirectory, saveChatData } from '@/lib/file-system'
import mongoose from 'mongoose'

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await connectDB()

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    const query: any = { userId: user.userId }
    if (projectId) {
      // Validate projectId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return NextResponse.json(
          { error: 'Invalid project ID' },
          { status: 400 }
        )
      }
      query.projectId = projectId
    }

    const chats = await Chat.find(query).sort({ updatedAt: -1 })

    // Transform chats to include id field
    const transformedChats = chats.map(chat => ({
      id: chat._id.toString(),
      projectId: chat.projectId.toString(),
      title: chat.title,
      messages: chat.messages,
      depth: (chat as any).depth || 100,
      isFavorite: (chat as any).isFavorite || false,
      chatMetadata: (chat as any).chatMetadata || {},
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    }))

    return NextResponse.json({ chats: transformedChats })
  } catch (error) {
    console.error('Error fetching chats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
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

    await connectDB()

    const body = await request.json()
    const { projectId, title, depth, paperData, messages: initialMessages } = body

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Validate projectId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Chat title is required' },
        { status: 400 }
      )
    }

    // Verify project belongs to user
    const project = await Project.findOne({
      _id: projectId,
      userId: user.userId,
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Initialize chat metadata
    // IMPORTANT: Each chat has its own isolated chatMetadata field
    // This ensures metadata from one chat session doesn't interfere with another
    const chatMetadata: any = {
      authors: [],
      keywords: [],
      abstracts: [],
      tldrs: [],
      publicationTypes: [],
      publishedDates: [],
      quartileRankings: [],
      journalNames: [],
      citationCounts: [],
    }

    // If paperData is provided, store it in chatMetadata and extract metadata
    // This paperData is scoped to THIS specific chat instance only
    // Also initialize chat store entry with heading as key
    if (paperData) {
      chatMetadata.paperData = paperData
      
      // Initialize chat store entry
      // Key: abstract or title (heading)
      // Value: Full API response with paper data
      const heading = paperData.abstract || paperData.title || ''
      if (heading) {
        chatMetadata.chatStore = {
          [heading]: {
            heading,
            paper: paperData,
            similarPapers: [], // Empty initially, will be populated after similar search
            apiResponse: { paper: paperData }, // Full API response
          }
        }
      }
      
      if (paperData.authors) {
        chatMetadata.authors = Array.isArray(paperData.authors) 
          ? paperData.authors 
          : paperData.authors.split(',').map((a: string) => a.trim())
      }
      if (paperData.abstract) {
        chatMetadata.abstracts = [paperData.abstract]
      }
      if (paperData.tldr) {
        chatMetadata.tldrs = [paperData.tldr]
      }
      if (paperData.journalName) {
        chatMetadata.journalNames = [paperData.journalName]
      }
      if (paperData.citationCount) {
        chatMetadata.citationCounts = [paperData.citationCount]
      }
      if (paperData.year) {
        chatMetadata.publishedDates = [new Date(paperData.year, 0, 1)]
      }
      if (paperData.publicationType) {
        chatMetadata.publicationTypes = [paperData.publicationType]
      }
    }

    // Create initial message with paper data if paperData is provided
    let messagesToStore = initialMessages && Array.isArray(initialMessages) ? initialMessages : []
    
    if (paperData && messagesToStore.length === 0) {
      // Create initial message with paper data stored in chat store format
      messagesToStore = [{
        role: 'assistant',
        content: `Paper: ${paperData.title || 'Untitled'}\n\nAuthors: ${paperData.authors || 'N/A'}\nYear: ${paperData.year || 'N/A'}\nJournal: ${paperData.journalName || 'N/A'}\n\n${paperData.abstract ? `Abstract: ${paperData.abstract}` : ''}\n\n${paperData.tldr ? `TLDR: ${paperData.tldr}` : ''}`,
        timestamp: new Date(),
        papers: [paperData], // Store paper in message.papers array
      }]
    }

    // Create chat with initialized metadata
    const chat = new Chat({
      projectId,
      userId: user.userId,
      title: title.trim(),
      messages: messagesToStore,
      depth: depth !== undefined ? Math.max(1, Math.min(500, depth)) : 100,
      chatMetadata,
    })

    await chat.save()

    // Create analytics directory and save initial data
    try {
      const username = user.email.split('@')[0]
      await createAnalyticsDirectory(username, project.name, chat._id.toString())
      await saveChatData(username, project.name, chat._id.toString(), {
        chatId: chat._id.toString(),
        title: chat.title,
        projectId: project._id.toString(),
        createdAt: chat.createdAt,
        messages: [],
      })
    } catch (error) {
      console.error('Error creating analytics directory:', error)
      // Continue even if directory creation fails
    }

    return NextResponse.json(
      {
        message: 'Chat created successfully',
        chat: {
          id: chat._id.toString(),
          projectId: chat.projectId.toString(),
          title: chat.title,
          messages: chat.messages,
          depth: (chat as any).depth || 100,
          chatMetadata: (chat as any).chatMetadata || {},
          createdAt: chat.createdAt,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating chat:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

