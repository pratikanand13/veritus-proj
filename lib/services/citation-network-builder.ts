import { Paper } from '@/types/paper-api'
import { calculateEdgeWeight, WeightingMode } from '@/lib/utils/edge-weighting'

interface CitationNetworkNode {
  primaryKey: string
  id: string
  label: string
  citations: number
  references?: number
  year?: number | null
  authors?: string | null
  type: 'root' | 'citing' | 'referenced' | 'both'
  isRoot: boolean
  score?: number | null
  data: Paper
}

interface CitationNetworkEdge {
  source: string
  target: string
  type: 'cites' | 'references'
  weight: number
}

interface CitationNetwork {
  nodes: CitationNetworkNode[]
  edges: CitationNetworkEdge[]
  stats: {
    totalNodes: number
    totalEdges: number
    citingCount: number
    referencedCount: number
  }
}

type SortBy = 'relevance' | 'citations' | 'year'

interface BuildOptions {
  sortBy?: SortBy
  weighting?: WeightingMode
  userInputs?: {
    keywords?: string[]
    authors?: string[]
    references?: string[]
  }
}

/**
 * Sorting algorithms for papers
 */
function sortByRelevance(papers: Paper[]): Paper[] {
  return [...papers].sort((a, b) => (b.score || 0) - (a.score || 0))
}

function sortByCitationCount(papers: Paper[]): Paper[] {
  return [...papers].sort(
    (a, b) => (b.impactFactor?.citationCount || 0) - (a.impactFactor?.citationCount || 0)
  )
}

function sortByPublicationYear(papers: Paper[]): Paper[] {
  return [...papers].sort((a, b) => (b.year || 0) - (a.year || 0))
}

/**
 * Applies sorting algorithm to papers
 */
export function sortPapers(papers: Paper[], sortBy: SortBy = 'relevance'): Paper[] {
  switch (sortBy) {
    case 'citations':
      return sortByCitationCount(papers)
    case 'year':
      return sortByPublicationYear(papers)
    case 'relevance':
    default:
      return sortByRelevance(papers)
  }
}

/**
 * Creates enhanced node with primaryKey and full data
 */
function createNode(
  paper: Paper,
  type: 'root' | 'citing' | 'referenced' | 'both',
  isRoot: boolean = false
): CitationNetworkNode {
  const citations = paper?.impactFactor?.citationCount || 0
  const score = paper.score || 0
  const year = paper.year || null

  // Simple node weight using citations + relevance + mild recency boost
  const currentYear = new Date().getFullYear()
  const recency = year ? Math.max(0, 1 - Math.abs(currentYear - year) / 20) : 0
  const weight = Math.max(0.1, Math.min(3, 1 + citations / 200 + score * 0.5 + recency * 0.5))

  return {
    primaryKey: paper.id,
    id: paper.id,
    label: paper.title,
    citations,
    references: paper?.impactFactor?.referenceCount || 0,
    year,
    authors: paper.authors || null,
    type: type,
    isRoot: isRoot,
    score,
    weight,
    data: {
      ...paper,
    },
  }
}

/**
 * Builds a citation network graph showing:
 * - Papers that cite the main paper (forward citations)
 * - Papers that the main paper cites (references/backward citations)
 * - Connections between papers in the network
 * - Sorted nodes with primaryKey and full data
 *
 * @param mainPaper The main/root paper
 * @param citingPapers Papers that cite the main paper
 * @param referencedPapers Papers that the main paper cites
 * @param sortBy Sorting algorithm: 'relevance' | 'citations' | 'year'
 * @returns Citation network with sorted nodes, edges, and stats
 */
export function buildCitationNetwork(
  mainPaper: Paper,
  citingPapers: Paper[] = [],
  referencedPapers: Paper[] = [],
  sortBy: SortBy = 'relevance',
  options: BuildOptions = {}
): CitationNetwork {
  const weighting = options.weighting || 'balanced'
  const userInputs = options.userInputs || {}

  // Sort papers before building network
  const sortedCitingPapers = sortPapers(citingPapers, sortBy)
  const sortedReferencedPapers = sortPapers(referencedPapers, sortBy)

  // Create root node with full data
  const rootNode = createNode(mainPaper, 'root', true)
  const nodes: CitationNetworkNode[] = [rootNode]
  const edges: CitationNetworkEdge[] = []

  // Add papers that cite the main paper (forward citations)
  sortedCitingPapers.forEach((paper) => {
    const node = createNode(paper, 'citing')
    nodes.push(node)

    const { weight, metadata } = calculateEdgeWeight(paper, mainPaper, {
      weighting,
      keywords: userInputs.keywords,
      authors: userInputs.authors,
      references: userInputs.references,
    })

    edges.push({
      source: paper.id,
      target: mainPaper.id,
      type: 'cites',
      weight,
      metadata,
    })
  })

  // Add papers that the main paper cites (references/backward citations)
  sortedReferencedPapers.forEach((paper) => {
    // Check if node already exists (paper might be both citing and referenced)
    const existingNode = nodes.find((n) => n.id === paper.id)

    if (!existingNode) {
      const node = createNode(paper, 'referenced')
      nodes.push(node)
    } else {
      // Update type if it's both citing and referenced
      existingNode.type = 'both'
    }

    const { weight, metadata } = calculateEdgeWeight(mainPaper, paper, {
      weighting,
      keywords: userInputs.keywords,
      authors: userInputs.authors,
      references: userInputs.references,
    })

    edges.push({
      source: mainPaper.id,
      target: paper.id,
      type: 'references',
      weight,
      metadata,
    })
  })

  return {
    nodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      citingCount: citingPapers.length,
      referencedCount: referencedPapers.length,
    },
  }
}

// Export sorting functions for use in other modules
export { sortByRelevance, sortByCitationCount, sortByPublicationYear }

