import { VeritusPaper, VeritusJobResponse, VeritusJobStatus, VeritusCredits } from '@/types/veritus'

const VERITUS_BASE_URL = 'https://discover.veritus.ai/api'
const VERITUS_LOG_ENABLED =
  process.env.VERITUS_API_LOG === 'true' || process.env.DEBUG === 'true'

function logVeritusApi(event: string, payload: Record<string, any>) {
  if (!VERITUS_LOG_ENABLED) return
  try {
    // Avoid logging sensitive data like api keys
    const sanitized = { ...payload }
    delete (sanitized as any).apiKey
    // Trim large arrays to keep logs readable
    if (Array.isArray(sanitized.dataPreview)) {
      sanitized.dataPreview = sanitized.dataPreview.slice(0, 3)
    }
    console.info(`[veritus-api] ${event}`, sanitized)
  } catch (error) {
    console.info(`[veritus-api] ${event} (log failed)`, { error })
  }
}

async function parseJsonSafe(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

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
  const start = Date.now()
  const url = new URL(`${VERITUS_BASE_URL}/v1/papers/search`)
  url.searchParams.set('title', params.title)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
    },
  })

  const json = await parseJsonSafe(response)

  if (!response.ok) {
    logVeritusApi('searchPapers.error', {
      url: url.toString(),
      params,
      status: response.status,
      durationMs: Date.now() - start,
      error: json,
    })
    throw new Error((json as any)?.error || `HTTP ${response.status}`)
  }

  logVeritusApi('searchPapers.success', {
    url: url.toString(),
    params,
    status: response.status,
    durationMs: Date.now() - start,
    total: Array.isArray(json) ? json.length : undefined,
    dataPreview: Array.isArray(json) ? json : json,
  })

  return json as VeritusPaper[]
}

/**
 * Get paper by corpus ID
 */
export async function getPaper(
  corpusId: string,
  options: VeritusApiOptions
): Promise<VeritusPaper> {
  const start = Date.now()
  const response = await fetch(`${VERITUS_BASE_URL}/v1/papers/${corpusId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
    },
  })

  const json = await parseJsonSafe(response)

  if (!response.ok) {
    logVeritusApi('getPaper.error', {
      corpusId,
      status: response.status,
      durationMs: Date.now() - start,
      error: json,
    })
    throw new Error((json as any)?.error || `HTTP ${response.status}`)
  }

  logVeritusApi('getPaper.success', {
    corpusId,
    status: response.status,
    durationMs: Date.now() - start,
    dataPreview: json,
  })

  return json as VeritusPaper
}

/**
 * Create a search job
 */
export async function createJob(
  params: CreateJobParams,
  body: CreateJobBody,
  options: VeritusApiOptions
): Promise<VeritusJobResponse> {
  const start = Date.now()
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

  const json = await parseJsonSafe(response)

  if (!response.ok) {
    logVeritusApi('createJob.error', {
      jobType: params.jobType,
      url: url.toString(),
      params,
      body,
      status: response.status,
      durationMs: Date.now() - start,
      error: json,
    })
    // Extract error message properly to handle various error formats
    let errorMessage = `HTTP ${response.status}`
    if (json) {
      if (typeof json === 'string') {
        errorMessage = json
      } else if (Array.isArray(json)) {
        // Handle array of error objects (e.g., validation errors)
        const errorMessages = json
          .map((e: any) => {
            if (typeof e === 'string') return e
            if (e?.message) return e.message
            if (e?.error) return typeof e.error === 'string' ? e.error : String(e.error)
            return null
          })
          .filter(Boolean)
        errorMessage = errorMessages.length > 0 
          ? errorMessages.join('. ') 
          : 'Validation error occurred'
      } else if ((json as any)?.error) {
        // Handle nested error objects
        if (Array.isArray((json as any).error)) {
          const errorMessages = (json as any).error
            .map((e: any) => {
              if (typeof e === 'string') return e
              if (e?.message) return e.message
              return null
            })
            .filter(Boolean)
          errorMessage = errorMessages.length > 0 
            ? errorMessages.join('. ') 
            : 'Validation error occurred'
        } else {
          errorMessage = typeof (json as any).error === 'string' 
            ? (json as any).error 
            : JSON.stringify((json as any).error)
        }
      } else if ((json as any)?.message) {
        errorMessage = String((json as any).message)
      }
    }
    throw new Error(errorMessage)
  }

  logVeritusApi('createJob.success', {
    jobType: params.jobType,
    url: url.toString(),
    params,
    status: response.status,
    durationMs: Date.now() - start,
    dataPreview: json,
  })

  return json as VeritusJobResponse
}

/**
 * Get job status
 */
export async function getJobStatus(
  jobId: string,
  options: VeritusApiOptions
): Promise<VeritusJobStatus> {
  const start = Date.now()
  const response = await fetch(`${VERITUS_BASE_URL}/v1/job/${jobId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
    },
  })

  const json = await parseJsonSafe(response)

  if (!response.ok) {
    logVeritusApi('getJobStatus.error', {
      jobId,
      status: response.status,
      durationMs: Date.now() - start,
      error: json,
    })
    throw new Error((json as any)?.error || `HTTP ${response.status}`)
  }

  logVeritusApi('getJobStatus.success', {
    jobId,
    status: response.status,
    durationMs: Date.now() - start,
    dataPreview: json,
  })

  return json as VeritusJobStatus
}

/**
 * Get user credits
 */
export async function getCredits(
  options: VeritusApiOptions
): Promise<VeritusCredits> {
  const start = Date.now()
  const response = await fetch(`${VERITUS_BASE_URL}/v1/user/getCredits`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
    },
  })

  const json = await parseJsonSafe(response)

  if (!response.ok) {
    logVeritusApi('getCredits.error', {
      status: response.status,
      durationMs: Date.now() - start,
      error: json,
    })
    throw new Error((json as any)?.error || `HTTP ${response.status}`)
  }

  logVeritusApi('getCredits.success', {
    status: response.status,
    durationMs: Date.now() - start,
    dataPreview: json,
  })

  return json as VeritusCredits
}

