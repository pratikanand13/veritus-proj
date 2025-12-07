export interface VeritusPaper {
  abstract: string | null
  authors: string
  doi: string | null
  downloadable: boolean
  engine?: string
  fieldsOfStudy: string[]
  id: string
  impactFactor: {
    citationCount: number
    influentialCitationCount: number
    referenceCount: number
  }
  isOpenAccess?: boolean
  isPrePrint?: boolean
  journalName: string | null
  link?: string
  pdfLink?: string | null
  publicationType: string | null
  publishedAt: string | null
  score?: number | null
  semanticLink?: string
  title: string
  titleLink?: string
  tldr: string | null
  v_country?: string | null
  v_journal_name?: string | null
  v_publisher?: string | null
  v_quartile_ranking?: string | null
  year: number | null
}

export interface VeritusJobResponse {
  jobId: string
}

export interface VeritusJobStatus {
  status: 'queued' | 'processing' | 'success' | 'error'
  results?: VeritusPaper[]
}

export interface VeritusCredits {
  proTierCreditsBalance: number
  proTierCreditsTotal: number
  freeTierCreditsBalance: number
  freeTierCreditsTotal: number
  plan: string
}

export interface CitationNetworkNode {
  id: string
  paper: VeritusPaper
  x?: number
  y?: number
  vx?: number
  vy?: number
}

export interface CitationNetworkEdge {
  source: string
  target: string
  type: 'cites' | 'cited_by'
}

export interface CitationNetwork {
  nodes: CitationNetworkNode[]
  edges: CitationNetworkEdge[]
  metadata: {
    createdAt: Date
    paperIds: string[]
  }
}

