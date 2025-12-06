interface Paper {
  id: string
  title: string
  impactFactor?: {
    citationCount?: number
  }
  score?: number
  [key: string]: any
}

interface GraphNode {
  id: string
  label: string
  citations: number
  isRoot?: boolean
}

interface GraphEdge {
  source: string
  target: string
  weight: number
}

interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/**
 * Builds a simple graph structure for visualization
 * @param mainPaper The main/root paper
 * @param similar Array of similar papers
 * @returns Graph object with nodes and edges
 */
export function buildGraph(mainPaper: Paper, similar: Paper[]): Graph {
  const nodes: GraphNode[] = [
    {
      id: mainPaper.id,
      label: mainPaper.title,
      citations: mainPaper?.impactFactor?.citationCount || 0,
      isRoot: true,
    },
  ]

  const edges: GraphEdge[] = []

  similar.forEach((p) => {
    nodes.push({
      id: p.id,
      label: p.title,
      citations: p?.impactFactor?.citationCount || 0,
    })

    edges.push({
      source: mainPaper.id,
      target: p.id,
      weight: p.score || 0.5,
    })
  })

  return { nodes, edges }
}

