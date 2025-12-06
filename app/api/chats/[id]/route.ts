import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Chat from '@/models/Chat'
import Project from '@/models/Project'
import { getCurrentUser } from '@/lib/auth'
import { saveChatData } from '@/lib/file-system'
import mongoose from 'mongoose'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await connectDB()

    const { id } = await params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid chat ID' },
        { status: 400 }
      )
    }

    const chat = await Chat.findOne({
      _id: id,
      userId: user.userId,
    }).populate('projectId', 'name')

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      chat: {
        id: chat._id.toString(),
        projectId: chat.projectId.toString(),
        title: chat.title,
        messages: chat.messages,
        depth: (chat as any).depth || 100,
        isFavorite: (chat as any).isFavorite || false,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
    })
  } catch (error) {
    console.error('Error fetching chat:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await connectDB()

    const { id } = await params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid chat ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { title, messages, depth, isFavorite } = body

    const updateData: any = {}
    if (title !== undefined) {
      updateData.title = title.trim()
    }
    if (messages !== undefined) {
      updateData.messages = messages
      updateData.updatedAt = new Date()
    }
    if (depth !== undefined) {
      updateData.depth = Math.max(1, Math.min(500, depth))
      updateData.updatedAt = new Date()
    }
    if (isFavorite !== undefined) {
      updateData.isFavorite = Boolean(isFavorite)
      updateData.updatedAt = new Date()
    }

    const chat = await Chat.findOneAndUpdate(
      {
        _id: id,
        userId: user.userId,
      },
      updateData,
      { new: true }
    ).populate('projectId', 'name')

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    // Update analytics file
    try {
      const project = chat.projectId as any
      const username = user.email.split('@')[0]
      await saveChatData(username, project.name, chat._id.toString(), {
        chatId: chat._id.toString(),
        title: chat.title,
        projectId: chat.projectId.toString(),
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        messages: chat.messages,
      })
    } catch (error) {
      console.error('Error updating analytics file:', error)
      // Continue even if file update fails
    }

    return NextResponse.json({
      message: 'Chat updated successfully',
      chat: {
        id: chat._id.toString(),
        projectId: chat.projectId.toString(),
        title: chat.title,
        messages: chat.messages,
        depth: (chat as any).depth || 100,
        isFavorite: (chat as any).isFavorite || false,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
    })
  } catch (error) {
    console.error('Error updating chat:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await connectDB()

    const { id } = await params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid chat ID' },
        { status: 400 }
      )
    }

    const chat = await Chat.findOneAndDelete({
      _id: id,
      userId: user.userId,
    })

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: 'Chat deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting chat:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

