import { NextResponse } from 'next/server'
import { getVeritusApiKey } from '@/lib/veritus-auth'
import { getJobStatus } from '@/lib/veritus-api'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const apiKey = await getVeritusApiKey()
    const { jobId } = await params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    const status = await getJobStatus(jobId, { apiKey })

    return NextResponse.json(status)
  } catch (error: any) {
    console.error('Error fetching job status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch job status' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    )
  }
}

