import { NextResponse } from 'next/server'
import { getVeritusApiKey } from '@/lib/veritus-auth'
import { getPaper } from '@/lib/veritus-api'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ corpusId: string }> }
) {
  try {
    const apiKey = await getVeritusApiKey()
    const { corpusId } = await params

    if (!corpusId) {
      return NextResponse.json(
        { error: 'Corpus ID is required' },
        { status: 400 }
      )
    }

    const paper = await getPaper(corpusId, { apiKey })

    return NextResponse.json({ paper })
  } catch (error: any) {
    console.error('Error fetching paper:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch paper' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    )
  }
}

