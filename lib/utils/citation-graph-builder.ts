import { VeritusPaper } from '@/types/veritus'
import { CitationNetwork, CitationNetworkNode, CitationNetworkEdge, GraphOptions, Paper } from '@/types/paper-api'

/**
 * Filter papers based on GraphOptions filters
 */
function filterPapers(papers: VeritusPaper[], filters?: GraphOptions['filters']): VeritusPaper[] {
  if (!filters) return papers

  return papers.filter((paper) => {
    // Citation count filter
    const citations = paper.impactFactor?.citationCount || 0
    if (filters.minCitations !== undefined && citations < filters.minCitations) return false
    if (filters.maxCitations !== undefined && citations > filters.maxCitations) return false

    // Year filter
    if (paper.year !== null && paper.year !== undefined) {
      if (filters.minYear !== undefined && paper.year < filters.minYear) return false
      if (filters.maxYear !== undefined && paper.year > filters.maxYear) return false
    }

    // Fields of study filter
    if (filters.fieldsOfStudy && filters.fieldsOfStudy.length > 0) {
      const paperFields = (paper.fieldsOfStudy || []).map((f) => f.toLowerCase())
      const filterFields = filters.fieldsOfStudy.map((f) => f.toLowerCase())
      const hasMatchingField = paperFields.some((f) => filterFields.includes(f))
      if (!hasMatchingField) return false
    }

    // Authors filter
    if (filters.authors && filters.authors.length > 0) {
      const paperAuthors = (paper.authors || '')
        .split(',')
        .map((a) => a.trim().toLowerCase())
      const filterAuthors = filters.authors.map((a) => a.toLowerCase())
      const hasMatchingAuthor = paperAuthors.some((a) => filterAuthors.includes(a))
      if (!hasMatchingAuthor) return false
    }

    // Publication types filter
    if (filters.publicationTypes && filters.publicationTypes.length > 0) {
      const paperType = (paper.publicationType || '').toLowerCase()
      const filterTypes = filters.publicationTypes.map((t) => t.toLowerCase())
      if (!filterTypes.includes(paperType)) return false
    }

    return true
  })
}

/**
 * Sort papers based on sortBy and sortOrder
 */
function sortPapers(
  papers: VeritusPaper[],
  sortBy: GraphOptions['sortBy'] = 'relevance',
  sortOrder: GraphOptions['sortOrder'] = 'desc'
): VeritusPaper[] {
  const sorted = [...papers]

  switch (sortBy) {
    case 'citations':
      sorted.sort((a, b) => {
        const citationsA = a.impactFactor?.citationCount || 0
        const citationsB = b.impactFactor?.citationCount || 0
        return sortOrder === 'asc' ? citationsA - citationsB : citationsB - citationsA
      })
      break
    case 'year':
      sorted.sort((a, b) => {
        const yearA = a.year || 0
        const yearB = b.year || 0
        return sortOrder === 'asc' ? yearA - yearB : yearB - yearA
      })
      break
    case 'title':
      sorted.sort((a, b) => {
        const titleA = (a.title || '').toLowerCase()
        const titleB = (b.title || '').toLowerCase()
        const comparison = titleA.localeCompare(titleB)
        return sortOrder === 'asc' ? comparison : -comparison
      })
      break
    case 'relevance':
    default:
      sorted.sort((a, b) => {
        const scoreA = a.score || 0
        const scoreB = b.score || 0
        return sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA
      })
      break
  }

  return sorted
}

/**
 * Create a paper node
 */
function createPaperNode(
  paper: VeritusPaper,
  isRoot: boolean = false,
  level: number = 1
): CitationNetworkNode {
  const citations = paper.impactFactor?.citationCount || 0
  const score = paper.score || 0
  const year = paper.year || null
  const authors = paper.authors || null

  const paperData: Paper & { sourcePaperId: string } = {
    ...paper,
    sourcePaperId: paper.id, // Track which paper this node came from
  }

  return {
    primaryKey: paper.id,
    id: isRoot ? `root-${paper.id}` : `paper-${paper.id}`,
    label: paper.title,
    citations,
    references: paper.impactFactor?.referenceCount || 0,
    isRoot,
    type: isRoot ? 'root' : 'both',
    year,
    authors,
    score,
    data: paperData,
    nodeType: 'paper',
    level,
    weight: 1.0,
  }
}

/**
 * Create a keyword child node
 */
function createKeywordNode(
  keyword: string,
  paperId: string,
  paperTitle: string
): CitationNetworkNode {
  return {
    id: `keyword-${paperId}-${keyword.toLowerCase().replace(/\s+/g, '-')}`,
    label: keyword,
    citations: 0,
    isRoot: false,
    type: 'both',
    year: null,
    authors: null,
    parentId: `paper-${paperId}`,
    nodeType: 'keyword',
    level: 2,
    weight: 1.0,
    data: {
      id: `keyword-${paperId}-${keyword}`,
      title: `${paperTitle} - ${keyword}`,
      sourcePaperId: paperId, // Track which paper this node came from
    } as any,
  }
}

/**
 * Create a TLDR child node
 */
function createTldrNode(paperId: string, paperTitle: string, tldr: string): CitationNetworkNode {
  return {
    id: `tldr-${paperId}`,
    label: 'TLDR',
    citations: 0,
    isRoot: false,
    type: 'both',
    year: null,
    authors: null,
    parentId: `paper-${paperId}`,
    nodeType: 'tldr',
    level: 2,
    weight: 1.0,
    data: {
      id: `tldr-${paperId}`,
      title: `${paperTitle} - TLDR`,
      abstract: tldr,
      sourcePaperId: paperId, // Track which paper this node came from
    } as any,
  }
}

/**
 * Create an author child node
 */
function createAuthorNode(
  author: string,
  paperId: string,
  paperTitle: string,
  authorIndex: number
): CitationNetworkNode {
  return {
    id: `author-${paperId}-${authorIndex}`,
    label: author.trim(),
    citations: 0,
    isRoot: false,
    type: 'both',
    year: null,
    authors: author.trim(),
    parentId: `paper-${paperId}`,
    nodeType: 'author',
    level: 2,
    weight: 1.0,
    data: {
      id: `author-${paperId}-${authorIndex}`,
      title: `${paperTitle} - ${author.trim()}`,
      authors: author.trim(),
      sourcePaperId: paperId, // Track which paper this node came from
    } as any,
  }
}

/**
 * Calculate shared attributes between two papers
 */
function calculateSharedAttributes(paper1: VeritusPaper, paper2: VeritusPaper): number {
  let sharedCount = 0

  // Shared keywords (fieldsOfStudy)
  const fields1 = new Set((paper1.fieldsOfStudy || []).map((f) => f.toLowerCase()))
  const fields2 = new Set((paper2.fieldsOfStudy || []).map((f) => f.toLowerCase()))
  const sharedFields = [...fields1].filter((f) => fields2.has(f))
  sharedCount += sharedFields.length

  // Shared authors
  const authors1 = new Set(
    (paper1.authors || '')
      .split(',')
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean)
  )
  const authors2 = new Set(
    (paper2.authors || '')
      .split(',')
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean)
  )
  const sharedAuthors = [...authors1].filter((a) => authors2.has(a))
  sharedCount += sharedAuthors.length

  // Shared TLDR similarity (simple check if both have TLDR)
  if (paper1.tldr && paper2.tldr) {
    // Simple similarity: check if TLDRs share common words
    const tldr1Words = new Set(
      paper1.tldr
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
    )
    const tldr2Words = new Set(
      paper2.tldr
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
    )
    const sharedWords = [...tldr1Words].filter((w) => tldr2Words.has(w))
    if (sharedWords.length > 0) {
      sharedCount += Math.min(sharedWords.length / 10, 1) // Normalize to max 1
    }
  }

  return sharedCount
}

/**
 * Build simple citation network graph with only paper nodes (no keyword/author/TLDR children)
 * This creates a simpler structure where nodes are only paper titles
 */
export function buildSimpleCitationGraph(
  papers: VeritusPaper[],
  rootPaperId?: string,
  expandablePaperIds?: Set<string>
): CitationNetwork {
  if (papers.length === 0) {
    return {
      nodes: [],
      edges: [],
      stats: {
        totalNodes: 0,
        totalEdges: 0,
        paperNodes: 0,
        childNodes: 0,
        citingCount: 0,
        referencedCount: 0,
      },
    }
  }

  const nodes: CitationNetworkNode[] = []
  const edges: CitationNetworkEdge[] = []

  // Determine root paper
  const rootId = rootPaperId || papers[0].id
  const rootPaper = papers.find((p) => p.id === rootId) || papers[0]
  const otherPapers = papers.filter((p) => p.id !== rootId)

  // Create root node
  const rootNode = createPaperNode(rootPaper, true, 0)
  rootNode.expandable = expandablePaperIds ? expandablePaperIds.has(rootPaper.id) : otherPapers.length > 0
  nodes.push(rootNode)

  // Create paper nodes (similar papers)
  const paperNodes: CitationNetworkNode[] = []
  otherPapers.forEach((paper) => {
    const paperNode = createPaperNode(paper, false, 1)
    paperNode.expandable = expandablePaperIds ? expandablePaperIds.has(paper.id) : false
    paperNodes.push(paperNode)
    nodes.push(paperNode)

    // Create edge from root to paper
    edges.push({
      source: rootNode.id,
      target: paperNode.id,
      type: 'references',
      weight: 1.0,
      metadata: {
        sharedKeywords: [],
        sharedAuthors: [],
        similarityScore: 0,
        chatHistoryBoost: 0,
      },
    })
  })

  // Create edges between papers that share attributes
  for (let i = 0; i < paperNodes.length; i++) {
    for (let j = i + 1; j < paperNodes.length; j++) {
      const paper1 = otherPapers[i]
      const paper2 = otherPapers[j]
      const sharedCount = calculateSharedAttributes(paper1, paper2)

      if (sharedCount > 0) {
        const maxAttributes = Math.max(
          (paper1.fieldsOfStudy?.length || 0) +
            (paper1.authors?.split(',').length || 0) +
            (paper1.tldr ? 1 : 0),
          (paper2.fieldsOfStudy?.length || 0) +
            (paper2.authors?.split(',').length || 0) +
            (paper2.tldr ? 1 : 0)
        )
        const weight = maxAttributes > 0 ? sharedCount / maxAttributes : 0

        if (weight > 0) {
          const fields1 = new Set((paper1.fieldsOfStudy || []).map((f) => f.toLowerCase()))
          const fields2 = new Set((paper2.fieldsOfStudy || []).map((f) => f.toLowerCase()))
          const sharedKeywords = [...fields1].filter((f) => fields2.has(f))

          const authors1 = new Set(
            (paper1.authors || '')
              .split(',')
              .map((a) => a.trim().toLowerCase())
              .filter(Boolean)
          )
          const authors2 = new Set(
            (paper2.authors || '')
              .split(',')
              .map((a) => a.trim().toLowerCase())
              .filter(Boolean)
          )
          const sharedAuthors = [...authors1].filter((a) => authors2.has(a))

          edges.push({
            source: paperNodes[i].id,
            target: paperNodes[j].id,
            type: 'references',
            weight: Math.min(weight, 1.0),
            metadata: {
              sharedKeywords: sharedKeywords.map((k) => {
                const original = paper1.fieldsOfStudy?.find(
                  (f) => f.toLowerCase() === k
                ) || paper2.fieldsOfStudy?.find((f) => f.toLowerCase() === k)
                return original || k
              }),
              sharedAuthors: sharedAuthors.map((a) => {
                const original1 = (paper1.authors || '')
                  .split(',')
                  .map((auth) => auth.trim())
                  .find((auth) => auth.toLowerCase() === a)
                const original2 = (paper2.authors || '')
                  .split(',')
                  .map((auth) => auth.trim())
                  .find((auth) => auth.toLowerCase() === a)
                return original1 || original2 || a
              }),
              similarityScore: weight,
              chatHistoryBoost: 0,
            },
          })
        }
      }
    }
  }

  return {
    nodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      paperNodes: nodes.length, // All nodes are paper nodes
      childNodes: 0, // No child nodes in simple graph
      citingCount: 0,
      referencedCount: 0,
    },
  }
}

/**
 * Build citation network graph from papers
 * This function now uses buildSimpleCitationGraph for paper-only structure
 */
export function buildCitationGraphFromPapers(
  papers: VeritusPaper[],
  options: GraphOptions = {}
): CitationNetwork {
  if (papers.length === 0) {
    return {
      nodes: [],
      edges: [],
      stats: {
        totalNodes: 0,
        totalEdges: 0,
        paperNodes: 0,
        childNodes: 0,
        citingCount: 0,
        referencedCount: 0,
      },
    }
  }

  // Apply filters
  let filteredPapers = filterPapers(papers, options.filters)

  // Apply sorting
  filteredPapers = sortPapers(filteredPapers, options.sortBy, options.sortOrder)

  // Apply limit (only to paper nodes)
  if (options.limit && options.limit > 0) {
    filteredPapers = filteredPapers.slice(0, options.limit)
  }

  // Create set of expandable paper IDs (all papers except root are expandable if they have similar papers)
  const expandablePaperIds = new Set<string>(filteredPapers.map((p) => p.id))

  // Use simple graph builder (paper-only structure, no keyword/author/TLDR children)
  return buildSimpleCitationGraph(
    filteredPapers,
    options.rootPaperId,
    expandablePaperIds
  )
}

