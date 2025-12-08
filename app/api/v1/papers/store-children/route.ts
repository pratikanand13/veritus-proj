import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import connectDB from '@/lib/db'
import Chat from '@/models/Chat'
import mongoose from 'mongoose'

/**
 * POST /api/v1/papers/store-children
 * Store parent→child relationships in chatstore
 * 
 * Body:
 * - paperId: Parent paper ID
 * - childPapers: Array of {id, title, sourceParentId, paper?} where paper is full VeritusPaper object
 * - chatId: Chat ID (query parameter)
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const chatId = searchParams.get('chatId')

    if (!chatId) {
      return NextResponse.json(
        { error: 'chatId query parameter is required' },
        { status: 400 }
      )
    }

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return NextResponse.json(
        { error: 'Invalid chatId format' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { paperId, childPapers } = body

    if (!paperId || !Array.isArray(childPapers)) {
      return NextResponse.json(
        { error: 'paperId and childPapers array are required' },
        { status: 400 }
      )
    }

    await connectDB()

    // Fetch chat by chatId and userId (security)
    const chat = await Chat.findOne({
      _id: chatId,
      userId: user.userId,
    })

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    // Initialize chatMetadata if it doesn't exist
    if (!chat.chatMetadata) {
      chat.chatMetadata = {}
    }

    // Initialize paperRelationships if it doesn't exist
    if (!chat.chatMetadata.paperRelationships) {
      chat.chatMetadata.paperRelationships = {}
    }

    // Store parent→child relationship
    // Format: { paperId: { childPapers: [{id, title, sourceParentId, paper?}] } }
    // where paper is the full VeritusPaper object for consistent datastore
    
    // CRITICAL: Normalize paperId to ensure consistent key format
    // Convert to string and remove prefixes to ensure consistent key format
    let normalizedPaperId = String(paperId).replace('corpus:', '').replace('paper-', '').replace('root-', '').trim()
    
    const relationships = chat.chatMetadata.paperRelationships as any
    
    // Use normalized paperId as key
    if (!relationships[normalizedPaperId]) {
      relationships[normalizedPaperId] = { childPapers: [] }
    }

    // Merge new child papers (prevent duplicates)
    // CRITICAL: Use normalizedPaperId for all lookups
    const existingChildIds = new Set(
      (relationships[normalizedPaperId].childPapers || []).map((cp: any) => cp.id)
    )

    // Add only new children (max 3 total per parent)
    const existingCount = (relationships[normalizedPaperId].childPapers || []).length
    const maxToAdd = 3 - existingCount
    
    // Process child papers - ensure full paper data is preserved
    const processedChildPapers = childPapers.map((cp: any) => {
      // Normalize ID
      const normalizedId = cp.id?.toString().replace('corpus:', '').replace('paper-', '').replace('root-', '').trim() || cp.id
      return {
        id: normalizedId,
        title: cp.title || 'Unknown',
        sourceParentId: cp.sourceParentId || paperId,
        // Preserve full paper data if provided
        paper: cp.paper || null,
      }
    })
    
    const newChildren = processedChildPapers
      .filter((cp: any) => !existingChildIds.has(cp.id))
      .slice(0, maxToAdd)

    if (newChildren.length > 0) {
      // Store children with full paper data
      // CRITICAL: Use normalizedPaperId for storage
      relationships[normalizedPaperId].childPapers = [
        ...(relationships[normalizedPaperId].childPapers || []),
        ...newChildren,
      ].slice(0, 3) // Enforce max 3 children

      chat.chatMetadata.paperRelationships = relationships
      chat.updatedAt = new Date()
      
      // CRITICAL: Mark nested object as modified for Mongoose to save it
      chat.markModified('chatMetadata')
      chat.markModified('chatMetadata.paperRelationships')
      
      await chat.save()
      
      const totalChildren = relationships[normalizedPaperId].childPapers.length
      
      return NextResponse.json({
        success: true,
        message: `Stored ${newChildren.length} child papers for parent ${normalizedPaperId}`,
        totalChildren: totalChildren,
        storedKey: normalizedPaperId, // Return the key used for storage
      })
    } else {
      return NextResponse.json({
        success: true,
        message: 'No new children to store (duplicates or max reached)',
        totalChildren: relationships[normalizedPaperId].childPapers?.length || 0,
        storedKey: normalizedPaperId,
      })
    }
  } catch (error: any) {
    console.error('Error storing parent→child relationship:', error)
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/v1/papers/store-children
 * Retrieve parent→child relationships from chatstore
 * 
 * Query Parameters:
 * - chatId: Chat ID (required)
 * - paperId: Parent paper ID (optional, if not provided returns all relationships)
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
    const chatId = searchParams.get('chatId')
    const paperId = searchParams.get('paperId')

    if (!chatId) {
      return NextResponse.json(
        { error: 'chatId query parameter is required' },
        { status: 400 }
      )
    }

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return NextResponse.json(
        { error: 'Invalid chatId format' },
        { status: 400 }
      )
    }

    await connectDB()

    // Fetch chat by chatId and userId (security)
    const chat = await Chat.findOne({
      _id: chatId,
      userId: user.userId,
    })

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    const relationships = (chat.chatMetadata?.paperRelationships as any) || {}

    if (paperId) {
      // Normalize paperId to match storage format (remove prefixes)
      // CRITICAL: Convert to string to ensure type consistency
      let normalizedPaperId = String(paperId).replace('corpus:', '').replace('paper-', '').replace('root-', '').trim()
      
      // Try both normalized and original formats
      let paperRelationships = relationships[normalizedPaperId] || relationships[paperId] || null
      
      if (!paperRelationships) {
        // Try all possible formats
        const allKeys = Object.keys(relationships)
        for (const key of allKeys) {
          const normalizedKey = String(key).replace('corpus:', '').replace('paper-', '').replace('root-', '').trim()
          if (normalizedKey === normalizedPaperId || key === normalizedPaperId || key === paperId) {
            paperRelationships = relationships[key]
            break
          }
        }
      }
      
      let childPapers = paperRelationships?.childPapers || []
      
      // If no children found with normalized key, try original paperId
      if (childPapers.length === 0 && paperId !== normalizedPaperId) {
        const originalRelationships = relationships[paperId]
        if (originalRelationships) {
          childPapers = originalRelationships.childPapers || []
        }
      }
      
      // If still no children, try all keys to find a match
      if (childPapers.length === 0) {
        const allKeys = Object.keys(relationships)
        for (const key of allKeys) {
          const normalizedKey = String(key).replace('corpus:', '').replace('paper-', '').replace('root-', '').trim()
          if (normalizedKey === normalizedPaperId || key === normalizedPaperId || key === paperId) {
            childPapers = relationships[key]?.childPapers || []
            break
          }
        }
      }
      
      return NextResponse.json({
        paperId: normalizedPaperId,
        childPapers: childPapers,
      })
    } else {
      // Return all relationships
      return NextResponse.json({
        relationships,
      })
    }
  } catch (error: any) {
    console.error('Error retrieving parent→child relationships:', error)
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

