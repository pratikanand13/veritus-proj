import { NextResponse } from 'next/server'
import { getVeritusApiKey } from '@/lib/veritus-auth'
import { createJob } from '@/lib/veritus-api'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobType: string }> }
) {
  try {
    const apiKey = await getVeritusApiKey()
    const { jobType } = await params

    if (!['keywordSearch', 'querySearch', 'combinedSearch'].includes(jobType)) {
      return NextResponse.json(
        { error: 'Invalid job type' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const body = await request.json()

    const jobParams: any = {}
    if (searchParams.get('limit')) {
      const limit = parseInt(searchParams.get('limit')!)
      if ([100, 200, 300].includes(limit)) {
        jobParams.limit = limit as 100 | 200 | 300
      }
    }
    if (searchParams.get('fieldsOfStudy')) {
      jobParams.fieldsOfStudy = searchParams.get('fieldsOfStudy')!.split(',')
    }
    if (searchParams.get('minCitationCount')) {
      jobParams.minCitationCount = parseInt(searchParams.get('minCitationCount')!)
    }
    if (searchParams.get('openAccessPdf')) {
      jobParams.openAccessPdf = searchParams.get('openAccessPdf') === 'true'
    }
    if (searchParams.get('downloadable')) {
      jobParams.downloadable = searchParams.get('downloadable') === 'true'
    }
    if (searchParams.get('quartileRanking')) {
      jobParams.quartileRanking = searchParams.get('quartileRanking')!.split(',')
    }
    if (searchParams.get('publicationTypes')) {
      jobParams.publicationTypes = searchParams.get('publicationTypes')!.split(',')
    }
    if (searchParams.get('sort')) {
      jobParams.sort = searchParams.get('sort')!
    }
    if (searchParams.get('year')) {
      jobParams.year = searchParams.get('year')!
    }

    const result = await createJob(
      { jobType: jobType as any, ...jobParams },
      body,
      { apiKey }
    )

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error creating job:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create job' },
      { status: error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Insufficient') ? 403 : 500 }
    )
  }
}

