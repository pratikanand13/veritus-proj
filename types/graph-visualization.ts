// Graph visualization types for enhanced citation network

export type LayoutType = 'force' | 'hierarchical' | 'circular' | 'grid' | 'cluster'

export interface FilterState {
  minCitations?: number
  maxCitations?: number
  minYear?: number
  maxYear?: number
  types?: Array<'root' | 'citing' | 'referenced' | 'both'>
  authors?: string[]
  fieldsOfStudy?: string[]
  searchQuery?: string
}

export interface ClusterConfig {
  enabled: boolean
  type: 'year' | 'citations' | 'type' | 'none'
  yearRange?: number // Group by this many years
  citationRanges?: Array<{ min: number; max: number; label: string }>
}

export interface AnimationConfig {
  enabled: boolean
  duration: number
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
}

export interface GraphInteractionState {
  selectedNodes: Set<string>
  highlightedPath: string[] | null
  hoveredNode: string | null
  showLabels: boolean
  showEdgeLabels: boolean
  nodeSizeMultiplier: number
  edgeThicknessMultiplier: number
}

export interface LayoutConfig {
  type: LayoutType
  forceStrength?: number
  chargeStrength?: number
  linkDistance?: number
  collisionRadius?: number
}

