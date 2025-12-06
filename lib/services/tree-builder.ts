interface Paper {
  id: string
  title: string
  impactFactor?: {
    citationCount?: number
  }
  [key: string]: any
}

interface CitationNetworkEdge {
  source: string
  target: string
  type: 'cites' | 'references'
  [key: string]: any
}

interface TreeLevel {
  level: number
  nodes: Paper[]
  description: string
}

interface TreeRelationships {
  [paperId: string]: {
    parent: string | null
    children: string[]
  }
}

interface Tree {
  root: Paper
  levels: TreeLevel[]
  relationships: TreeRelationships
}

/**
 * Builds hierarchical tree structure from citation network
 * Creates layers based on citation count percentiles
 * @param mainPaper The root paper
 * @param allPapers All papers in the network
 * @param edges Citation network edges
 * @returns Tree structure with levels and relationships
 */
export function buildTree(
  mainPaper: Paper,
  allPapers: Paper[],
  edges: CitationNetworkEdge[] = []
): Tree {
  // Separate root from other papers
  const otherPapers = allPapers.filter((p) => p.id !== mainPaper.id)

  // Sort by citation count for tree structure
  const sortedPapers = [...otherPapers].sort(
    (a, b) => (b.impactFactor?.citationCount || 0) - (a.impactFactor?.citationCount || 0)
  )

  // Create levels based on citation count percentiles
  const totalPapers = sortedPapers.length
  const level1Count = Math.ceil(totalPapers * 0.2) // Top 20%
  const level2Count = Math.ceil(totalPapers * 0.3) // Next 30%

  const levels: TreeLevel[] = [
    {
      level: 0,
      nodes: [mainPaper],
      description: 'Root paper',
    },
    {
      level: 1,
      nodes: sortedPapers.slice(0, level1Count),
      description: 'High citation papers (top 20%)',
    },
    {
      level: 2,
      nodes: sortedPapers.slice(level1Count, level1Count + level2Count),
      description: 'Medium citation papers (next 30%)',
    },
    {
      level: 3,
      nodes: sortedPapers.slice(level1Count + level2Count),
      description: 'Remaining papers',
    },
  ].filter((level) => level.nodes.length > 0) // Remove empty levels

  // Build parent-child relationships based on edges
  const relationships: TreeRelationships = {}

  // Initialize relationships for all nodes
  levels.forEach((level) => {
    level.nodes.forEach((node) => {
      relationships[node.id] = {
        parent: null,
        children: [],
      }
    })
  })

  // Build relationships from edges
  edges.forEach((edge) => {
    if (edge.type === 'cites') {
      // Paper cites main paper: main paper is parent
      if (edge.target === mainPaper.id) {
        if (!relationships[edge.source]) {
          relationships[edge.source] = { parent: null, children: [] }
        }
        relationships[edge.source].parent = mainPaper.id
        if (!relationships[mainPaper.id]) {
          relationships[mainPaper.id] = { parent: null, children: [] }
        }
        relationships[mainPaper.id].children.push(edge.source)
      }
    } else if (edge.type === 'references') {
      // Main paper references paper: main paper is parent
      if (edge.source === mainPaper.id) {
        if (!relationships[edge.target]) {
          relationships[edge.target] = { parent: null, children: [] }
        }
        relationships[edge.target].parent = mainPaper.id
        if (!relationships[mainPaper.id]) {
          relationships[mainPaper.id] = { parent: null, children: [] }
        }
        relationships[mainPaper.id].children.push(edge.target)
      }
    }
  })

  return {
    root: mainPaper,
    levels: levels,
    relationships: relationships,
  }
}

