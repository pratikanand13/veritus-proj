import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getVeritusApiKey } from '@/lib/veritus-auth'
import { getJobStatus } from '@/lib/veritus-api'
import { isDebugMode } from '@/lib/config/mock-config'
import { getMockCorpusResponse } from '@/lib/mock-data/mock-data-manager'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { jobId } = await params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    // Check if this is a mock job ID (from DEBUG mode)
    if (jobId.startsWith('mock-job-') || isDebugMode()) {
      // Return mock job status with completed results
      const mockData = getMockCorpusResponse()
      return NextResponse.json({
        status: 'success',
        results: [mockData.paper, ...mockData.similarPapers],
        isMocked: true,
      })
    }

    const apiKey = await getVeritusApiKey()
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

