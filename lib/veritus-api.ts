import { VeritusPaper, VeritusJobResponse, VeritusJobStatus, VeritusCredits } from '@/types/veritus'

const VERITUS_BASE_URL = 'https://discover.veritus.ai/api'

export interface VeritusApiOptions {
  apiKey: string
}

export interface SearchPapersParams {
  title: string
}

export interface CreateJobParams {
  jobType: 'keywordSearch' | 'querySearch' | 'combinedSearch'
  limit?: 100 | 200 | 300
  fieldsOfStudy?: string[]
  minCitationCount?: number
  openAccessPdf?: boolean
  downloadable?: boolean
  quartileRanking?: string[]
  publicationTypes?: string[]
  sort?: string
  year?: string
}

export interface CreateJobBody {
  callbackUrl?: string
  enrich?: boolean
  phrases?: string[]
  query?: string
}

/**
 * Search papers by title
 */
export async function searchPapers(
  params: SearchPapersParams,
  options: VeritusApiOptions
): Promise<VeritusPaper[]> {
  const url = new URL(`${VERITUS_BASE_URL}/v1/papers/search`)
  url.searchParams.set('title', params.title)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

/**
 * Get paper by corpus ID
 */
export async function getPaper(
  corpusId: string,
  options: VeritusApiOptions
): Promise<VeritusPaper> {
  const response = await fetch(`${VERITUS_BASE_URL}/v1/papers/${corpusId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

/**
 * Create a search job
 */
export async function createJob(
  params: CreateJobParams,
  body: CreateJobBody,
  options: VeritusApiOptions
): Promise<VeritusJobResponse> {
  const url = new URL(`${VERITUS_BASE_URL}/v1/job/${params.jobType}`)

  // Add query parameters
  if (params.limit) url.searchParams.set('limit', params.limit.toString())
  if (params.fieldsOfStudy) url.searchParams.set('fieldsOfStudy', params.fieldsOfStudy.join(','))
  if (params.minCitationCount) url.searchParams.set('minCitationCount', params.minCitationCount.toString())
  if (params.openAccessPdf !== undefined) url.searchParams.set('openAccessPdf', params.openAccessPdf.toString())
  if (params.downloadable !== undefined) url.searchParams.set('downloadable', params.downloadable.toString())
  if (params.quartileRanking) url.searchParams.set('quartileRanking', params.quartileRanking.join(','))
  if (params.publicationTypes) url.searchParams.set('publicationTypes', params.publicationTypes.join(','))
  if (params.sort) url.searchParams.set('sort', params.sort)
  if (params.year) url.searchParams.set('year', params.year)

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

/**
 * Get job status
 */
export async function getJobStatus(
  jobId: string,
  options: VeritusApiOptions
): Promise<VeritusJobStatus> {
  const response = await fetch(`${VERITUS_BASE_URL}/v1/job/${jobId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

/**
 * Get user credits
 */
export async function getCredits(
  options: VeritusApiOptions
): Promise<VeritusCredits> {
  const response = await fetch(`${VERITUS_BASE_URL}/v1/user/getCredits`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

