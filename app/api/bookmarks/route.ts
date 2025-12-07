import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { extractKeywords } from '@/lib/utils/keyword-extractor'
import { VeritusPaper } from '@/types/veritus'

/**
 * GET /api/bookmarks
 * Get all bookmarks for the current user
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const dbUser = await User.findById(user.userId)
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      bookmarks: dbUser.bookmarks || [],
    })
  } catch (error: any) {
    console.error('Error fetching bookmarks:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch bookmarks' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/bookmarks
 * Add a bookmark for the current user
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const body = await request.json()
    const { paperId, paper } = body

    if (!paperId || !paper) {
      return NextResponse.json(
        { error: 'paperId and paper are required' },
        { status: 400 }
      )
    }

    const dbUser = await User.findById(user.userId)
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if already bookmarked
    const existingBookmark = dbUser.bookmarks?.find(
      (b: any) => b.paperId === paperId
    )
    if (existingBookmark) {
      return NextResponse.json(
        { error: 'Paper already bookmarked' },
        { status: 400 }
      )
    }

    // Extract keywords from TLDR and metadata
    const keywords = extractKeywords(paper as VeritusPaper)

    // Create bookmark
    const bookmark = {
      paperId,
      title: paper.title || 'Untitled',
      tldr: paper.tldr,
      authors: paper.authors,
      keywords,
      bookmarkedAt: new Date(),
    }

    dbUser.bookmarks = dbUser.bookmarks || []
    dbUser.bookmarks.push(bookmark)
    await dbUser.save()

    return NextResponse.json({
      message: 'Paper bookmarked successfully',
      bookmark,
    })
  } catch (error: any) {
    console.error('Error bookmarking paper:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to bookmark paper' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/bookmarks
 * Remove a bookmark for the current user
 */
export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const { searchParams } = new URL(request.url)
    const paperId = searchParams.get('paperId')

    if (!paperId) {
      return NextResponse.json(
        { error: 'paperId is required' },
        { status: 400 }
      )
    }

    const dbUser = await User.findById(user.userId)
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    dbUser.bookmarks = dbUser.bookmarks?.filter(
      (b: any) => b.paperId !== paperId
    ) || []
    await dbUser.save()

    return NextResponse.json({
      message: 'Bookmark removed successfully',
    })
  } catch (error: any) {
    console.error('Error removing bookmark:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove bookmark' },
      { status: 500 }
    )
  }
}

