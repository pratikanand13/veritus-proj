import { CitationNetworkNode } from '@/types/paper-api'

export interface Cluster {
  id: string
  label: string
  nodes: CitationNetworkNode[]
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
}

export type ClusterType = 'year' | 'citations' | 'type'

/**
 * Cluster nodes by year ranges
 */
export function clusterByYear(
  nodes: CitationNetworkNode[],
  yearRange: number = 5
): Cluster[] {
  const clusters: Map<string, CitationNetworkNode[]> = new Map()
  
  nodes.forEach(node => {
    if (!node.year) {
      const key = 'unknown'
      if (!clusters.has(key)) clusters.set(key, [])
      clusters.get(key)!.push(node)
      return
    }
    
    const decade = Math.floor(node.year / yearRange) * yearRange
    const key = `${decade}-${decade + yearRange - 1}`
    
    if (!clusters.has(key)) clusters.set(key, [])
    clusters.get(key)!.push(node)
  })
  
  return Array.from(clusters.entries()).map(([key, clusterNodes]) => ({
    id: key,
    label: key === 'unknown' ? 'Unknown Year' : `${key}`,
    nodes: clusterNodes,
    bounds: { x: 0, y: 0, width: 0, height: 0 }
  }))
}

/**
 * Cluster nodes by citation count ranges
 */
export function clusterByCitations(
  nodes: CitationNetworkNode[],
  ranges: Array<{ min: number; max: number; label: string }>
): Cluster[] {
  const clusters: Map<string, CitationNetworkNode[]> = new Map()
  
  // Initialize clusters
  ranges.forEach(range => {
    clusters.set(range.label, [])
  })
  
  // Add "other" cluster for nodes outside ranges
  clusters.set('other', [])
  
  nodes.forEach(node => {
    const citations = node.citations || 0
    let assigned = false
    
    for (const range of ranges) {
      if (citations >= range.min && citations <= range.max) {
        clusters.get(range.label)!.push(node)
        assigned = true
        break
      }
    }
    
    if (!assigned) {
      clusters.get('other')!.push(node)
    }
  })
  
  // Remove empty clusters
  return Array.from(clusters.entries())
    .filter(([_, nodes]) => nodes.length > 0)
    .map(([label, clusterNodes]) => ({
      id: label,
      label,
      nodes: clusterNodes,
      bounds: { x: 0, y: 0, width: 0, height: 0 }
    }))
}

/**
 * Cluster nodes by type (root, citing, referenced, both)
 */
export function clusterByType(nodes: CitationNetworkNode[]): Cluster[] {
  const clusters: Map<string, CitationNetworkNode[]> = new Map()
  
  nodes.forEach(node => {
    const type = node.type || 'unknown'
    if (!clusters.has(type)) {
      clusters.set(type, [])
    }
    clusters.get(type)!.push(node)
  })
  
  return Array.from(clusters.entries()).map(([type, clusterNodes]) => ({
    id: type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
    nodes: clusterNodes,
    bounds: { x: 0, y: 0, width: 0, height: 0 }
  }))
}

/**
 * Calculate cluster bounds from node positions
 */
export function calculateClusterBounds(cluster: Cluster): Cluster {
  if (cluster.nodes.length === 0) return cluster
  
  const xs = cluster.nodes.map(n => n.x || 0)
  const ys = cluster.nodes.map(n => n.y || 0)
  
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  
  return {
    ...cluster,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }
}

