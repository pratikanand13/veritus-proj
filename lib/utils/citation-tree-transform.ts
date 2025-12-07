import { CitationNetworkResponse, CitationNetworkNode } from '@/types/paper-api'
import { TreeDataItem } from '@/components/ui/tree-view'
import { FileText, TrendingUp, BookOpen, Star } from 'lucide-react'

interface TreeNode {
  id: string
  label: string
  type: 'root' | 'citing' | 'referenced' | 'both'
  citations: number
  references?: number
  year: number | null
  authors: string | null
  score?: number | null
  publicationType?: string | null
  data?: any
  children?: TreeNode[]
  parentId?: string
  nodeType?: 'paper' | 'keyword' | 'tldr' | 'author'
  level?: number
  expandable?: boolean
}

interface TransformOptions {
  expandedData?: Map<string, TreeNode[]>
  onExpandNode?: (nodeId: string) => Promise<CitationNetworkResponse | null>
  onNodeClick?: (nodeId: string) => void
  selectedNodeId?: string | null
  filters?: {
    publicationTypes?: string[]
    minScore?: number
    maxScore?: number
    minYear?: number
    maxYear?: number
    minCitations?: number
    maxCitations?: number
    authors?: string[]
  }
  sortBy?: 'relevance' | 'citations' | 'year' | 'score' | 'publicationType' | 'authors'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Transform CitationNetworkResponse to TreeDataItem format for shadcn TreeView
 * Simplified structure: only paper nodes (no keyword/author/TLDR children)
 */
export function transformToTreeData(
  citationNetworkResponse: CitationNetworkResponse | undefined,
  options: TransformOptions = {}
): TreeDataItem[] | null {
  if (!citationNetworkResponse?.citationNetwork) return null

  const { nodes, edges } = citationNetworkResponse.citationNetwork
  
  // In simplified structure, all nodes are paper nodes
  const paperNodes = nodes.filter(n => n.nodeType === 'paper' || n.isRoot || !n.nodeType)
  const rootNode = paperNodes.find(n => n.isRoot)
  
  if (!rootNode) return null

  // Build hierarchy from edges: root -> similar papers
  const childrenMap = new Map<string, TreeNode[]>()
  const nodeMap = new Map<string, CitationNetworkNode>()
  
  // Create map of all nodes
  paperNodes.forEach(node => {
    nodeMap.set(node.id, node)
  })
  
  // Build parent-child relationships from edges
  edges.forEach(edge => {
    const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as any)?.id || edge.source
    const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as any)?.id || edge.target
    
    const sourceNode = nodeMap.get(sourceId)
    const targetNode = nodeMap.get(targetId)
    
    if (!sourceNode || !targetNode) return
    
    // Root references other papers (children)
    if (sourceId === rootNode.id && targetNode.nodeType === 'paper') {
      if (!childrenMap.has(rootNode.id)) {
        childrenMap.set(rootNode.id, [])
      }
      const nodeData = (targetNode.data || {}) as any
      childrenMap.get(rootNode.id)!.push({
        id: targetNode.id,
        label: targetNode.label,
        type: targetNode.type,
        citations: targetNode.citations,
        references: targetNode.references,
        year: targetNode.year,
        authors: targetNode.authors,
        score: targetNode.score ?? nodeData?.score ?? null,
        publicationType: nodeData?.publicationType || nodeData?.publication_type || null,
        data: nodeData,
        nodeType: targetNode.nodeType || 'paper',
        parentId: targetNode.parentId,
        level: targetNode.level,
        expandable: targetNode.expandable || false,
        children: [],
      })
    }
  })

  // Build root tree node
  const rootData = (rootNode.data || citationNetworkResponse.paper || {}) as any
  const root: TreeNode = {
    id: rootNode.id,
    label: rootNode.label,
    type: 'root',
    citations: rootNode.citations,
    references: rootNode.references,
    year: rootNode.year,
    authors: rootNode.authors,
    score: rootNode.score ?? rootData?.score ?? null,
    publicationType: rootData?.publicationType || rootData?.publication_type || null,
    data: rootData,
    nodeType: rootNode.nodeType || 'paper',
    level: rootNode.level || 0,
    expandable: rootNode.expandable || false,
    children: (childrenMap.get(rootNode.id) || []).map(child => {
      return buildTreeNodeWithChildren(child, childrenMap)
    }),
  }
  
  // Helper function to recursively build tree nodes with children
  function buildTreeNodeWithChildren(node: TreeNode, childrenMap: Map<string, TreeNode[]>): TreeNode {
    const children = childrenMap.get(node.id) || []
    return {
      ...node,
      children: children.map(child => buildTreeNodeWithChildren(child, childrenMap)),
    }
  }

  // Merge expanded data
  if (options.expandedData) {
    const mergeExpandedData = (node: TreeNode): TreeNode => {
      const expandedChildren = options.expandedData!.get(node.id)
      if (expandedChildren) {
        node.children = expandedChildren.map(mergeExpandedData)
      } else if (node.children) {
        node.children = node.children.map(mergeExpandedData)
      }
      return node
    }
    mergeExpandedData(root)
  }

  // Apply filters and sorting
  const processedRoot = processNode(root, options)

  // Transform to TreeDataItem
  return [transformTreeNodeToTreeDataItem(processedRoot, options)]
}

/**
 * Process node with filters and sorting (recursive)
 */
function processNode(node: TreeNode, options: TransformOptions): TreeNode {
  let processed = { ...node }

  // Process children
  if (processed.children) {
    let processedChildren = [...processed.children]

    // Apply filters (all nodes are paper nodes in simplified structure)
    if (options.filters) {
      const filters = options.filters
      if (filters.publicationTypes && filters.publicationTypes.length > 0) {
        processedChildren = processedChildren.filter(n => 
          n.publicationType && filters.publicationTypes!.includes(n.publicationType)
        )
      }
      if (filters.minScore !== undefined) {
        processedChildren = processedChildren.filter(n => (n.score ?? 0) >= filters.minScore!)
      }
      if (filters.maxScore !== undefined) {
        processedChildren = processedChildren.filter(n => (n.score ?? 1) <= filters.maxScore!)
      }
      if (filters.minYear !== undefined) {
        processedChildren = processedChildren.filter(n => n.year && n.year >= filters.minYear!)
      }
      if (filters.maxYear !== undefined) {
        processedChildren = processedChildren.filter(n => n.year && n.year <= filters.maxYear!)
      }
      if (filters.minCitations !== undefined) {
        processedChildren = processedChildren.filter(n => n.citations >= filters.minCitations!)
      }
      if (filters.maxCitations !== undefined) {
        processedChildren = processedChildren.filter(n => n.citations <= filters.maxCitations!)
      }
      if (filters.authors && filters.authors.length > 0) {
        processedChildren = processedChildren.filter(n => 
          n.authors && filters.authors!.some(author => 
            n.authors!.toLowerCase().includes(author.toLowerCase())
          )
        )
      }
    }

    // Apply sorting (all nodes are paper nodes)
    if (options.sortBy && options.sortOrder) {
      processedChildren.sort((a, b) => {
        let aVal: any, bVal: any

        switch (options.sortBy) {
          case 'citations':
            aVal = a.citations
            bVal = b.citations
            break
          case 'year':
            aVal = a.year ?? 0
            bVal = b.year ?? 0
            break
          case 'score':
            aVal = a.score ?? 0
            bVal = b.score ?? 0
            break
          case 'publicationType':
            aVal = a.publicationType || ''
            bVal = b.publicationType || ''
            break
          case 'authors':
            aVal = a.authors || ''
            bVal = b.authors || ''
            break
          case 'relevance':
          default:
            aVal = (a.citations || 0) * 0.4 + (a.score || 0) * 100 * 0.4 + ((a.year || 0) / 100) * 0.2
            bVal = (b.citations || 0) * 0.4 + (b.score || 0) * 100 * 0.4 + ((b.year || 0) / 100) * 0.2
            break
        }

        if (aVal < bVal) return options.sortOrder === 'asc' ? -1 : 1
        if (aVal > bVal) return options.sortOrder === 'asc' ? 1 : -1
        return 0
      })
    }

    // Recursively process children
    processed.children = processedChildren.map(child => processNode(child, options))
  }

  return processed
}

/**
 * Transform TreeNode to TreeDataItem with custom icons and actions
 */
function transformTreeNodeToTreeDataItem(
  node: TreeNode,
  options: TransformOptions
): TreeDataItem {
  // Determine icon based on node type (all nodes are papers in simplified structure)
  let IconComponent: React.ComponentType<{ className?: string }> | undefined
  
  if (node.type === 'root') {
    IconComponent = FileText
  } else if (node.type === 'citing') {
    IconComponent = TrendingUp
  } else if (node.type === 'referenced') {
    IconComponent = BookOpen
  } else {
    IconComponent = FileText // Default for paper nodes
  }

  const isSelected = options.selectedNodeId === node.id
  const hasChildren = node.children && node.children.length > 0

  return {
    id: node.id,
    name: node.label,
    icon: IconComponent,
    selectedIcon: Star,
    openIcon: IconComponent,
    children: node.children?.map(child => transformTreeNodeToTreeDataItem(child, options)),
    onClick: () => options.onNodeClick?.(node.id),
    draggable: true, // All nodes are paper nodes, so draggable
    className: isSelected ? 'bg-accent' : undefined,
    // Store expandable flag and node data for use in CitationTree component
    // Note: TreeDataItem doesn't have expandable/data fields, so we'll need to access via node.data
  } as TreeDataItem & { expandable?: boolean; data?: any }
}
