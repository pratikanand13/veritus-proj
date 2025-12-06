import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import connectDB from '@/lib/db'
import Chat from '@/models/Chat'
import { saveCitationNetwork } from '@/lib/file-system'
import mongoose from 'mongoose'

export async function POST(
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

    const body = await request.json()
    const { networkId, citationNetwork } = body

    if (!networkId || !citationNetwork) {
      return NextResponse.json(
        { error: 'networkId and citationNetwork are required' },
        { status: 400 }
      )
    }

    const username = user.email.split('@')[0]
    const project = chat.projectId as any

    await saveCitationNetwork(
      username,
      project.name,
      chat._id.toString(),
      networkId,
      citationNetwork
    )

    return NextResponse.json({
      message: 'Citation network saved successfully',
    })
  } catch (error: any) {
    console.error('Error saving citation network:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


