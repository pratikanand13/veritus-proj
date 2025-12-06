/**
 * Mock Data Manager
 * Provides multiple variations of mock data for testing different scenarios
 */

import searchResponse1 from './search-response-1.json'
import searchResponse2 from './search-response-2.json'
import searchResponse3 from './search-response-3.json'
import corpusResponse1 from './corpus-response-1.json'
import corpusResponse2 from './corpus-response-2.json'
import citationNetworkResponse1 from './citation-network-response-1.json'
import citationNetworkResponse2 from './citation-network-response-2.json'
import visualizationResponse from './visualization-response.json'

// Import default mock data (backward compatibility)
import searchResponseDefault from './search-response.json'
import corpusResponseDefault from './corpus-response.json'
import citationNetworkResponseDefault from './citation-network-response.json'

/**
 * Get a random mock search response
 */
export function getMockSearchResponse(variant?: number) {
  const variants = [
    searchResponseDefault,
    searchResponse1,
    searchResponse2,
    searchResponse3,
  ]
  
  if (variant !== undefined && variant >= 0 && variant < variants.length) {
    return variants[variant]
  }
  
  // Return random variant
  const randomIndex = Math.floor(Math.random() * variants.length)
  return variants[randomIndex]
}

/**
 * Get a random mock corpus response
 */
export function getMockCorpusResponse(variant?: number) {
  const variants = [
    corpusResponseDefault,
    corpusResponse1,
    corpusResponse2,
  ]
  
  if (variant !== undefined && variant >= 0 && variant < variants.length) {
    return variants[variant]
  }
  
  // Return random variant
  const randomIndex = Math.floor(Math.random() * variants.length)
  return variants[randomIndex]
}

/**
 * Get a random mock citation network response
 */
export function getMockCitationNetworkResponse(variant?: number) {
  const variants = [
    citationNetworkResponseDefault,
    citationNetworkResponse1,
    citationNetworkResponse2,
  ]
  
  if (variant !== undefined && variant >= 0 && variant < variants.length) {
    return variants[variant]
  }
  
  // Return random variant
  const randomIndex = Math.floor(Math.random() * variants.length)
  return variants[randomIndex]
}

/**
 * Get mock visualization response
 */
export function getMockVisualizationResponse() {
  return visualizationResponse
}

/**
 * Get mock data based on corpusId (deterministic selection)
 */
export function getMockDataByCorpusId(corpusId: string) {
  // Use corpusId to deterministically select variant
  const hash = corpusId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  
  return {
    search: getMockSearchResponse(hash % 4),
    corpus: getMockCorpusResponse(hash % 3),
    citationNetwork: getMockCitationNetworkResponse(hash % 3),
    visualization: getMockVisualizationResponse(),
  }
}

