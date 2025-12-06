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
    const { projectId, title, depth } = body

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

    // Create chat with initialized metadata
    const chat = new Chat({
      projectId,
      userId: user.userId,
      title: title.trim(),
      messages: [],
      depth: depth !== undefined ? Math.max(1, Math.min(500, depth)) : 100,
      chatMetadata: {
        authors: [],
        keywords: [],
        abstracts: [],
        tldrs: [],
        publicationTypes: [],
        publishedDates: [],
        quartileRankings: [],
        journalNames: [],
        citationCounts: [],
      },
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

