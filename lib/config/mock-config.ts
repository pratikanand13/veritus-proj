/**
 * Mock configuration utility
 * Centralizes mock mode logic for API calls
 *
 * Single rule:
 * - DEBUG=true  => use mock data
 * - DEBUG=false => use real API
 *
 * A per-request override (mock/isMocked) still wins if provided.
 */

/**
 * Determines if mock mode should be used
 * 
 * Order:
 * 1) Explicit per-request override (mock/isMocked)
 * 2) DEBUG env (true => mock, false => real)
 */
export function shouldUseMockData(isMocked?: boolean): boolean {
  if (isMocked !== undefined) return isMocked
  return process.env.DEBUG === 'true'
}

/**
 * Check if DEBUG mode is enabled
 * @returns true if DEBUG=true in .env
 */
export function isDebugMode(): boolean {
  return process.env.DEBUG === 'true'
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
  return shouldUseMockData()
}

