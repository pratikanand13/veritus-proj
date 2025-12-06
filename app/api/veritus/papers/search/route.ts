import { NextResponse } from 'next/server'
import { getVeritusApiKey } from '@/lib/veritus-auth'
import { searchPapers } from '@/lib/veritus-api'

export async function GET(request: Request) {
  try {
    const apiKey = await getVeritusApiKey()
    const { searchParams } = new URL(request.url)
    const title = searchParams.get('title')

    if (!title) {
      return NextResponse.json(
        { error: 'Title parameter is required' },
        { status: 400 }
      )
    }

    const papers = await searchPapers({ title }, { apiKey })

    return NextResponse.json({ papers })
  } catch (error: any) {
    console.error('Error searching papers:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to search papers' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    )
  }
}

