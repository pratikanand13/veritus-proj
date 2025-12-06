// Paper API types matching FRONTEND_INTEGRATION_GUIDE.md

import { VeritusPaper } from './veritus'

// Re-export Paper type (using VeritusPaper as base)
export type Paper = VeritusPaper

// Graph types for semantic similarity visualization
export interface GraphNode {
  id: string
  label: string
  citations: number
  isRoot?: boolean
}

export interface GraphEdge {
  source: string
  target: string
  weight: number
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// Citation Network types (matching guide structure)
export interface CitationNetworkNode {
  primaryKey?: string
  id: string
  label: string
  citations: number
  references?: number
  isRoot?: boolean
  type: 'root' | 'citing' | 'referenced' | 'both'
  year: number | null
  authors: string | null
  score?: number | null
  data?: Paper
  /**
   * Optional node weight (importance) derived from citations/relevance/recency/overlap
   */
  weight?: number
}

export interface CitationNetworkEdge {
  source: string
  target: string
  type: 'cites' | 'references'
  weight: number
  /**
   * Optional metadata describing why this edge is strong
   */
  metadata?: {
    sharedKeywords?: string[]
    sharedAuthors?: string[]
    similarityScore?: number
    chatHistoryBoost?: number
  }
}

export interface CitationNetwork {
  nodes: CitationNetworkNode[]
  edges: CitationNetworkEdge[]
  stats: {
    totalNodes: number
    totalEdges: number
    citingCount: number
    referencedCount: number
  }
  tree?: {
    root: Paper
    levels: Array<{
      level: number
      nodes: Paper[]
      description: string
    }>
    relationships: {
      [paperId: string]: {
        parent: string | null
        children: string[]
      }
    }
  }
}

// Meta information
export interface Meta {
  phrases?: string[]
  query?: string
  depth?: number
  networkType?: string
  mode?: 'simple' | 'full'
  sortBy?: 'relevance' | 'citations' | 'year'
  weighting?: 'balanced' | 'citations' | 'recency' | 'keywords'
  userInputs?: {
    keywords?: string[]
    authors?: string[]
    references?: string[]
  }
}

// Request types
export interface SearchPaperRequest {
  title?: string
  corpusId?: string
  chatId?: string
  mock?: boolean
  isMocked?: boolean // Alias for mock, preferred field name
}

export interface CorpusRequest {
  corpusId: string
  depth?: number
  chatId?: string
  mock?: boolean
  isMocked?: boolean // Alias for mock, preferred field name
}

export interface VisualizationRequest {
  corpusId: string
  depth?: number
  chatId?: string
  mock?: boolean
  isMocked?: boolean // Alias for mock, preferred field name
}

export interface CitationNetworkRequest {
  corpusId: string
  depth?: number
  chatId?: string
  simple?: boolean
  sortBy?: 'relevance' | 'citations' | 'year'
  weighting?: 'balanced' | 'citations' | 'recency' | 'keywords'
  keywords?: string[]
  authors?: string[]
  references?: string[]
  mock?: boolean
  isMocked?: boolean // Alias for mock, preferred field name
}

// Response types
export interface SearchPaperResponse {
  paper: Paper
  message?: string
  isMocked?: boolean // Indicates if response came from mock data
}

export interface CorpusResponse {
  paper: Paper
  similarPapers: Paper[]
  meta: {
    phrases: string[]
    query: string
    depth: number
  }
  isMocked?: boolean // Indicates if response came from mock data
}

export interface VisualizationResponse {
  paper: Paper
  similarPapers: Paper[]
  graph: Graph
  meta: {
    phrases: string[]
    query: string
    depth: number
  }
  isMocked?: boolean // Indicates if response came from mock data
}

export interface CitationNetworkResponse {
  paper: Paper
  citationNetwork?: CitationNetwork
  searchResults?: Paper[]
  graph?: Graph
  similarPapers?: Paper[]
  meta: {
    networkType?: string
    depth: number
    mode?: 'simple' | 'full'
    sortBy?: 'relevance' | 'citations' | 'year'
    weighting?: 'balanced' | 'citations' | 'recency' | 'keywords'
    phrases?: string[]
    query?: string
    userInputs?: {
      keywords?: string[]
      authors?: string[]
      references?: string[]
    }
  }
  isMocked?: boolean // Indicates if response came from mock data
}

// Filter request/response types
export interface CitationNetworkFilterRequest {
  citationNetwork: CitationNetwork
  filters?: {
    minCitations?: number
    maxCitations?: number
    minYear?: number
    maxYear?: number
    types?: ('root' | 'citing' | 'referenced' | 'both')[]
    authors?: string[]
    fieldsOfStudy?: string[]
  }
  sortBy?: 'relevance' | 'citations' | 'year'
  limit?: number
}

export interface CitationNetworkFilterResponse {
  citationNetwork: CitationNetwork
  meta: {
    filters?: {
      minCitations?: number
      maxCitations?: number
      minYear?: number
      maxYear?: number
      types?: ('root' | 'citing' | 'referenced' | 'both')[]
      authors?: string[]
      fieldsOfStudy?: string[]
    }
    sortBy: 'relevance' | 'citations' | 'year'
    originalCount: number
    filteredCount: number
    limit: number | null
  }
}

