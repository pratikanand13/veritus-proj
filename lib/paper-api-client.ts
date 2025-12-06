import {
  SearchPaperRequest,
  SearchPaperResponse,
  CorpusRequest,
  CorpusResponse,
  VisualizationRequest,
  VisualizationResponse,
  CitationNetworkRequest,
  CitationNetworkResponse,
} from '@/types/paper-api'

const BACKEND_BASE_URL = process.env.PAPER_API_BASE_URL || 'http://localhost:3001'

/**
 * Call the backend API at localhost:3001
 */
async function callBackendAPI<T>(
  endpoint: string,
  body: any,
  mock: boolean = false
): Promise<T> {
  if (mock) {
    // In mock mode, we'll read from files (handled by route handlers)
    throw new Error('Mock mode should be handled by route handlers')
  }

  // Ensure proper URL construction (remove double slashes)
  const baseUrl = BACKEND_BASE_URL.replace(/\/+$/, '') // Remove trailing slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}` // Ensure leading slash
  const url = `${baseUrl}${cleanEndpoint}`
  
  console.log('Calling backend API:', url, 'with body:', body)
  
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': '*/*',
      },
      body: JSON.stringify(body),
    })
  } catch (fetchError: any) {
    console.error('Fetch error:', fetchError)
    throw new Error(`Failed to connect to backend at ${url}. ${fetchError.message || 'Please ensure the backend is running at localhost:3001'}`)
  }

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`
    try {
      const errorData = await response.json()
      errorMessage = errorData.error || errorMessage
    } catch {
      // If response is not JSON, try to get text
      try {
        const errorText = await response.text()
        errorMessage = errorText || errorMessage
      } catch {
        // Keep default error message
      }
    }
    throw new Error(errorMessage)
  }

  return response.json()
}

/**
 * Search for a paper by title or corpusId
 */
export async function searchPaper(
  params: SearchPaperRequest
): Promise<SearchPaperResponse> {
  const { mock, ...requestBody } = params
  
  if (mock) {
    // If mock is true, pass it to backend (backend handles mock mode)
    return callBackendAPI<SearchPaperResponse>(
      '/api/paper/search',
      { ...requestBody, mock: true },
      false
    )
  }

  return callBackendAPI<SearchPaperResponse>(
    '/api/paper/search',
    requestBody,
    false
  )
}

/**
 * Get semantically similar papers (corpus search)
 */
export async function getCorpus(
  params: CorpusRequest
): Promise<CorpusResponse> {
  const { mock, ...requestBody } = params
  
  if (mock) {
    // If mock is true, pass it to backend (backend handles mock mode)
    return callBackendAPI<CorpusResponse>(
      '/api/paper/corpus',
      { ...requestBody, mock: true },
      false
    )
  }

  return callBackendAPI<CorpusResponse>(
    '/api/paper/corpus',
    requestBody,
    false
  )
}

/**
 * Get semantic similarity visualization graph
 */
export async function getVisualization(
  params: VisualizationRequest
): Promise<VisualizationResponse> {
  const { mock, ...requestBody } = params
  
  if (mock) {
    throw new Error('Mock mode should be handled by route handlers')
  }

  return callBackendAPI<VisualizationResponse>(
    '/api/paper/visualization',
    requestBody,
    false
  )
}

/**
 * Get citation network visualization
 */
export async function getCitationNetwork(
  params: CitationNetworkRequest
): Promise<CitationNetworkResponse> {
  const { mock, ...requestBody } = params
  
  if (mock) {
    // If mock is true, pass it to backend (backend handles mock mode)
    return callBackendAPI<CitationNetworkResponse>(
      '/api/paper/citation-network',
      { ...requestBody, mock: true },
      false
    )
  }

  return callBackendAPI<CitationNetworkResponse>(
    '/api/paper/citation-network',
    requestBody,
    false
  )
}

