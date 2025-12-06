/**
 * API helper utilities
 * Provides reusable functions for common API call patterns
 */

import { shouldUseMockData } from '@/lib/config/mock-config'

/**
 * Standard API request configuration
 */
export interface ApiRequestConfig {
  endpoint: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
  headers?: Record<string, string>
  isMocked?: boolean
}

/**
 * Makes a standardized API request with error handling
 * @param config Request configuration
 * @returns Response data
 */
export async function apiRequest<T>(config: ApiRequestConfig): Promise<T> {
  const { endpoint, method = 'POST', body, headers = {}, isMocked } = config

  // Determine mock mode
  const useMock = isMocked !== undefined ? isMocked : shouldUseMockData()

  // Prepare request body with mock flag
  const requestBody = body
    ? {
        ...body,
        isMocked: useMock,
      }
    : undefined

  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: requestBody ? JSON.stringify(requestBody) : undefined,
    })

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
  } catch (error: any) {
    // Enhance error message with context
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      throw new Error(`Network error: Unable to connect to server. ${error.message}`)
    }
    throw error
  }
}

/**
 * Validates paper search input
 * @param title Optional title
 * @param corpusId Optional corpus ID
 * @throws Error if validation fails
 */
export function validatePaperSearchInput(title?: string, corpusId?: string): void {
  if (!title && !corpusId) {
    throw new Error('Either title or corpusId is required')
  }

  if (title && title.trim().length < 3) {
    throw new Error('Title must be at least 3 characters long')
  }

  if (corpusId && !corpusId.trim().startsWith('corpus:')) {
    throw new Error('Corpus ID must start with "corpus:"')
  }
}

/**
 * Validates corpus request input
 * @param corpusId Corpus ID
 * @throws Error if validation fails
 */
export function validateCorpusInput(corpusId: string): void {
  if (!corpusId || !corpusId.trim()) {
    throw new Error('corpusId is required')
  }

  if (!corpusId.trim().startsWith('corpus:')) {
    throw new Error('Corpus ID must start with "corpus:"')
  }
}

/**
 * Validates citation network request input
 * @param corpusId Corpus ID
 * @param depth Optional depth
 * @throws Error if validation fails
 */
export function validateCitationNetworkInput(corpusId: string, depth?: number): void {
  if (!corpusId || !corpusId.trim()) {
    throw new Error('corpusId is required')
  }

  if (!corpusId.trim().startsWith('corpus:')) {
    throw new Error('Corpus ID must start with "corpus:"')
  }

  if (depth !== undefined && (depth < 1 || depth > 300)) {
    throw new Error('Depth must be between 1 and 300')
  }
}

