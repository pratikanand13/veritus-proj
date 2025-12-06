import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Project from '@/models/Project'
import { getCurrentUser } from '@/lib/auth'
import { createAnalyticsDirectory } from '@/lib/file-system'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await connectDB()
    const projects = await Project.find({ userId: user.userId }).sort({ createdAt: -1 })

    // Transform projects to include id field
    const transformedProjects = projects.map(project => ({
      id: project._id.toString(),
      name: project.name,
      description: project.description,
      createdAt: project.createdAt,
    }))

    return NextResponse.json({ projects: transformedProjects })
  } catch (error) {
    console.error('Error fetching projects:', error)
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
    const { name, description } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    // Create project
    const project = new Project({
      userId: user.userId,
      name: name.trim(),
      description: description?.trim() || '',
    })

    await project.save()

    // Create analytics directory
    try {
      await createAnalyticsDirectory(user.email.split('@')[0], name.trim())
    } catch (error) {
      console.error('Error creating analytics directory:', error)
      // Continue even if directory creation fails
    }

    return NextResponse.json(
      {
        message: 'Project created successfully',
        project: {
          id: project._id.toString(),
          name: project.name,
          description: project.description,
          createdAt: project.createdAt,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating project:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

