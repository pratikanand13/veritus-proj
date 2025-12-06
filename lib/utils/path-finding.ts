import { CitationNetworkNode, CitationNetworkEdge } from '@/types/paper-api'

/**
 * Build adjacency list from edges
 */
function buildAdjacencyList(
  edges: CitationNetworkEdge[]
): Map<string, Set<string>> {
  const adjList = new Map<string, Set<string>>()
  
  edges.forEach(edge => {
    const source = typeof edge.source === 'string' ? edge.source : (edge.source as any).id || edge.source
    const target = typeof edge.target === 'string' ? edge.target : (edge.target as any).id || edge.target
    
    const sourceId = typeof source === 'string' ? source : String(source)
    const targetId = typeof target === 'string' ? target : String(target)
    
    if (!adjList.has(sourceId)) {
      adjList.set(sourceId, new Set())
    }
    if (!adjList.has(targetId)) {
      adjList.set(targetId, new Set())
    }
    
    // Add bidirectional connections
    adjList.get(sourceId)!.add(targetId)
    adjList.get(targetId)!.add(sourceId)
  })
  
  return adjList
}

/**
 * Find shortest path between two nodes using BFS
 */
export function findShortestPath(
  nodes: CitationNetworkNode[],
  edges: CitationNetworkEdge[],
  startId: string,
  endId: string
): string[] | null {
  const adjList = buildAdjacencyList(edges)
  const visited = new Set<string>()
  const queue: Array<{ id: string; path: string[] }> = [{ id: startId, path: [startId] }]
  
  visited.add(startId)
  
  while (queue.length > 0) {
    const { id, path } = queue.shift()!
    
    if (id === endId) {
      return path
    }
    
    const neighbors = adjList.get(id) || new Set()
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push({ id: neighbor, path: [...path, neighbor] })
      }
    }
  }
  
  return null
}

/**
 * Find all paths between two nodes (up to maxDepth)
 */
export function findAllPaths(
  nodes: CitationNetworkNode[],
  edges: CitationNetworkEdge[],
  startId: string,
  endId: string,
  maxDepth: number = 5
): string[][] {
  const adjList = buildAdjacencyList(edges)
  const paths: string[][] = []
  
  function dfs(currentId: string, targetId: string, path: string[], depth: number) {
    if (depth > maxDepth) return
    
    if (currentId === targetId) {
      paths.push([...path])
      return
    }
    
    const neighbors = adjList.get(currentId) || new Set()
    for (const neighbor of neighbors) {
      if (!path.includes(neighbor)) {
        dfs(neighbor, targetId, [...path, neighbor], depth + 1)
      }
    }
  }
  
  dfs(startId, endId, [startId], 0)
  return paths
}

/**
 * Get all nodes connected to a given node
 */
export function getConnectedNodes(
  edges: CitationNetworkEdge[],
  nodeId: string
): Set<string> {
  const connected = new Set<string>()
  const adjList = buildAdjacencyList(edges)
  
  function dfs(id: string) {
    if (connected.has(id)) return
    connected.add(id)
    
    const neighbors = adjList.get(id) || new Set()
    for (const neighbor of neighbors) {
      dfs(neighbor)
    }
  }
  
  dfs(nodeId)
  return connected
}

