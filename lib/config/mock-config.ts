/**
 * Mock configuration utility
 * Centralizes mock mode logic for API calls
 * Supports both `mock` and `isMocked` fields for backward compatibility
 * 
 * IMPORTANT: Mock mode is automatically disabled when VERITUS_API_KEY is present
 */

/**
 * Determines if mock mode should be used
 * Checks environment variable first, then falls back to provided flag
 * 
 * Priority:
 * 1. NEXT_PUBLIC_USE_MOCK_DATA environment variable (if explicitly set)
 * 2. Provided isMocked flag
 * 3. VERITUS_API_KEY presence (if key exists, disable mocks)
 * 4. Default behavior
 * 
 * @param isMocked - Optional flag to force mock mode
 * @returns true if mock mode should be used
 */
export function shouldUseMockData(isMocked?: boolean): boolean {
  // Check environment variable first (for global mock mode override)
  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
    return true
  }
  
  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'false') {
    return false
  }
  
  // Check provided flag
  if (isMocked !== undefined) {
    return isMocked
  }
  
  // Server-side: Check if VERITUS_API_KEY is present
  // If API key exists, disable mock mode by default
  if (typeof window === 'undefined') {
    // Server-side execution
    const hasApiKey = process.env.VERITUS_API_KEY && process.env.VERITUS_API_KEY.trim() !== ''
    if (hasApiKey) {
      // API key present - disable mock mode
      return false
    }
    // No API key - use mock mode
    return true
  }
  
  // Client-side: default to mock mode since VERITUS_API_KEY is server-only
  // Client can't check server env vars, so default to mock
  return true
}

/**
 * Normalizes mock flag from request
 * Handles both `mock` and `isMocked` fields for backward compatibility
 * @param params - Request parameters that may contain mock flag
 * @returns normalized mock flag
 */
export function normalizeMockFlag(params: { mock?: boolean; isMocked?: boolean }): boolean {
  // Prefer isMocked if provided, fall back to mock
  if (params.isMocked !== undefined) {
    return params.isMocked
  }
  if (params.mock !== undefined) {
    return params.mock
  }
  // Default to environment-based decision
  // Use mock data if VERITUS_API_KEY is not set
  return shouldUseMockData()
}

