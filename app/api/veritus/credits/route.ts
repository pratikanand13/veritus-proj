import { NextResponse } from 'next/server'
import { getVeritusApiKey } from '@/lib/veritus-auth'
import { getCredits } from '@/lib/veritus-api'

export async function GET() {
  try {
    const apiKey = await getVeritusApiKey()
    const credits = await getCredits({ apiKey })

    return NextResponse.json(credits)
  } catch (error: any) {
    console.error('Error fetching credits:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch credits' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    )
  }
}

