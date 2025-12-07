'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import { ZoomIn, ZoomOut, RotateCcw, Plus, X, Loader2, FileText, Download, Copy, ExternalLink, ChevronDown, Network, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CitationNetworkResponse } from '@/types/paper-api'
import { VeritusPaper } from '@/types/veritus'
import { GraphNode, NodeTransferPayload } from '@/types/graph-node'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { KeywordSelectionPanel } from '@/components/dashboard/KeywordSelectionPanel'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { extractKeywords } from '@/lib/utils/keyword-extractor'
import { toast } from '@/lib/utils/toast'
import { isDebugMode } from '@/lib/config/mock-config'

interface CitationTreeVisualizationProps {
  citationNetworkResponse?: CitationNetworkResponse
  chatId?: string | null
  width?: number
  height?: number
  onNodeClick?: (paper: VeritusPaper) => void
  messages?: any[] // Messages for KeywordSelectionPanel
  onCreateChatFromNode?: (
    paper: VeritusPaper,
    selectedFields?: Map<string, string>,
    nodeContext?: NodeTransferPayload
  ) => Promise<string | null>
}

/**
 * Truncate text to fit within a given width
 */
function truncateText(text: string, maxWidth: number): string {
  const charWidth = 7 // Approximate pixels per character
  const padding = 20 // Account for padding
  const maxChars = Math.floor((maxWidth - padding) / charWidth)
  if (text.length <= maxChars) return text
  return text.substring(0, maxChars - 3) + '...'
}

/**
 * Get field value from paper object, handling nested objects
 */
function getFieldValue(paper: VeritusPaper, fieldName: string): any {
  if (fieldName.includes('.')) {
    const parts = fieldName.split('.')
    let value: any = paper
    for (const part of parts) {
      value = value?.[part]
      if (value === undefined || value === null) return null
    }
    return value
  }
  return (paper as any)[fieldName]
}

/**
 * Format field value for display
 */
function formatFieldValue(value: any): string {
  if (value === null || value === undefined) return 'N/A'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Get all metadata fields from paper object
 */
function getMetadataFields(paper: VeritusPaper): Array<{ fieldName: string; fieldValue: any; displayName: string }> {
  const fields: Array<{ fieldName: string; fieldValue: any; displayName: string }> = []
  
  // Basic fields
  const basicFields = [
    'abstract', 'authors', 'doi', 'downloadable', 'engine', 'fieldsOfStudy',
    'isOpenAccess', 'isPrePrint', 'journalName', 'link', 'pdfLink',
    'publicationType', 'publishedAt', 'score', 'semanticLink',
    'title', 'titleLink', 'tldr', 'v_country', 'v_journal_name',
    'v_publisher', 'v_quartile_ranking', 'year'
  ]
  
  basicFields.forEach(field => {
    const value = (paper as any)[field]
    if (value !== undefined && value !== null) {
      fields.push({
        fieldName: field,
        fieldValue: value,
        displayName: field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()
      })
    }
  })
  
  // Impact factor nested fields
  if (paper.impactFactor) {
    if (paper.impactFactor.citationCount !== undefined) {
      fields.push({
        fieldName: 'impactFactor.citationCount',
        fieldValue: paper.impactFactor.citationCount,
        displayName: 'Citation Count'
      })
    }
    if (paper.impactFactor.influentialCitationCount !== undefined) {
      fields.push({
        fieldName: 'impactFactor.influentialCitationCount',
        fieldValue: paper.impactFactor.influentialCitationCount,
        displayName: 'Influential Citations'
      })
    }
    if (paper.impactFactor.referenceCount !== undefined) {
      fields.push({
        fieldName: 'impactFactor.referenceCount',
        fieldValue: paper.impactFactor.referenceCount,
        displayName: 'Reference Count'
      })
    }
  }
  
  return fields
}

/**
 * Find a node in the tree by ID
 */
function findNodeById(node: GraphNode | null, nodeId: string): GraphNode | null {
  if (!node) return null
  if (node.id === nodeId) return node
  
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeById(child, nodeId)
      if (found) return found
    }
  }
  return null
}

/**
 * Get all parent nodes by traversing up the tree
 */
function getParentNodes(node: GraphNode | null, root: GraphNode | null, targetId: string): GraphNode[] {
  if (!node || !root) return []
  
  const parents: GraphNode[] = []
  let current: GraphNode | null = findNodeById(root, targetId)
  
  // Build parent map
  const parentMap = new Map<string, GraphNode>()
  const buildParentMap = (n: GraphNode | null, parent: GraphNode | null = null) => {
    if (!n) return
    if (parent) parentMap.set(n.id, parent)
    if (n.children) {
      n.children.forEach(child => buildParentMap(child, n))
    }
  }
  buildParentMap(root)
  
  // Traverse up
  while (current) {
    const parent = parentMap.get(current.id)
    if (parent) {
      parents.push(parent)
      current = parent
    } else {
      break
    }
  }
  
  return parents
}

/**
 * Get connected nodes (siblings and children)
 */
function getConnectedNodes(node: GraphNode | null, root: GraphNode | null, targetId: string): GraphNode[] {
  if (!node || !root) return []
  
  const connected: GraphNode[] = []
  const targetNode = findNodeById(root, targetId)
  if (!targetNode) return []
  
  // Get siblings (nodes with same parent)
  const parentMap = new Map<string, GraphNode>()
  const childrenMap = new Map<string, GraphNode[]>()
  
  const buildMaps = (n: GraphNode | null, parent: GraphNode | null = null) => {
    if (!n) return
    if (parent) parentMap.set(n.id, parent)
    
    if (n.children) {
      if (!childrenMap.has(n.id)) {
        childrenMap.set(n.id, [])
      }
      n.children.forEach(child => {
        childrenMap.get(n.id)!.push(child)
        buildMaps(child, n)
      })
    }
  }
  buildMaps(root)
  
  // Get siblings
  const parent = parentMap.get(targetId)
  if (parent && childrenMap.has(parent.id)) {
    const siblings = childrenMap.get(parent.id)!.filter(n => n.id !== targetId)
    connected.push(...siblings)
  }
  
  // Get children
  if (targetNode.children) {
    connected.push(...targetNode.children)
  }
  
  return connected
}

/**
 * Collect keywords from nodes
 */
function collectKeywordsFromNodes(nodes: GraphNode[]): string[] {
  const keywords = new Set<string>()
  
  nodes.forEach(node => {
    if (node.keywords && Array.isArray(node.keywords)) {
      node.keywords.forEach(kw => keywords.add(kw))
    }
    if (node.paper?.fieldsOfStudy && Array.isArray(node.paper.fieldsOfStudy)) {
      node.paper.fieldsOfStudy.forEach(kw => keywords.add(kw))
    }
  })
  
  return Array.from(keywords)
}

/**
 * Transform citation network response to hierarchical tree structure with GraphNode schema
 * Also restores children from chatstore if available
 */
function transformCitationNetworkToTree(
  citationNetworkResponse: CitationNetworkResponse | undefined,
  depth: number = 0,
  chatId?: string | null
): GraphNode | null {
  if (!citationNetworkResponse?.citationNetwork) return null

  const { nodes, edges } = citationNetworkResponse.citationNetwork
  const rootNode = nodes.find(n => n.isRoot)
  
  if (!rootNode) return null

  // Build children map from edges
  const childrenMap = new Map<string, string[]>()
  const nodeMap = new Map<string, typeof nodes[0]>()
  
  nodes.forEach(node => {
    nodeMap.set(node.id, node)
  })

  // Build parent-child relationships
  edges.forEach(edge => {
    const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as any)?.id || edge.source
    const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as any)?.id || edge.target
    
    if (sourceId === rootNode.id) {
      if (!childrenMap.has(rootNode.id)) {
        childrenMap.set(rootNode.id, [])
      }
      childrenMap.get(rootNode.id)!.push(targetId)
    }
  })

  // Helper to get score for a node (from node.score or paperData.score)
  const getNodeScore = (nodeId: string): number => {
    const node = nodeMap.get(nodeId)
    if (!node) return 0
    
    // Try to get score from node first
    if (node.score !== null && node.score !== undefined) {
      return node.score
    }
    
    // CRITICAL: Use only the node's own data, NO fallback
    // This prevents fallback data from being used
    const paperData = node.data as VeritusPaper
    if (!paperData || !paperData.id) {
      // No valid data for this node - return 0
      return 0
    }
    return paperData?.score || 0
  }

  // Helper to build graph node with proper truncation
  const buildGraphNode = (nodeId: string, nodeDepth: number): GraphNode | null => {
    const node = nodeMap.get(nodeId)
    if (!node) return null

    // CRITICAL: Use only the node's own data
    // For root node, allow fallback to citationNetworkResponse.paper ONLY during initial build
    // For child nodes, they MUST have their own data - NEVER use root paper as fallback
    let paperData = node.data as VeritusPaper
    if (!paperData && nodeId === rootNode.id) {
      // Only root node can fallback to citationNetworkResponse.paper during initial build
      // This is the ONLY allowed fallback, and only for the root node
      paperData = citationNetworkResponse.paper
    }
    
    // Validate that we have actual paper data for this node
    // NO FALLBACK for child nodes - if they don't have data, return null
    if (!paperData || !paperData.id) {
      console.warn(`Node ${nodeId} has no valid paper data, returning null (no fallback allowed)`)
      return null
    }
    
    const allChildrenIds = childrenMap.get(nodeId) || []
    
    // Limit to top 3 children by score
    const topChildrenIds = allChildrenIds
      .map(id => ({
        id,
        score: getNodeScore(id)
      }))
      .sort((a, b) => b.score - a.score) // Sort descending by score
      .slice(0, 3) // Take only top 3
      .map(item => item.id)
    
    // Calculate display label based on rectangle width (120-180px)
    const maxRectWidth = 180
    const fullLabel = node.label || paperData.title || 'Unknown'
    const displayLabel = truncateText(fullLabel, maxRectWidth)
    
    // CRITICAL: Only build direct children (no recursive pre-expansion)
    // Child nodes must start EMPTY - they get children only when "Add Nodes" is used
    const childNodes = topChildrenIds
      .map(id => {
        // Get child node data
        const childNode = nodeMap.get(id)
        if (!childNode) return null
        
        const childPaperData = childNode.data as VeritusPaper
        if (!childPaperData || !childPaperData.id) {
          console.warn(`Child node ${id} has no valid paper data`)
          return null
        }
        
        // Prevent child from having same paper as parent
        if (childPaperData.id === paperData.id) {
          console.warn(`Preventing circular reference: child paperId matches parent: ${childPaperData.id}`)
          return null
        }
        
        const childFullLabel = childNode.label || childPaperData.title || 'Unknown'
        const childDisplayLabel = truncateText(childFullLabel, 180)
        
        // CRITICAL: Child nodes start with EMPTY children array
        // They will only get children when user clicks "Add Nodes" on them
        return {
          id: childNode.id,
          label: childFullLabel,
          displayLabel: childDisplayLabel,
          paper: childPaperData,
          paperId: childPaperData.id,
          expandable: true, // Expandable via "Add Nodes" button
          keywords: childPaperData.fieldsOfStudy || [],
          depth: nodeDepth + 1,
          nodeType: childNode.nodeType || 'paper',
          parentId: node.id,
          children: [], // CRITICAL: Start empty - no pre-expansion
        } as GraphNode
      })
      .filter((child): child is GraphNode => child !== null)
    
    return {
      id: node.id,
      label: fullLabel, // Full text
      displayLabel: displayLabel, // Truncated text
      paper: paperData,
      paperId: paperData.id, // Use actual paper ID
      expandable: true, // All nodes are expandable via "Add Nodes" button
      keywords: paperData.fieldsOfStudy || [],
      depth: nodeDepth,
      nodeType: node.nodeType || 'paper',
      parentId: node.parentId,
      children: childNodes, // Only direct children, no deeper levels
    }
  }

  return buildGraphNode(rootNode.id, depth)
}

export function CitationTreeVisualization({
  citationNetworkResponse,
  chatId,
  width = 928,
  height = 600,
  onNodeClick,
  messages = [],
  onCreateChatFromNode,
}: CitationTreeVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const zoomLevelRef = useRef(1)
  const initialZoomSetRef = useRef(false)
  const zoomDisplayRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width, height })
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set())
  const [treeData, setTreeData] = useState<GraphNode | null>(null)
  const [metadataPopupOpen, setMetadataPopupOpen] = useState(false)
  const [selectedNodeForMetadata, setSelectedNodeForMetadata] = useState<GraphNode | null>(null)
  const [selectedKeywords, setSelectedKeywords] = useState<Map<string, Set<string>>>(new Map()) // Max 4 keywords per node
  const [selectedFields, setSelectedFields] = useState<Map<string, Map<string, string>>>(new Map()) // Max 4 fields per node - stores fieldName -> displayValue mapping
  const [nodeMetadataFromChatstore, setNodeMetadataFromChatstore] = useState<VeritusPaper | null>(null)
  const [loadingMetadata, setLoadingMetadata] = useState(false)
  const [emptyNodes, setEmptyNodes] = useState<Map<string, GraphNode>>(new Map()) // Track empty nodes
  const [keywordPanelOpen, setKeywordPanelOpen] = useState(false)
  const [keywordSuggestions, setKeywordSuggestions] = useState<{
    keywords?: string[]
    authors?: string[]
    references?: string[]
    tldrs?: string[]
  }>({})
  const [searchPopupOpen, setSearchPopupOpen] = useState(false)
  const [searchInProgress, setSearchInProgress] = useState(false) // Track if search is running (even if popup closed)
  const [searchResults, setSearchResults] = useState<VeritusPaper[]>([]) // Store search results
  const [showSearchResults, setShowSearchResults] = useState(false) // Control visibility of results panel
  const [sortBy, setSortBy] = useState<'score' | 'year' | 'citations' | 'title' | 'keywords'>('score')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filterYear, setFilterYear] = useState<string>('')
  const [filterMinCitations, setFilterMinCitations] = useState<string>('')
  const [filterMinScore, setFilterMinScore] = useState<string>('')
  const [filterKeywords, setFilterKeywords] = useState<string[]>([]) // Keywords to filter by
  const [availableKeywords, setAvailableKeywords] = useState<string[]>([]) // All unique keywords from results
  const [showFilterPanel, setShowFilterPanel] = useState(false) // Toggle filter panel

  // Transform citation network to tree structure and restore children from chatstore
  useEffect(() => {
    if (citationNetworkResponse) {
      // First transform the basic tree
      let transformed = transformCitationNetworkToTree(citationNetworkResponse, 0, chatId)
      
      // Then restore children from chatstore if available
      if (transformed && chatId) {
        const restoreChildrenFromChatstore = async () => {
          try {
            const response = await fetch(`/api/v1/papers/store-children?chatId=${chatId}`)
            if (response.ok) {
              const data = await response.json()
              const relationships = data.relationships || {}
              
              // CRITICAL: Restore children from chatstore, but do NOT recursively pre-expand
              // Only restore direct children - grandchildren are restored when their parent is expanded
              const restoreChildren = (node: GraphNode): GraphNode => {
                if (!node.paperId) return node
                const nodeRelationships = relationships[node.paperId as string]
                if (nodeRelationships && nodeRelationships.childPapers) {
                  const childPapers = nodeRelationships.childPapers.slice(0, 3) // Max 3
                  
                  // Create child nodes from stored relationships
                  const restoredChildren: GraphNode[] = childPapers
                    .map((cp: { id: string; title: string; sourceParentId: string }): GraphNode | null => {
                      // Check if child already exists in current children
                      const existingChild = (node.children || []).find(c => c.paperId === cp.id)
                      if (existingChild) {
                        // Child already exists - keep it but don't recursively restore its children
                        // Children will be restored when user expands that node
                        return existingChild
                      } else {
                        // Create new child node from stored data
                        // CRITICAL: Start with empty children - no pre-expansion
                        return {
                          id: `child-${cp.id}`,
                          label: cp.title,
                          displayLabel: truncateText(cp.title, 180),
                          paper: { id: cp.id, title: cp.title } as VeritusPaper, // Minimal paper data
                          paperId: cp.id,
                          expandable: true,
                          keywords: [],
                          depth: node.depth + 1,
                          nodeType: 'paper',
                          children: [], // CRITICAL: Start empty - no recursive pre-expansion
                        }
                      }
                    })
                    .filter((child: GraphNode | null): child is GraphNode => child !== null)
                  
                  // Merge with existing children (max 3 total)
                  const existingChildIds = new Set((node.children || []).map((c: GraphNode) => c.paperId))
                  const newChildren = restoredChildren.filter((c: GraphNode) => !existingChildIds.has(c.paperId))
                  const allChildren = [...(node.children || []), ...newChildren].slice(0, 3)
                  
                  // CRITICAL: Do NOT recursively restore grandchildren
                  // Children start empty and are restored only when their parent is expanded
                  return {
                    ...node,
                    children: allChildren, // Direct children only, no recursive expansion
                  }
                }
                // No stored relationships - keep node as is (but still process children if they exist)
                return {
                  ...node,
                  // Keep existing children but don't recursively restore their children
                  // Children's children will be restored when user expands them
                  children: node.children || [],
                }
              }
              
              // CRITICAL: Only restore direct children of root, not recursively
              // This ensures we only restore A → B, C, D initially
              if (transformed) {
                transformed = restoreChildren(transformed)
                setTreeData(transformed)
              }
            }
          } catch (error) {
            console.error('Error restoring children from chatstore:', error)
            // Don't fail if restoration fails, just use the basic tree
            setTreeData(transformed)
          }
        }
        
        restoreChildrenFromChatstore()
      } else {
        setTreeData(transformed)
      }
    }
  }, [citationNetworkResponse, chatId])

  // Hydrate selected fields/keywords from citation network meta (for restored chats)
  useEffect(() => {
    if (!citationNetworkResponse) return
    const meta: any = (citationNetworkResponse as any).meta || {}

    const selectedFieldsByNode = meta.selectedFieldsByNode || meta.apiFieldSelectionsByNode
    if (selectedFieldsByNode && typeof selectedFieldsByNode === 'object') {
      setSelectedFields(prev => {
        const next = new Map(prev)
        Object.entries(selectedFieldsByNode as Record<string, Record<string, string>>).forEach(([nodeId, fields]) => {
          if (fields) {
            next.set(nodeId, new Map(Object.entries(fields)))
          }
        })
        return next
      })
    }

    const keywordsByNode = meta.keywordsByNode
    if (keywordsByNode && typeof keywordsByNode === 'object') {
      setSelectedKeywords(prev => {
        const next = new Map(prev)
        Object.entries(keywordsByNode as Record<string, string[]>).forEach(([nodeId, keywords]) => {
          if (Array.isArray(keywords)) {
            next.set(nodeId, new Set(keywords))
          }
        })
        return next
      })
    }
  }, [citationNetworkResponse])

  // Fetch keyword suggestions from chatstore (current node + parent nodes)
  useEffect(() => {
    const fetchSuggestionsFromChatstore = async () => {
      if (!selectedNodeForMetadata || !chatId || !treeData) {
        setKeywordSuggestions({})
        return
      }

      const keywords = new Set<string>()
      const authors = new Set<string>()
      const references = new Set<string>()
      const tldrs = new Set<string>()

      // Helper to extract data from a paper (current node + parent nodes)
      // ONLY from node context - no historical keywords, no global preferences, no inference beyond node
      const extractFromPaper = (paper: VeritusPaper | null | undefined) => {
        if (!paper) return
        
        // 1. Keywords from fieldsOfStudy (domain tags)
        if (paper.fieldsOfStudy && Array.isArray(paper.fieldsOfStudy)) {
          paper.fieldsOfStudy.forEach(kw => {
            if (kw && kw.trim()) keywords.add(kw.trim())
          })
        }
        
        // 2. Extract meaningful keywords from title, abstract, TLDR using utility
        const extractedKeywords = extractKeywords(paper)
        extractedKeywords.forEach(kw => {
          if (kw && kw.trim() && kw.length >= 3) {
            keywords.add(kw.trim())
          }
        })
        
        // 3. Title as reference
        if (paper.title && !paper.title.startsWith('corpus:')) {
          references.add(paper.title)
        }
        
        // 4. Keywords from publicationType (domain tag)
        if (paper.publicationType && paper.publicationType.trim()) {
          keywords.add(paper.publicationType.trim())
        }
        
        // 5. Journal name as keyword (domain tag)
        if (paper.journalName && paper.journalName.trim()) {
          keywords.add(paper.journalName.trim())
        }
        
        // 6. Authors
        if (paper.authors) {
          const authorList = paper.authors.split(',').map(a => a.trim()).filter(Boolean)
          authorList.forEach(author => authors.add(author))
        }
        
        // 7. TLDR (summary/description)
        if (paper.tldr && paper.tldr.trim()) {
          tldrs.add(paper.tldr.trim())
        }
      }

      // Extract from current node (ALWAYS fetch fresh from chatstore)
      if (selectedNodeForMetadata.paperId) {
        let paperId = selectedNodeForMetadata.paperId.toString().replace('corpus:', '').replace('paper-', '').replace('root-', '').trim()
        
        // Always fetch fresh data from chatstore (respect DEBUG env, no forced mock)
        try {
          const response = await fetch(`/api/v1/papers/${paperId}?chatId=${chatId}`)
          if (response.ok) {
            const data = await response.json()
            if (data.paper) {
              // Use fresh data from chatstore
              extractFromPaper(data.paper)
            }
          } else {
            // Fallback to cached data if fetch fails
            extractFromPaper(selectedNodeForMetadata.paper)
          }
        } catch (error: any) {
          // Fallback to cached data on error
          extractFromPaper(selectedNodeForMetadata.paper)
        }
      } else if (selectedNodeForMetadata.paper) {
        // Use existing paper data if no paperId
        extractFromPaper(selectedNodeForMetadata.paper)
      }

      // Extract from parent nodes (ALWAYS fetch fresh from chatstore)
      const parentNodes = getParentNodes(treeData, treeData, selectedNodeForMetadata.id)
      for (const parentNode of parentNodes) {
        if (parentNode.paperId) {
          let paperId = parentNode.paperId.toString().replace('corpus:', '').replace('paper-', '').replace('root-', '').trim()
          
          // Always fetch fresh data from chatstore for parent nodes (respect DEBUG env, no forced mock)
          try {
            const response = await fetch(`/api/v1/papers/${paperId}?chatId=${chatId}`)
            if (response.ok) {
              const data = await response.json()
              if (data.paper) {
                // Use fresh data from chatstore
                extractFromPaper(data.paper)
              } else {
                // Fallback to cached data
                extractFromPaper(parentNode.paper)
              }
            } else {
              // Fallback to cached data if fetch fails
              extractFromPaper(parentNode.paper)
            }
          } catch (error: any) {
            // Fallback to cached data on error
            extractFromPaper(parentNode.paper)
          }
        } else if (parentNode.paper) {
          // Use existing paper data if no paperId
          extractFromPaper(parentNode.paper)
        }
      }

      setKeywordSuggestions({
        keywords: Array.from(keywords).sort(),
        authors: Array.from(authors).sort(),
        references: Array.from(references).sort(),
        tldrs: Array.from(tldrs),
      })
    }

    // Always fetch when panel opens or node changes (ensures fresh data)
    if (keywordPanelOpen && selectedNodeForMetadata) {
      fetchSuggestionsFromChatstore()
    } else {
      // Clear suggestions when panel closes
      setKeywordSuggestions({})
    }
  }, [selectedNodeForMetadata?.id, chatId, keywordPanelOpen]) // Removed treeData to avoid stale data

  // Create empty node
  const handleAddEmptyNode = () => {
    if (!selectedNodeForMetadata) return
    
    const emptyNodeId = `empty-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const emptyNode: GraphNode = {
      id: emptyNodeId,
      label: 'New Node',
      displayLabel: 'New Node',
      depth: selectedNodeForMetadata.depth + 1,
      expandable: false,
      keywords: [],
      children: [],
      parentId: selectedNodeForMetadata.id,
    }
    
    setEmptyNodes(prev => new Map(prev).set(emptyNodeId, emptyNode))
    
    // Add to tree
    const addEmptyNodeToTree = (node: GraphNode | null): GraphNode | null => {
      if (!node) return null
      if (node.id === selectedNodeForMetadata.id) {
        return {
          ...node,
          children: [...(node.children || []), emptyNode],
        }
      }
      return {
        ...node,
        children: node.children?.map(addEmptyNodeToTree).filter(Boolean) as GraphNode[],
      }
    }
    
    setTreeData(prev => prev ? addEmptyNodeToTree(prev) : null)
    
    // Open keyword panel after adding empty node
    if (selectedNodeForMetadata.paperId || selectedNodeForMetadata.paper?.id) {
      setKeywordPanelOpen(true)
    }
  }

  // Handle search similar papers
  const handleSearchSimilarPapers = async (params: {
    corpusId?: string
    jobType?: 'keywordSearch' | 'querySearch' | 'combinedSearch'
    keywords?: string[]
    tldrs?: string[]
    authors?: string[]
    references?: string[]
    filters?: any
  }) => {
    if (!selectedNodeForMetadata || !chatId) {
      toast.error('Missing required data', 'Please select a node and ensure chat ID is available')
      return
    }
    
    // Prevent multiple simultaneous searches
    if (searchInProgress) {
      toast.info('Search in progress', 'Please wait for the current search to complete')
      return
    }
    
    // Step 1: Show popup immediately and set search in progress
    setSearchPopupOpen(true)
    setSearchInProgress(true)
    setLoadingNodes(prev => new Set(prev).add(selectedNodeForMetadata.id))
    
    try {
      // CRITICAL: Get paper ID for padding phrases if needed
      const paperId = selectedNodeForMetadata.paperId || selectedNodeForMetadata.paper?.id
      const corpusId = paperId?.toString().replace('corpus:', '').replace('paper-', '').replace('root-', '').trim()
      
      // Build request body for job creation
      const body: any = {}
      if (params.keywords && params.keywords.length > 0) {
        body.phrases = params.keywords
      }
      if (params.tldrs && params.tldrs.length > 0) {
        body.query = params.tldrs.join(' ')
      }
      
      // CRITICAL: Add corpusId to body for phrase padding if needed
      if (corpusId) {
        body.corpusId = corpusId
      }
      
      // Determine job type
      const hasKeywords = params.keywords && params.keywords.length > 0
      const hasTldrs = params.tldrs && params.tldrs.length > 0
      let jobType: 'keywordSearch' | 'querySearch' | 'combinedSearch' = 'querySearch'
      
      // CRITICAL: Validate that we have required fields before creating job
      if (hasKeywords && hasTldrs) {
        jobType = 'combinedSearch'
        // For combinedSearch, we need both phrases and query
        if (!body.phrases || body.phrases.length === 0) {
          throw new Error('Keywords are required for combined search')
        }
        if (!body.query || body.query.trim().length === 0) {
          throw new Error('Query (TLDRs) is required for combined search')
        }
      } else if (hasKeywords) {
        jobType = 'keywordSearch'
        if (!body.phrases || body.phrases.length === 0) {
          throw new Error('Keywords are required for keyword search')
        }
      } else if (hasTldrs) {
        jobType = 'querySearch'
        if (!body.query || body.query.trim().length === 0) {
          throw new Error('Query (TLDRs) is required for query search')
        }
      } else {
        // No keywords or tldrs - this is invalid
        throw new Error('Either keywords or query (TLDRs) must be provided')
      }
      
      // Build query params for filters
      const queryParams = new URLSearchParams()
      queryParams.set('chatId', chatId)
      if (params.filters) {
        Object.entries(params.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
              queryParams.set(key, value.join(','))
            } else {
              queryParams.set(key, String(value))
            }
          }
        })
      }
      
      // Step 2: Create job (this will wait 3 seconds in mock mode)
      const jobResponse = await fetch(`/api/veritus/job/create/${jobType}?${queryParams.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      
      if (!jobResponse.ok) {
        // Try to get error message from response
        let errorMessage = 'Failed to create search job'
        try {
          const errorData = await jobResponse.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = jobResponse.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }
      
      const jobData = await jobResponse.json()
      const jobId = jobData.jobId
      
      if (!jobId) {
        throw new Error('No job ID returned')
      }
      
      // Step 3: Poll for job completion
      // For mock mode: 3 second timeout, for real API: 60 second timeout (default)
      const isMock = isDebugMode() || jobId.startsWith('mock-job-')
      let attempts = 0
      const maxAttempts = isMock ? 2 : 30 // Mock: 2 attempts * 1.5s ≈ 3s, Real: 30 attempts * 2s = 60s
      const pollInterval = isMock ? 1500 : 2000 // Mock: 1.5s, Real: 2s
      let papers: VeritusPaper[] = []
      let statusData: any = null
      
      while (attempts < maxAttempts) {
        // Wait before checking status
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        
        const statusResponse = await fetch(`/api/veritus/job/${jobId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
        
        if (!statusResponse.ok) {
          throw new Error('Failed to get job status')
        }
        
        statusData = await statusResponse.json()
        
        if (statusData.status === 'success') {
          papers = statusData.results || []
          break
        } else if (statusData.status === 'error') {
          throw new Error('Job failed')
        }
        
        attempts++
      }
      
      // Check if we timed out or got results
      if (!papers || papers.length === 0) {
        if (isMock) {
          throw new Error('Search timed out or returned no results')
        } else {
          // For real API, check final status
          const finalStatusResponse = await fetch(`/api/veritus/job/${jobId}`)
          if (finalStatusResponse.ok) {
            const finalStatus = await finalStatusResponse.json()
            if (finalStatus.status === 'queued' || finalStatus.status === 'processing') {
              throw new Error('Search timed out after 60 seconds. The job is still processing. Please try again later.')
            }
          }
          throw new Error('Search timed out after 60 seconds or returned no results')
        }
      }
      
      // Step 4: Auto-close popup if still open
      setSearchPopupOpen(false)
      
      // CRITICAL: Store search results in chatstore (top 3 by score) - DO NOT auto-add to tree
      if (papers.length > 0 && selectedNodeForMetadata && selectedNodeForMetadata.paperId && chatId) {
        // Sort by score and take top 3
        const sortedPapers = papers
          .map(paper => ({
            paper,
            score: paper.score || 0,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 3) // STRICT: Only top 3
        
        // Normalize paperId for storage (remove prefixes to ensure consistency)
        // CRITICAL: Convert to string to ensure type consistency with backend
        let normalizedParentPaperId = selectedNodeForMetadata.paperId ? String(selectedNodeForMetadata.paperId).replace('corpus:', '').replace('paper-', '').replace('root-', '').trim() : ''
        
        // Prepare child papers for storage - store FULL paper data for consistency
        // CRITICAL: Normalize child IDs to ensure consistency
        const childPapers = sortedPapers.map(({ paper }) => {
          const normalizedChildId = paper.id ? String(paper.id).replace('corpus:', '').replace('paper-', '').replace('root-', '').trim() : paper.id
          return {
            id: normalizedChildId,
            title: paper.title || 'Unknown',
            sourceParentId: normalizedParentPaperId,
            // Store full paper data for consistent datastore
            paper: paper, // Full VeritusPaper object
          }
        })
        
        // Store parent→child relationships in chatstore
        try {
          if (childPapers.length === 0) {
            toast.info('No results to store', 'No similar papers found to store.')
            return
          }
          
          const storeResponse = await fetch(`/api/v1/papers/store-children?chatId=${chatId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paperId: normalizedParentPaperId,
              childPapers: childPapers,
            }),
          })
          
          if (storeResponse.ok) {
            const storeResult = await storeResponse.json()
            
            if (storeResult.totalChildren === 0) {
              toast.warning(
                'Storage issue',
                'Children were not stored. This might mean duplicates were filtered out or max was reached.'
              )
            } else {
              // Show toast notification - NO popup/modal
              toast.success(
                'Search completed',
                'Click the node to view the new similar papers.'
              )
            }
          } else {
            const errorData = await storeResponse.json().catch(() => ({ error: storeResponse.statusText }))
            console.error('Failed to store parent→child relationship:', errorData)
            toast.error(
              'Storage failed',
              errorData.error || 'Could not store children. Please try again.'
            )
          }
        } catch (error) {
          console.error('Error storing parent→child relationship:', error)
          toast.error(
            'Storage error',
            error instanceof Error ? error.message : 'An unexpected error occurred while storing children.'
          )
        }
      } else if (papers.length === 0) {
        toast.info('No results found', 'No similar papers found for this node.')
      }
      
      // CRITICAL: Do NOT auto-add nodes to tree
      // Nodes will be added when user clicks the node that initiated the search
      
      // Close panels after successful search
      setKeywordPanelOpen(false)
      setMetadataPopupOpen(false)
    } catch (error: any) {
      toast.error('Failed to search similar papers', error?.message || 'An unexpected error occurred')
      // Close popup on error
      setSearchPopupOpen(false)
      
      // Clean up empty nodes that were created but never got data
      // Remove empty nodes that are children of the selected node
      if (selectedNodeForMetadata) {
        const removeEmptyNodesFromTree = (node: GraphNode | null): GraphNode | null => {
          if (!node) return null
          if (node.id === selectedNodeForMetadata.id) {
            // Filter out empty nodes from children
            const filteredChildren = (node.children || []).filter(child => {
              const isEmpty = child.label === 'New Node' || 
                             child.displayLabel === 'New Node' || 
                             child.id.startsWith('empty-') || 
                             emptyNodes.has(child.id)
              if (isEmpty) {
                setEmptyNodes(prev => {
                  const next = new Map(prev)
                  next.delete(child.id)
                  return next
                })
              }
              return !isEmpty
            })
            return {
              ...node,
              children: filteredChildren,
            }
          }
          return {
            ...node,
            children: node.children?.map(removeEmptyNodesFromTree).filter(Boolean) as GraphNode[],
          }
        }
        setTreeData(prev => prev ? removeEmptyNodesFromTree(prev) : null)
      }
    } finally {
      // Clear loading state and re-enable UI
      setSearchInProgress(false)
      setLoadingNodes(prev => {
        const next = new Set(prev)
        next.delete(selectedNodeForMetadata.id)
        return next
      })
    }
  }

  // Handler for creating a new chat from a node (single-node root)
  const handleCreateChatFromNode = async (node: GraphNode) => {
    if (!onCreateChatFromNode) {
      toast.error('Cannot create chat', 'Chat creation handler not available')
      return
    }
    if (!chatId) {
      toast.error('Cannot create chat', 'Chat ID is missing')
      return
    }

    // Validate node data
    if (!node || !node.id) {
      toast.warning('Invalid node selected', 'Please try selecting a different node')
      return
    }


    // Verify we're using the correct node
    if (selectedNodeForMetadata && selectedNodeForMetadata.id !== node.id) {
      toast.warning('Node mismatch detected', 'Using different node than expected')
      // Still proceed, but show the warning
    }

    // Indicate loading on this node
    setLoadingNodes(prev => new Set(prev).add(node.id))

    try {
      // Fetch full paper from chatstore (respects DEBUG env) to ensure all fields are present
      let paperId = node.paperId || node.paper?.id
      if (paperId) {
        paperId = paperId.toString().replace('corpus:', '').replace('paper-', '').replace('root-', '').trim()
      }


      let fullPaper: VeritusPaper | null = null

      // First, try to use already-fetched metadata from chatstore (if available and matches this node)
      if (nodeMetadataFromChatstore && 
          (nodeMetadataFromChatstore.id?.toString().replace('corpus:', '').replace('paper-', '').replace('root-', '').trim() === paperId ||
           node.paperId?.toString().replace('corpus:', '').replace('paper-', '').replace('root-', '').trim() === paperId ||
           !paperId)) {
        fullPaper = nodeMetadataFromChatstore
      } else if (paperId) {
        // Fetch real data from chatstore (respects DEBUG env, no forced mock)
        try {
          const response = await fetch(`/api/v1/papers/${paperId}?chatId=${chatId}`)
          if (response.ok) {
            const data = await response.json()
            if (data.paper) {
              fullPaper = data.paper as VeritusPaper
              // Update nodeMetadataFromChatstore for future use
              setNodeMetadataFromChatstore(fullPaper)
            }
          } else {
            toast.warning('Failed to fetch paper details', 'Using cached data')
          }
        } catch (error: any) {
          toast.warning('Failed to fetch paper details', error?.message || 'Using cached data')
        }
      }

      // CRITICAL: Do NOT use node.paper as fallback - it might be stale fallback data
      // Only use data that was explicitly fetched for this node
      if (!fullPaper) {
        toast.warning('No paper data available', 'Please try selecting a different node or use "Add Nodes" to add data.')
        return
      }
      
      // Validate that the fetched paper matches the node's paperId
      const fetchedPaperId = fullPaper.id?.toString().replace('corpus:', '').replace('paper-', '').replace('root-', '').trim()
      const expectedPaperId = paperId || node.paperId?.toString().replace('corpus:', '').replace('paper-', '').replace('root-', '').trim()
      
      if (fetchedPaperId && expectedPaperId && fetchedPaperId !== expectedPaperId) {
        console.warn(`Paper ID mismatch: fetched ${fetchedPaperId}, expected ${expectedPaperId}`)
        toast.warning('Data mismatch', 'The fetched paper does not match this node. Use "Add Nodes" to add correct data.')
        return
      }

      // Transfer selected fields (max 4) for this node
      const nodeSelectedFields = selectedFields.get(node.id) || new Map<string, string>()

    // Build metadata payload for transfer
    const metadataFields = getMetadataFields(fullPaper)
    const tableData = metadataFields.reduce<Record<string, string>>((acc, field) => {
      acc[field.fieldName] = formatFieldValue(field.fieldValue)
      return acc
    }, {})
    const keywords = Array.from(selectedKeywords.get(node.id) || new Set<string>())
    const nodeContext: NodeTransferPayload = {
      nodeId: node.id,
      paperId: fullPaper.id?.toString?.() || node.paperId,
      selectedFields: Object.fromEntries(nodeSelectedFields),
      apiFieldSelections: Object.fromEntries(nodeSelectedFields),
      keywords,
      tableData,
      metadataFields: metadataFields.map(field => ({
        fieldName: field.fieldName,
        displayName: field.displayName,
        value: field.fieldValue,
        displayValue: formatFieldValue(field.fieldValue),
      })),
      extractedValues: tableData,
    }

      // Invoke callback to create and switch chat
      const newChatId = await onCreateChatFromNode(fullPaper, new Map(nodeSelectedFields), nodeContext)
      
      if (!newChatId) {
        toast.error('Failed to create chat', 'Please try again')
        return
      }
      
      toast.success('Chat created successfully')

      // Reset UI state
      setMetadataPopupOpen(false)
      setKeywordPanelOpen(false)
      setSelectedNodeForMetadata(null)
    } catch (error: any) {
      toast.error('Failed to create chat', error?.message || 'Unknown error')
    } finally {
      // Clear loading indicator
      setLoadingNodes(prev => {
        const next = new Set(prev)
        next.delete(node.id)
        return next
      })
    }
  }

  // Update dimensions based on container size (debounced for performance)
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout
    
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        // Account for padding (p-8 = 32px on each side = 64px total)
        setDimensions({
          width: Math.max(800, rect.width - 64), // More horizontal space
          height: Math.max(500, rect.height - 64), // More vertical space
        })
      } else {
        setDimensions({ width, height })
      }
    }

    updateDimensions()
    
    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(updateDimensions, 150) // Debounce resize events
    }
    
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimeout)
    }
  }, [width, height])

  // DEPRECATED: This function should NOT be called from node clicks
  // Only "Add Nodes" (handleSearchSimilarPapers) should add new children
  // Keeping for backward compatibility but marking as deprecated
  const expandNode = async (nodeId: string, paperId: string) => {
    if (!chatId || loadingNodes.has(nodeId)) return

    // CRITICAL: Validate that the node has valid data before expanding
    // Find the node in treeData to verify it has valid paper data
    // Also validate that paper.id matches paperId to catch stale fallback data
    const findNode = (node: GraphNode | null, targetId: string): GraphNode | null => {
      if (!node) return null
      if (node.id === targetId) return node
      if (node.children) {
        for (const child of node.children) {
          const found = findNode(child, targetId)
          if (found) return found
        }
      }
      return null
    }
    
    const targetNode = findNode(treeData, nodeId)
    
    // CRITICAL: Validate paper data exists AND matches paperId (prevents stale fallback data)
    const hasValidData = targetNode && 
                        targetNode.paper && 
                        targetNode.paper.id && 
                        targetNode.paperId &&
                        targetNode.paper.id === targetNode.paperId
    
    if (!hasValidData) {
      console.warn(`Cannot expand node ${nodeId}: node has no valid paper data or data mismatch (stale fallback)`)
      toast.warning('Cannot expand node', 'This node has no valid data. Use "Add Nodes" to add data first.')
      return
    }

    // CRITICAL: Check if node already has 3 children - if so, don't fetch more
    const currentChildCount = (targetNode.children || []).length
    if (currentChildCount >= 3) {
      toast.info('Maximum children reached', 'This node already has 3 children. Use "Add More Nodes" to add additional papers.')
      return
    }

    setLoadingNodes(prev => new Set(prev).add(nodeId))
    try {
      const queryParams = new URLSearchParams()
      queryParams.set('chatId', chatId)
      queryParams.set('paperId', paperId)

      const response = await fetch(`/api/citation-network?${queryParams.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        const data: CitationNetworkResponse = await response.json()
        if (data.citationNetwork?.nodes) {
          // Helper to get score from node
          // CRITICAL: Use only the node's own data, NEVER fallback to parent or other nodes
          const getScore = (n: any): number => {
            if (n.score !== null && n.score !== undefined) return n.score
            const paperData = n.data as VeritusPaper
            // Only use this node's paper data, not parent's
            return paperData?.score || 0
          }
          
          // Find the node in tree data and add children (limited to top 3 by score)
          // These children come from a search on THIS parent node
          const addChildrenToNode = (node: GraphNode | null): GraphNode | null => {
            if (!node) return null
            if (node.id === nodeId) {
              const allNewChildren = data.citationNetwork!.nodes
                .filter(n => !n.isRoot)
                .map(n => ({
                  node: n,
                  score: getScore(n)
                }))
                .sort((a, b) => b.score - a.score) // Sort by score descending
                .slice(0, 3) // Take only top 3
                .map(({ node: n }): GraphNode | null => {
                  // CRITICAL: Use only the node's own data, NEVER fallback to parent paper
                  // This prevents the same data from traversing across all nodes
                  const paperData = n.data as VeritusPaper
                  
                  // Validate that we have actual paper data for this node
                  // NO FALLBACK - if no data, skip this child
                  if (!paperData || !paperData.id) {
                    console.warn(`Node ${n.id} has no valid paper data, skipping (no fallback)`)
                    return null
                  }
                  
                  // Ensure unique paper ID - use the paper's actual ID, not the node ID
                  const uniquePaperId = paperData.id
                  
                  // Check if this paper is already a child (prevent duplicates)
                  const existingChildIds = (node.children || []).map(c => c.paperId).filter(Boolean)
                  if (existingChildIds.includes(uniquePaperId)) {
                    console.warn(`Paper ${uniquePaperId} already exists as child, skipping duplicate`)
                    return null
                  }
                  
                  // Prevent child from having same paper as parent
                  if (uniquePaperId === node.paperId) {
                    console.warn(`Preventing circular reference: child paperId matches parent: ${uniquePaperId}`)
                    return null
                  }
                  
                  const fullLabel = n.label || paperData.title || 'Unknown'
                  const displayLabel = truncateText(fullLabel, 180)
                  
                  return {
                    id: n.id,
                    label: fullLabel,
                    displayLabel: displayLabel,
                    paper: paperData, // Use only this node's paper data - NO FALLBACK
                    paperId: uniquePaperId, // Use actual paper ID
                    expandable: true, // All nodes are expandable to fetch more children
                    keywords: paperData.fieldsOfStudy || [],
                    depth: node.depth + 1,
                    nodeType: n.nodeType || 'paper',
                    children: [], // Start with empty children - they will be populated when clicked
                  }
                })
                .filter((child): child is GraphNode => child !== null) // Remove null entries with type guard
              
              // CRITICAL: Prevent duplicate children by checking existing paper IDs
              const existingPaperIds = new Set((node.children || []).map(c => c.paperId).filter(Boolean))
              const uniqueNewChildren = allNewChildren.filter((child) => {
                // Skip if this paper already exists as a child
                if (existingPaperIds.has(child.paperId)) {
                  console.warn(`Skipping duplicate child with paperId: ${child.paperId}`)
                  return false
                }
                // Skip if this is the same as the parent node
                if (child.paperId === node.paperId) {
                  console.warn(`Skipping child that matches parent paperId: ${child.paperId}`)
                  return false
                }
                existingPaperIds.add(child.paperId) // Track added IDs
                return true
              })
              
              // CRITICAL: Enforce maximum of 3 children
              // Calculate how many children we can add (max 3 total)
              const currentCount = (node.children || []).length
              const maxToAdd = Math.max(0, 3 - currentCount)
              const childrenToAdd = uniqueNewChildren.slice(0, maxToAdd)
              
              // Store parent→child relationships in chatstore (async, don't await)
              if (childrenToAdd.length > 0 && chatId) {
                const childPapers = childrenToAdd.map(child => ({
                  id: child.paperId,
                  title: child.label || child.paper?.title || 'Unknown',
                  sourceParentId: node.paperId, // Parent paper ID
                }))
                
                // Store parent→child relationship in chatstore (fire and forget)
                fetch(`/api/v1/papers/store-children?chatId=${chatId}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    paperId: node.paperId,
                    childPapers: childPapers,
                  }),
                })
                  .then(response => {
                    if (!response.ok) {
                      console.warn('Failed to store parent→child relationship in chatstore')
                    } else {
                    }
                  })
                  .catch(error => {
                    console.error('Error storing parent→child relationship:', error)
                    // Don't fail the operation if chatstore update fails
                  })
              }
              
              return {
                ...node,
                children: node.children && node.children.length > 0 
                  ? [...node.children, ...childrenToAdd] // Append new unique children (max 3 total)
                  : childrenToAdd, // Add new children only if none exist
                expandable: true, // Keep expandable so child nodes can also be expanded
              }
            }
            return {
              ...node,
              children: node.children?.map(addChildrenToNode).filter(Boolean) as GraphNode[],
            }
          }
          const updatedTree = treeData ? addChildrenToNode(treeData) : null
          setTreeData(updatedTree)
          setExpandedNodes(prev => new Set(prev).add(nodeId))
        }
      }
    } catch (error) {
      console.error('Error expanding node:', error)
      toast.error('Failed to expand node', 'Could not fetch children for this node.')
    } finally {
      setLoadingNodes(prev => {
        const next = new Set(prev)
        next.delete(nodeId)
        return next
      })
    }
  }

  useEffect(() => {
    if (!svgRef.current || !treeData) return

    const svg = d3.select(svgRef.current)
    
    // Set up zoom behavior - create or reuse existing zoom
    let zoom = zoomRef.current
    if (!zoom) {
      zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 3])
        .on('zoom', (event) => {
          if (svgRef.current) {
            const currentSvg = d3.select(svgRef.current)
            const g = currentSvg.select('g')
            if (g.node()) {
              g.attr('transform', event.transform)
              zoomLevelRef.current = event.transform.k
              
              if (zoomDisplayRef.current) {
                const nodeCount = treeData ? countNodes(treeData) : 0
                zoomDisplayRef.current.textContent = `Zoom: ${Math.round(event.transform.k * 100)}% | ${nodeCount} nodes | Click nodes to expand/collapse`
              }
            }
          }
        })
      zoomRef.current = zoom
    }

    // Clear previous render but preserve zoom transform
    const existingG = svg.select('g')
    const existingGNode = existingG.node()
    const existingTransform = existingGNode ? existingG.attr('transform') : null
    
    // Remove all child elements
    svg.selectAll('g').remove()

    const g = svg.append('g')
    
    // Restore previous transform if it existed
    if (existingTransform) {
      g.attr('transform', existingTransform)
    }
    
    // CRITICAL: Reapply zoom to SVG to enable wheel zoom
    // This must be done after clearing and recreating elements
    svg.call(zoom)

    // Create hierarchy from tree data
    const root = d3.hierarchy(treeData as any) as any
    // With nodeSize, root starts at (0,0), so we adjust initial position
    root.x0 = 50 // Start from left for horizontal layout
    root.y0 = dimensions.height / 2 // Center vertically

    // Create tree layout (horizontal) with much more spacing to prevent overlap
    // Use nodeSize for better control over individual node spacing
    const tree = d3.tree()
      .nodeSize([120, 300]) // [height spacing, width spacing] - increased for better separation
      .separation((a: any, b: any) => {
        // Much larger separation to prevent overlap
        // Base separation increases with depth to prevent crowding
        if (a.parent === b.parent) {
          // Siblings: larger separation
          return 1.5 + (a.depth * 0.3)
        } else {
          // Different parents: even larger separation
          return 2.0 + (a.depth * 0.5)
        }
      })

    // Collapse all nodes initially except root and nodes in expandedNodes
    root.children?.forEach((child: any) => {
      const nodeData = child.data as GraphNode
      // Only collapse if node is not in expandedNodes
      if (!expandedNodes.has(nodeData.id)) {
        collapse(child)
      } else {
        // Node should be expanded - recursively expand its children if they're in expandedNodes
        if (child.children) {
          child.children.forEach((grandchild: any) => {
            const grandchildData = grandchild.data as GraphNode
            if (!expandedNodes.has(grandchildData.id)) {
              collapse(grandchild)
            }
          })
        }
      }
    })

    let i = 0
    update(root)

    function collapse(d: any) {
      if (d.children) {
        d._children = d.children
        d._children.forEach(collapse)
        d.children = undefined
      }
    }

    function countNodes(node: GraphNode): number {
      let count = 1
      if (node.children) {
        node.children.forEach(child => {
          count += countNodes(child)
        })
      }
      return count
    }

    function update(source: any) {
      const treeData = tree(root as any)

      const nodes = treeData.descendants()
      const links = treeData.links()

      // Normalize for fixed-depth (horizontal layout) with increased horizontal spacing
      // nodeSize handles spacing, but we ensure minimum spacing
      nodes.forEach((d: any) => {
        // Use nodeSize spacing (300px width per level) or ensure minimum
        d.x = d.depth * 350 // Increased horizontal spacing between levels for better separation
      })

      // Helper function to calculate bounding box for a node including field panel
      const getNodeBoundingBox = (node: any) => {
        const nodeId = node.data.id
        const nodeRadius = node.depth === 0 ? 12 : 10
        const fields = selectedFields.get(nodeId) || new Map<string, string>()
        const hasFields = fields.size > 0
        const keywords = Array.from(selectedKeywords.get(nodeId) || new Set<string>()).slice(0, 4)
        
        // Calculate keyword box area
        const keywordBoxWidth = keywords.length > 0 ? (keywords.length * 90) + 20 : 0
        
        // Field panel width is fixed at 260px
        const fieldPanelWidth = hasFields ? 260 + 15 : 0 // 15px spacing from node
        
        // Total width extends to the right of the node (panel or keywords, whichever is wider)
        const totalWidth = Math.max(
          nodeRadius * 2 + 15 + keywordBoxWidth,
          nodeRadius * 2 + fieldPanelWidth
        )
        
        // Field panel height (max 220px + padding)
        const fieldPanelHeight = hasFields ? Math.min(220 + 50, fields.size * 40 + 50) : 0
        
        // Total height extends below the node
        const totalHeight = Math.max(
          nodeRadius * 2,
          nodeRadius * 2 + fieldPanelHeight
        )
        
        return {
          x: node.x - nodeRadius,
          y: node.y - nodeRadius,
          width: totalWidth,
          height: totalHeight,
          right: node.x + totalWidth - nodeRadius,
          bottom: node.y + totalHeight - nodeRadius
        }
      }
      

      // Collision detection with bounding boxes accounting for field boxes
      // Group nodes by parent and check for overlaps
      const nodesByParent = new Map<any, any[]>()
      nodes.forEach((node: any) => {
        if (node.parent) {
          const parentId = node.parent.data?.id || node.parent
          if (!nodesByParent.has(parentId)) {
            nodesByParent.set(parentId, [])
          }
          nodesByParent.get(parentId)!.push(node)
        }
      })

      // Initial distribution for each parent's children
      nodesByParent.forEach((siblings) => {
        if (siblings.length === 0) return
        
        const parent = siblings[0].parent
        let centerY = parent?.y || dimensions.height / 2
        
        if (parent && parent.depth === 0) {
          centerY = dimensions.height / 2
        }
        
        const count = siblings.length
        const initialSpacing = 200 // Initial spacing (will be adjusted by collision detection)
        
        // Distribute nodes initially
        if (count === 3) {
          siblings.forEach((node, index) => {
            if (index === 0) node.y = centerY - initialSpacing
            else if (index === 1) node.y = centerY
            else node.y = centerY + initialSpacing
          })
        } else {
          const halfCount = Math.floor(count / 2)
          siblings.forEach((node, index) => {
            if (count % 2 === 1) {
              if (index === halfCount) node.y = centerY
              else if (index < halfCount) node.y = centerY - (halfCount - index) * initialSpacing
              else node.y = centerY + (index - halfCount) * initialSpacing
              } else {
              if (index < halfCount) node.y = centerY - (halfCount - index - 0.5) * initialSpacing
              else node.y = centerY + (index - halfCount + 0.5) * initialSpacing
            }
          })
        }
      })
      
      // Collision detection and resolution with bounding boxes
      const minHorizontalSpacing = 60 // Minimum horizontal spacing between nodes
      const minVerticalSpacing = 40 // Minimum vertical spacing between nodes
      
      // Calculate bounding boxes for all nodes
      const nodeBounds = new Map<any, ReturnType<typeof getNodeBoundingBox>>()
      nodes.forEach((node: any) => {
        nodeBounds.set(node, getNodeBoundingBox(node))
      })
      
      // Resolve collisions iteratively
      let iterations = 0
      const maxIterations = 50
      let hasCollisions = true
      
      while (hasCollisions && iterations < maxIterations) {
        hasCollisions = false
        iterations++
        
        // Check all pairs of nodes for collisions
        for (let i = 0; i < nodes.length; i++) {
          const nodeA = nodes[i]
          const boundsA = getNodeBoundingBox(nodeA)
          
          for (let j = i + 1; j < nodes.length; j++) {
            const nodeB = nodes[j]
            const boundsB = getNodeBoundingBox(nodeB)
            
            // Check if bounding boxes overlap
            const horizontalOverlap = boundsA.right > boundsB.x && boundsB.right > boundsA.x
            const verticalOverlap = boundsA.bottom > boundsB.y && boundsB.bottom > boundsA.y
            
            if (horizontalOverlap && verticalOverlap) {
              hasCollisions = true
              
              // Calculate overlap amounts
              const horizontalOverlapAmount = Math.min(
                boundsA.right - boundsB.x,
                boundsB.right - boundsA.x
              )
              const verticalOverlapAmount = Math.min(
                boundsA.bottom - boundsB.y,
                boundsB.bottom - boundsA.y
              )
              
              // Resolve collision by pushing nodes apart
              // If nodes are at same depth (siblings), adjust vertically
              if (nodeA.depth === nodeB.depth) {
                const currentVerticalDistance = Math.abs(nodeB.y - nodeA.y)
                const neededVerticalDistance = Math.max(
                  minVerticalSpacing,
                  (boundsA.height + boundsB.height) / 2 + minVerticalSpacing
                )
                
                if (currentVerticalDistance < neededVerticalDistance) {
                  const shift = (neededVerticalDistance - currentVerticalDistance) / 2
                  if (nodeA.y < nodeB.y) {
                    nodeA.y -= shift
                    nodeB.y += shift
            } else {
                    nodeA.y += shift
                    nodeB.y -= shift
                  }
                }
              } else {
                // Different depths - adjust vertically to avoid overlap
                const currentVerticalDistance = Math.abs(nodeB.y - nodeA.y)
                const neededVerticalDistance = Math.max(
                  minVerticalSpacing,
                  (boundsA.height + boundsB.height) / 2 + minVerticalSpacing
                )
                
                if (currentVerticalDistance < neededVerticalDistance) {
                  const shift = (neededVerticalDistance - currentVerticalDistance) / 2
                  if (nodeA.y < nodeB.y) {
                    nodeA.y -= shift
                    nodeB.y += shift
                  } else {
                    nodeA.y += shift
                    nodeB.y -= shift
                  }
                }
              }
            }
          }
        }
        
        // Ensure nodes don't go outside bounds
        const minY = 50
        const maxY = dimensions.height - 50
      nodes.forEach((node: any) => {
        if (node.y < minY) node.y = minY
        if (node.y > maxY) node.y = maxY
      })
      }
      
      // Final pass: ensure minimum spacing between siblings
      nodesByParent.forEach((siblings) => {
        if (siblings.length <= 1) return
        siblings.sort((a, b) => a.y - b.y)
        
        for (let i = 0; i < siblings.length - 1; i++) {
          const nodeA = siblings[i]
          const nodeB = siblings[i + 1]
          const boundsA = getNodeBoundingBox(nodeA)
          const boundsB = getNodeBoundingBox(nodeB)
          
          const currentDistance = nodeB.y - nodeA.y
          const neededDistance = Math.max(
            minVerticalSpacing,
            (boundsA.height + boundsB.height) / 2 + minVerticalSpacing
          )
          
          if (currentDistance < neededDistance) {
            const shift = neededDistance - currentDistance
            // Push nodeB down
            nodeB.y += shift
            
            // Adjust all subsequent nodes
            for (let j = i + 2; j < siblings.length; j++) {
              siblings[j].y += shift
            }
          }
        }
      })

      // Update the nodes
      const node = g
        .selectAll<SVGGElement, any>('g.node')
        .data(nodes, (d: any) => d.data.id || (d.data.id = `node-${++i}`))

      // Enter any new nodes
      const nodeEnter = node
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', () => `translate(${source.x0},${source.y0})`)

      // Add circle for the nodes (increased size to accommodate plus button)
      nodeEnter
        .append('circle')
        .attr('r', (d: any) => {
          return d.depth === 0 ? 12 : 10 // Increased from 8/6 to 12/10
        })
        .attr('fill', (d: any) => {
          if (d.depth === 0) return '#ffd93d' // Root - yellow
          if (d._children) return '#4ade80' // Collapsed - green
          if (d.children) return '#22c55e' // Expanded - bright green
          return '#86efac' // Leaf - light green
        })
        .attr('stroke', (d: any) => {
          return d.depth === 0 ? '#fbbf24' : '#16a34a'
        })
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('click', async (event, d: any) => {
          event.stopPropagation()
          const nodeData = d.data as GraphNode
          
          // CRITICAL: Click behavior - expand/collapse existing children OR fetch stored children from chatstore
          if (d.children && d.children.length > 0) {
            // Node has children - collapse them
            d._children = d.children
            d.children = undefined
            update(d)
            setExpandedNodes(prev => {
              const next = new Set(prev)
              next.delete(nodeData.id)
              return next
            })
          } else if (d._children && d._children.length > 0) {
            // Node has collapsed children - restore them
            d.children = d._children
            d._children = undefined
            update(d)
            setExpandedNodes(prev => new Set(prev).add(nodeData.id))
          } else {
            // Node has no visible children - check if there are stored children in chatstore
            // This happens after a search job completes - fetch stored children and add them
            if (!nodeData.paperId) {
              console.warn('Node has no paperId, cannot fetch children')
              toast.info(
                'No child nodes',
                'This node has no paper ID. Use "Add Nodes" to explore similar papers.'
              )
              return
            }
            
            if (!chatId) {
              console.warn('No chatId available, cannot fetch children')
              toast.info(
                'No child nodes',
                'Chat ID is missing. Cannot fetch children.'
              )
              return
            }
            
            // Clear loading state if it's stuck (safety check)
            if (loadingNodes.has(nodeData.id)) {
              setLoadingNodes(prev => {
                const next = new Set(prev)
                next.delete(nodeData.id)
                return next
              })
              // Small delay to ensure state clears, then continue
              setTimeout(() => {
                // Will retry below after function is defined
              }, 100)
            }
            
            // Function to fetch children (extracted for retry logic)
            const fetchChildren = () => {
              setLoadingNodes(prev => new Set(prev).add(nodeData.id))
              
              // Normalize paperId (remove prefixes) to match storage format
              // CRITICAL: Convert to string to ensure type consistency with backend
              let normalizedPaperId = nodeData.paperId ? String(nodeData.paperId).replace('corpus:', '').replace('paper-', '').replace('root-', '').trim() : ''
              
              // Fetch stored children from chatstore API
              const apiUrl = `/api/v1/papers/store-children?chatId=${encodeURIComponent(chatId)}&paperId=${encodeURIComponent(normalizedPaperId)}`
              
              fetch(apiUrl)
                .then(response => {
                  if (response.ok) {
                    return response.json()
                  }
                  // Try to get error message from response
                  return response.json().then(errorData => {
                    throw new Error(errorData.error || `Failed to fetch stored children: ${response.statusText}`)
                  }).catch(() => {
                    throw new Error(`Failed to fetch stored children: ${response.statusText}`)
                  })
                })
                .then(data => {
                  const storedChildren = data.childPapers || []
                  
                  if (storedChildren && storedChildren.length > 0) {
                    // Mark node as expanded FIRST so D3 will show children when tree re-renders
                    setExpandedNodes(prev => new Set(prev).add(nodeData.id))
                    
                    // Use setTreeData callback to access current state (avoids shadowing issues)
                    setTreeData((currentTreeState: GraphNode | null) => {
                      if (!currentTreeState) {
                        console.warn('No current tree state to update')
                        return null
                      }
                      
                      // Add stored children to the node
                      const addStoredChildrenToNode = (node: GraphNode | null): GraphNode | null => {
                        if (!node) return null
                        if (node.id === nodeData.id) {
                          // Check existing children to prevent duplicates
                          const existingPaperIds = new Set((node.children || []).map(c => c.paperId).filter(Boolean))
                          
                          // Create child nodes from stored data - use full paper data if available
                          const newChildren = storedChildren
                            .filter((cp: any) => !existingPaperIds.has(cp.id) && cp.id !== node.paperId)
                            .slice(0, 3 - (node.children || []).length) // Max 3 total
                            .map((cp: any) => {
                              // Use full paper data from chatstore if available, otherwise create minimal paper
                              const fullPaper: VeritusPaper = cp.paper || {
                                id: cp.id,
                                title: cp.title || 'Unknown',
                                abstract: null,
                                authors: '',
                                doi: null,
                                downloadable: false,
                                fieldsOfStudy: [],
                                impactFactor: {
                                  citationCount: 0,
                                  influentialCitationCount: 0,
                                  referenceCount: 0,
                                },
                                journalName: null,
                                publicationType: null,
                                publishedAt: null,
                                tldr: null,
                                year: null,
                              }
                              
                              return {
                                id: `child-${cp.id}-${Date.now()}`,
                                label: fullPaper.title || cp.title || 'Unknown',
                                displayLabel: truncateText(fullPaper.title || cp.title || 'Unknown', 180),
                                paper: fullPaper, // Use full paper data from chatstore
                                paperId: cp.id,
                                expandable: true,
                                keywords: fullPaper.fieldsOfStudy || [],
                                depth: node.depth + 1,
                                nodeType: 'paper' as const,
                                parentId: node.id,
                                children: [], // Start empty
                              } as GraphNode
                            })
                          
                          return {
                            ...node,
                            children: [...(node.children || []), ...newChildren].slice(0, 3),
                          }
                        }
                        return {
                          ...node,
                          children: node.children?.map((child: GraphNode) => addStoredChildrenToNode(child)).filter(Boolean) as GraphNode[],
                        }
                      }
                      
                      const updatedTree = addStoredChildrenToNode(currentTreeState)
                      // The useEffect will automatically re-render the D3 tree with expanded node
                      return updatedTree
                    })
                  } else {
                    // No stored children - show message
                    toast.info(
                      'No child nodes',
                      'This node has no children yet. Use "Add Nodes" to explore similar papers.'
                    )
                  }
                })
                .catch(error => {
                  console.error('Error fetching stored children:', error)
                  console.error('Error details:', {
                    message: error.message,
                    stack: error.stack,
                    nodeId: nodeData.id,
                    paperId: nodeData.paperId,
                    normalizedPaperId: normalizedPaperId,
                    chatId: chatId
                  })
                  toast.error(
                    'Failed to fetch children',
                    error.message || 'Could not retrieve child nodes. Please try again.'
                  )
                })
                .finally(() => {
                  // Always clear loading state, even on error
                  setLoadingNodes(prev => {
                    const next = new Set(prev)
                    next.delete(nodeData.id)
                    return next
                  })
                })
            }
            
            // Start the fetch
            fetchChildren()
          }
        })

      // Add simple text labels
      // Root node: label on LEFT side, Other nodes: label on RIGHT side
      nodeEnter
        .append('text')
        .attr('x', (d: any) => {
          if (d.depth === 0) {
            // Root node: position label on the LEFT side
            return -15 // Negative value places it to the left
          } else {
            // Other nodes: position label on the RIGHT side
            return 15
          }
        })
        .attr('dy', '0.35em') // Vertically center with circle
        .attr('text-anchor', (d: any) => {
          // Root: right-align (text ends at x position), Others: left-align (text starts at x position)
          return d.depth === 0 ? 'end' : 'start'
        })
        .attr('fill', '#e5e7eb')
        .attr('font-size', '12px')
        .attr('font-weight', (d: any) => d.depth === 0 ? 'bold' : 'normal')
        .style('cursor', 'pointer')
        .style('pointer-events', 'none') // Prevent text from blocking clicks
        .text((d: any) => {
          const nodeData = d.data as GraphNode
          const fullTitle = nodeData.label || nodeData.displayLabel || 'Unknown'
          // Truncate to max 30 characters with ellipsis
          if (fullTitle.length > 30) {
            return fullTitle.substring(0, 30) + '...'
          }
          return fullTitle
        })
        .each(function(d: any) {
          // Add title tooltip to show full title on hover
          const nodeData = d.data as GraphNode
          const fullTitle = nodeData.label || nodeData.displayLabel || 'Unknown'
          d3.select(this)
            .append('title')
            .text(fullTitle) // Show full title in tooltip
        })
        .on('click', (event, d: any) => {
          event.stopPropagation()
          const nodeData = d.data as GraphNode
          if (nodeData.paper && onNodeClick) {
            onNodeClick(nodeData.paper)
          }
        })

      // Add plus button for metadata popup
      const plusButtonGroup = nodeEnter
        .append('g')
        .attr('class', 'metadata-plus-button')
        .attr('data-node-id', (d: any) => {
          const nodeData = d.data as GraphNode
          return nodeData.id || 'unknown'
        })
        .attr('transform', 'translate(12, -12)') // Position to top-right of node
        .style('cursor', 'pointer')
        .style('opacity', 0.9)
        .on('click', async (event, d: any) => {
          event.stopPropagation()
          event.preventDefault()
          
          // CRITICAL: Get the node data from the D3 data binding
          // d.data contains the GraphNode, d is the D3 hierarchy node
          const nodeData = d.data as GraphNode
          
          // Validate we have the correct node
          if (!nodeData || !nodeData.id) {
            console.error('Invalid node data in plus button click:', d)
            return
          }
          
          // Verify the data-node-id attribute matches (if available)
          const clickedElement = event.currentTarget as SVGElement
          const dataNodeId = clickedElement.getAttribute('data-node-id')
          if (dataNodeId && dataNodeId !== nodeData.id) {
            console.error('Node ID mismatch! data-node-id:', dataNodeId, 'nodeData.id:', nodeData.id)
            // Still proceed, but log the error
          }
          
          
          // Create a fresh copy of the node data to avoid reference issues
          const nodeCopy: GraphNode = {
            ...nodeData,
            paper: nodeData.paper ? { ...nodeData.paper } : undefined,
            children: nodeData.children ? [...nodeData.children] : undefined,
          }
          
          setSelectedNodeForMetadata(nodeCopy)
          setLoadingMetadata(true)
          setMetadataPopupOpen(true)
          setKeywordPanelOpen(false) // Don't auto-open, wait for user to click "Add More Nodes"
            
          // Fetch full paper metadata from chatstore
          try {
            // Extract paperId - handle different formats (corpus:123, paper-123, or just 123)
            let paperId = nodeCopy.paperId || nodeCopy.paper?.id
            if (paperId) {
              // Remove 'corpus:' prefix if present
              paperId = paperId.toString().replace('corpus:', '').replace('paper-', '').replace('root-', '').trim()
            }
            
            
            if (paperId && chatId) {
              // Fetch real data from chatstore (respects DEBUG env, no forced mock)
              const response = await fetch(`/api/v1/papers/${paperId}?chatId=${chatId}`)
              if (response.ok) {
                const data = await response.json()
                if (data.paper) {
                  // Validate that fetched paper matches the node's paperId
                  const fetchedId = data.paper.id?.toString().replace('corpus:', '').replace('paper-', '').replace('root-', '').trim()
                  const expectedId = paperId || nodeCopy.paperId?.toString().replace('corpus:', '').replace('paper-', '').replace('root-', '').trim()
                  
                  if (fetchedId && expectedId && fetchedId === expectedId) {
                    setNodeMetadataFromChatstore(data.paper)
                  } else {
                    console.warn(`Paper ID mismatch: fetched ${fetchedId}, expected ${expectedId}`)
                    // Do NOT use fallback - node has invalid/stale data
                    setNodeMetadataFromChatstore(null)
                  }
                } else {
                  // CRITICAL: Do NOT use fallback - node might have stale data
                  console.warn('No paper in response, node has no valid data')
                  setNodeMetadataFromChatstore(null)
                }
              } else {
                // CRITICAL: Do NOT use fallback - node might have stale data
                console.warn('Fetch failed, node has no valid data')
                setNodeMetadataFromChatstore(null)
              }
            } else {
              // CRITICAL: Do NOT use fallback - validate node has valid data first
              if (nodeCopy.paper && nodeCopy.paperId && nodeCopy.paper.id === nodeCopy.paperId) {
                // Only use node.paper if it's validated (matches paperId)
                setNodeMetadataFromChatstore(nodeCopy.paper)
              } else {
                console.warn('No paperId or chatId, and node has no valid data')
                setNodeMetadataFromChatstore(null)
              }
            }
          } catch (error) {
            console.error('Error fetching paper metadata from chatstore:', error)
            // CRITICAL: Do NOT use fallback - node might have stale data
            setNodeMetadataFromChatstore(null)
          } finally {
            setLoadingMetadata(false)
          }
        })
        .on('mouseenter', function() {
          d3.select(this).style('opacity', 1)
        })
        .on('mouseleave', function() {
          d3.select(this).style('opacity', 0.9)
        })

      plusButtonGroup
        .append('circle')
        .attr('r', 8)
        .attr('fill', '#22c55e')
        .attr('stroke', '#16a34a')
        .attr('stroke-width', 1.5)

      plusButtonGroup
        .append('text')
        .attr('x', 0)
        .attr('y', 0)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', 'white')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .text('+')
        .style('pointer-events', 'none')

      // Make the entire node group clickable
      nodeEnter
        .style('cursor', 'pointer')
        .on('click', (event, d: any) => {
          event.stopPropagation()
          const nodeData = d.data as GraphNode
          if (nodeData.paper && onNodeClick) {
            onNodeClick(nodeData.paper)
          }
        })

      // Update
      const nodeUpdate = nodeEnter.merge(node as any)

      // Transition to proper position
      nodeUpdate
        .transition()
        .duration(300)
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`)

      // Update node attributes
      nodeUpdate
        .select('circle')
        .attr('r', (d: any) => {
          return d.depth === 0 ? 12 : 10 // Increased size
        })
        .attr('fill', (d: any) => {
          if (d.depth === 0) return '#ffd93d'
          if (d._children) return '#4ade80'
          if (d.children) return '#22c55e'
          return '#86efac'
        })
        .attr('stroke', (d: any) => {
          return d.depth === 0 ? '#fbbf24' : '#16a34a'
        })
        .attr('stroke-width', 2)

      // Update text labels
      nodeUpdate
        .select('text')
        .attr('x', (d: any) => {
          // Root node: label on LEFT, Other nodes: label on RIGHT
          return d.depth === 0 ? -15 : 15
        })
        .attr('text-anchor', (d: any) => {
          return d.depth === 0 ? 'end' : 'start'
        })
        .attr('dy', '0.35em')
        .text((d: any) => {
          const nodeData = d.data as GraphNode
          const fullTitle = nodeData.label || nodeData.displayLabel || 'Unknown'
          // Truncate to max 30 characters with ellipsis
          if (fullTitle.length > 30) {
            return fullTitle.substring(0, 30) + '...'
          }
          return fullTitle
        })
        .attr('font-weight', (d: any) => d.depth === 0 ? 'bold' : 'normal')
        .each(function(d: any) {
          // Update tooltip with full title on hover
          const nodeData = d.data as GraphNode
          const fullTitle = nodeData.label || nodeData.displayLabel || 'Unknown'
          const titleElement = d3.select(this).select('title')
          if (titleElement.empty()) {
            d3.select(this).append('title').text(fullTitle)
          } else {
            titleElement.text(fullTitle)
          }
        })

      // Update plus buttons visibility and ensure click handlers are bound correctly
      const plusButtonsUpdate = nodeUpdate
        .selectAll('g.metadata-plus-button')
        .attr('data-node-id', (d: any) => {
          const nodeData = d.data as GraphNode
          return nodeData.id || 'unknown'
        })
        .style('display', 'block')
      
      // Rebind click handler to ensure it uses the correct node data
      // This is important because D3 data binding can get confused during updates
      plusButtonsUpdate.on('click', async (event, d: any) => {
        event.stopPropagation()
        event.preventDefault()
        
        // CRITICAL: Get the node data from the D3 data binding
        const nodeData = d.data as GraphNode
        
        // Validate we have the correct node
        if (!nodeData || !nodeData.id) {
          console.error('Invalid node data in plus button click (update):', d)
          return
        }
        
        // Verify the data-node-id attribute matches (if available)
        const clickedElement = event.currentTarget as SVGElement
        const dataNodeId = clickedElement.getAttribute('data-node-id')
        if (dataNodeId && dataNodeId !== nodeData.id) {
          console.error('Node ID mismatch in update! data-node-id:', dataNodeId, 'nodeData.id:', nodeData.id)
          // Still proceed, but log the error
        }
        
        
        // Create a fresh copy of the node data to avoid reference issues
        const nodeCopy: GraphNode = {
          ...nodeData,
          paper: nodeData.paper ? { ...nodeData.paper } : undefined,
          children: nodeData.children ? [...nodeData.children] : undefined,
        }
        
        setSelectedNodeForMetadata(nodeCopy)
        setLoadingMetadata(true)
        setMetadataPopupOpen(true)
        setKeywordPanelOpen(false)
          
        // Fetch full paper metadata from chatstore
        try {
          let paperId = nodeCopy.paperId || nodeCopy.paper?.id
          if (paperId) {
            paperId = paperId.toString().replace('corpus:', '').replace('paper-', '').replace('root-', '').trim()
          }
          
          if (paperId && chatId) {
            // Fetch real data from chatstore (respects DEBUG env, no forced mock)
            const response = await fetch(`/api/v1/papers/${paperId}?chatId=${chatId}`)
              if (response.ok) {
                const data = await response.json()
                if (data.paper) {
                  // Validate that fetched paper matches the node's paperId
                  const fetchedId = data.paper.id?.toString().replace('corpus:', '').replace('paper-', '').replace('root-', '').trim()
                  const expectedId = paperId || nodeCopy.paperId?.toString().replace('corpus:', '').replace('paper-', '').replace('root-', '').trim()
                  
                  if (fetchedId && expectedId && fetchedId === expectedId) {
                    setNodeMetadataFromChatstore(data.paper)
                  } else {
                    console.warn(`Paper ID mismatch: fetched ${fetchedId}, expected ${expectedId}`)
                    // Do NOT use fallback - node has invalid/stale data
                    setNodeMetadataFromChatstore(null)
                  }
                } else {
                  // CRITICAL: Do NOT use fallback - node might have stale data
                  console.warn('No paper in response, node has no valid data')
                  setNodeMetadataFromChatstore(null)
                }
              } else {
                // CRITICAL: Do NOT use fallback - node might have stale data
                console.warn('Fetch failed, node has no valid data')
                setNodeMetadataFromChatstore(null)
              }
            } else {
              // CRITICAL: Do NOT use fallback - validate node has valid data first
              if (nodeCopy.paper && nodeCopy.paperId && nodeCopy.paper.id === nodeCopy.paperId) {
                // Only use node.paper if it's validated (matches paperId)
                setNodeMetadataFromChatstore(nodeCopy.paper)
              } else {
                console.warn('No paperId or chatId, and node has no valid data')
                setNodeMetadataFromChatstore(null)
              }
            }
          } catch (error) {
            console.error('Error fetching paper metadata from chatstore:', error)
            // CRITICAL: Do NOT use fallback - node might have stale data
            setNodeMetadataFromChatstore(null)
        } finally {
          setLoadingMetadata(false)
        }
      })

      // Remove exiting nodes
      const nodeExit = node.exit()
        .transition()
        .duration(300)
        .attr('transform', () => `translate(${source.x},${source.y})`)
        .remove()

      nodeExit.select('circle').attr('r', 1e-6)
      nodeExit.select('text').style('fill-opacity', 1e-6)

      // Update the links (thinner and lighter for less visual clutter)
      const link = g
        .selectAll<SVGPathElement, any>('path.link')
        .data(links, (d: any) => d.target.data.id)

      const linkEnter = link
        .enter()
        .insert('path', 'g')
        .attr('class', 'link')
        .attr('d', () => {
          const o = { x: source.x0, y: source.y0 }
          return diagonal({ x: o.x, y: o.y } as any, { x: o.x, y: o.y } as any)
        })
        .attr('fill', 'none')
        .attr('stroke', '#4a5568')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.6)

      const linkUpdate = linkEnter.merge(link)

      linkUpdate
        .transition()
        .duration(300)
        .attr('d', (d: any) => diagonal(d.source, d.target))

      link.exit()
        .transition()
        .duration(300)
        .attr('d', () => {
          const o = { x: source.x, y: source.y }
          return diagonal({ x: o.x, y: o.y } as any, { x: o.x, y: o.y } as any)
        })
        .remove()

      nodes.forEach((d: any) => {
        d.x0 = d.x
        d.y0 = d.y
      })

      // Render keyword boxes for nodes with selected keywords (max 4 per node)
      // Position boxes beside nodes horizontally with auto spacing
      const keywordBoxData = nodes.filter((d: any) => {
        const nodeId = d.data.id
        const keywords = selectedKeywords.get(nodeId)
        return keywords && keywords.size > 0
      }).flatMap((nodeD: any) => {
        const nodeId = nodeD.data.id
        const keywords = Array.from(selectedKeywords.get(nodeId) || new Set()).slice(0, 4) // Max 4 keywords
        return keywords.map((keyword, index) => ({
          node: nodeD,
          keyword,
          nodeId,
          index
        }))
      })

      const keywordBoxes = g
        .selectAll<SVGGElement, any>('g.keyword-box')
        .data(keywordBoxData, (d: any) => `keyword-${d.nodeId}-${d.keyword}`)

      const keywordBoxEnter = keywordBoxes
        .enter()
        .append('g')
        .attr('class', 'keyword-box')

      // For each keyword, render a box beside the node
      keywordBoxEnter.each(function(d: any) {
        const nodeD = d.node
        const nodeRadius = nodeD.depth === 0 ? 12 : 10
        const keyword = d.keyword as string
        
        const boxGroup = d3.select(this)
        
        // Calculate box position - beside node, horizontally arranged
        // Estimate keyword text width (approximately 8px per character)
        const keywordWidth = Math.max(keyword.length * 8 + 30, 80) // Minimum 80px width
        const boxX = nodeD.x + nodeRadius + 15 + (d.index * (keywordWidth + 10)) // Horizontal spacing
        const boxY = nodeD.y - 12 // Align with node vertically
        
        // Box background (square/rounded rectangle)
        boxGroup
          .append('rect')
          .attr('x', boxX)
          .attr('y', boxY)
          .attr('width', keywordWidth)
          .attr('height', 24)
          .attr('fill', '#1f1f1f')
          .attr('stroke', '#60a5fa')
          .attr('stroke-width', 1.5)
          .attr('rx', 4)

        // Keyword text
        boxGroup
          .append('text')
          .attr('x', boxX + keywordWidth / 2)
          .attr('y', boxY + 15)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('fill', '#93c5fd')
          .attr('font-size', '11px')
          .attr('font-weight', '500')
          .text(keyword.length > 15 ? keyword.substring(0, 15) + '...' : keyword)

        // Remove button (×)
        const removeButton = boxGroup
          .append('g')
          .attr('class', 'remove-keyword-button')
          .attr('transform', `translate(${boxX + keywordWidth - 12}, ${boxY + 4})`)
          .style('cursor', 'pointer')
          .on('click', (event) => {
            event.stopPropagation()
            setSelectedKeywords(prev => {
              const next = new Map(prev)
              const nodeKeywords = next.get(d.nodeId) || new Set()
              nodeKeywords.delete(d.keyword)
              if (nodeKeywords.size === 0) {
                next.delete(d.nodeId)
              } else {
                next.set(d.nodeId, nodeKeywords)
              }
              return next
            })
          })

        removeButton
          .append('circle')
          .attr('r', 6)
          .attr('fill', '#ef4444')
          .attr('stroke', '#dc2626')
          .attr('stroke-width', 1)

        removeButton
          .append('text')
          .attr('x', 0)
          .attr('y', 0)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('fill', 'white')
          .attr('font-size', '10px')
          .text('×')
          .style('pointer-events', 'none')
      })

      // Update existing keyword boxes positions
      const keywordBoxUpdate = keywordBoxEnter.merge(keywordBoxes)
      
      keywordBoxUpdate
        .select('rect')
        .attr('x', (d: any) => {
          const nodeRadius = d.node.depth === 0 ? 12 : 10
          const keywordWidth = Math.max(d.keyword.length * 8 + 30, 80)
          return d.node.x + nodeRadius + 15 + (d.index * (keywordWidth + 10))
        })
        .attr('y', (d: any) => d.node.y - 12)
        .attr('width', (d: any) => Math.max((d.keyword as string).length * 8 + 30, 80))

      keywordBoxUpdate
        .selectAll('text')
        .each(function(d: any) {
          const textEl = d3.select(this as SVGTextElement)
          if (!textEl.text().includes('×')) {
            const keywordWidth = Math.max(d.keyword.length * 8 + 30, 80)
            const nodeRadius = d.node.depth === 0 ? 12 : 10
            textEl
              .attr('x', d.node.x + nodeRadius + 15 + (d.index * (keywordWidth + 10)) + keywordWidth / 2)
              .attr('y', d.node.y + 3)
          }
        })
        .attr('x', (d: any) => {
          const keywordWidth = Math.max(d.keyword.length * 8 + 30, 80)
          const nodeRadius = d.node.depth === 0 ? 12 : 10
          return d.node.x + nodeRadius + 15 + (d.index * (keywordWidth + 10)) + keywordWidth / 2
        })
        .attr('y', (d: any) => d.node.y + 3)

      keywordBoxUpdate
        .select('g.remove-keyword-button')
        .attr('transform', (d: any) => {
          const nodeRadius = d.node.depth === 0 ? 12 : 10
          const keywordWidth = Math.max(d.keyword.length * 8 + 30, 80)
          const boxX = d.node.x + nodeRadius + 15 + (d.index * (keywordWidth + 10))
          return `translate(${boxX + keywordWidth - 12}, ${d.node.y - 8})`
        })

      keywordBoxes.exit().remove()

      // Helper function to calculate collision-aware panel position
      const calculatePanelPosition = (node: any, fieldCount: number) => {
          const nodeRadius = node.depth === 0 ? 12 : 10
        const minMargin = 12 // Minimum margin from node circle
        const panelWidth = 260
        const panelHeight = Math.min(220, 50 + (fieldCount * 40)) // Approximate height based on field count
        
        // Default position: +20px right, -10px up from node center
        // Position panel's top-left corner relative to node center
        let panelX = node.x + nodeRadius + 20
        let panelY = node.y - 10
        
        // Calculate node bounding box (circle)
        const nodeLeft = node.x - nodeRadius
        const nodeRight = node.x + nodeRadius
        const nodeTop = node.y - nodeRadius
        const nodeBottom = node.y + nodeRadius
        
        // Calculate panel bounding box
        const panelLeft = panelX
        const panelRight = panelX + panelWidth
        const panelTop = panelY
        const panelBottom = panelY + panelHeight
        
        // Check for horizontal overlap (right side)
        if (panelLeft < nodeRight + minMargin) {
          // Panel overlaps on the right, position it to the left of the node
          panelX = node.x - nodeRadius - panelWidth - minMargin
        }
        
        // Check for vertical overlap (below)
        if (panelTop < nodeBottom + minMargin) {
          // Panel overlaps below, position it above the node
          panelY = node.y - nodeRadius - panelHeight - minMargin
        }
        
        // Ensure minimum margin from node circle
        // Recalculate after adjustments
        const finalPanelLeft = panelX
        const finalPanelRight = panelX + panelWidth
        const finalPanelTop = panelY
        const finalPanelBottom = panelY + panelHeight
        
        // Final horizontal adjustment if still too close
        if (finalPanelLeft < nodeRight + minMargin && finalPanelRight > nodeLeft - minMargin) {
          // Still overlapping horizontally, choose the side with more space
          const spaceRight = dimensions.width - nodeRight
          const spaceLeft = nodeLeft
          if (spaceRight >= spaceLeft) {
            panelX = nodeRight + minMargin
          } else {
            panelX = nodeLeft - panelWidth - minMargin
          }
        }
        
        // Final vertical adjustment if still too close
        if (finalPanelTop < nodeBottom + minMargin && finalPanelBottom > nodeTop - minMargin) {
          // Still overlapping vertically, choose the side with more space
          const spaceBelow = dimensions.height - nodeBottom
          const spaceAbove = nodeTop
          if (spaceBelow >= spaceAbove) {
            panelY = nodeBottom + minMargin
          } else {
            panelY = nodeTop - panelHeight - minMargin
          }
        }
        
        return { x: panelX, y: panelY }
      }

      // Render selected fields panels as foreignObject elements inside SVG
      // Positioned next to each node with collision detection
      const fieldPanelData = nodes.filter((d: any) => {
        const nodeId = d.data.id
        const fields = selectedFields.get(nodeId)
        // Show panel if fields are selected (always show, regardless of collapse state)
        return fields && fields.size > 0
      }).map((d: any) => {
        const nodeId = d.data.id
        const fields = selectedFields.get(nodeId) || new Map<string, string>()
        const fieldCount = fields.size
        const position = calculatePanelPosition(d, fieldCount)
        return {
          ...d,
          panelX: position.x,
          panelY: position.y,
          fieldCount
        }
      })

      const fieldPanels = g
        .selectAll<SVGForeignObjectElement, any>('foreignObject.field-panel')
        .data(fieldPanelData, (d: any) => `panel-${d.data.id}`)

      const fieldPanelEnter = fieldPanels
        .enter()
        .append('foreignObject')
        .attr('class', 'field-panel')
        .attr('width', 260)
        .attr('height', (d: any) => Math.min(220, 50 + (d.fieldCount * 40))) // Dynamic height based on field count
        .attr('x', (d: any) => d.panelX)
        .attr('y', (d: any) => d.panelY)
        .style('pointer-events', 'auto')
        .style('overflow', 'visible')
        .style('opacity', 1) // Start visible - panels should always be visible when fields are selected
        .style('display', 'block')

      // Create HTML content for each panel
      fieldPanelEnter.each(function(d: any) {
        const nodeId = d.data.id
        const fields = selectedFields.get(nodeId) || new Map<string, string>()
        const fieldEntries = Array.from(fields.entries())
        
        const foreignObject = d3.select(this)
        const div = foreignObject.append('xhtml:div')
          .style('width', '260px')
          .style('max-height', '220px')
          .style('background', '#1A1A1A')
          .style('border', '1px solid #2A2A2A')
          .style('border-radius', '6px')
          .style('padding', '12px')
          .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.3)')
          .style('font-family', 'system-ui, -apple-system, sans-serif')
          .style('overflow-y', 'auto')
          .style('overflow-x', 'hidden')
          .style('pointer-events', 'auto')
        
        // Header
        div.append('xhtml:div')
          .style('font-size', '10px')
          .style('font-weight', '600')
          .style('text-transform', 'uppercase')
          .style('letter-spacing', '0.5px')
          .style('color', '#EDEDED')
          .style('margin-bottom', '8px')
          .text('Selected Fields')
        
        // Field list
        const fieldList = div.append('xhtml:div')
          .style('display', 'flex')
          .style('flex-direction', 'column')
          .style('gap', '8px')
        
        fieldEntries.forEach(([fieldName, fieldValue]) => {
          const fieldRow = fieldList.append('xhtml:div')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('justify-content', 'space-between')
            .style('background', '#262626')
            .style('border-left', '3px solid #22C55E')
            .style('border-radius', '4px')
            .style('padding', '8px')
            .style('font-size', '12px')
            .style('color', '#EDEDED')
            .style('transition', 'background-color 0.2s')
            .on('mouseenter', function() {
              d3.select(this).style('background', '#333333')
            })
            .on('mouseleave', function() {
              d3.select(this).style('background', '#262626')
            })
          
          const fieldText = fieldRow.append('xhtml:span')
            .style('flex', '1')
            .style('overflow', 'hidden')
            .style('text-overflow', 'ellipsis')
            .style('white-space', 'nowrap')
            .style('padding-right', '8px')
            .attr('title', fieldValue)
            .text(`• ${fieldValue}`)
          
          const removeButton = fieldRow.append('xhtml:button')
            .style('flex-shrink', '0')
            .style('background', 'transparent')
            .style('border', 'none')
            .style('color', '#F87171')
            .style('cursor', 'pointer')
            .style('font-size', '16px')
            .style('line-height', '1')
            .style('padding', '0')
            .style('width', '20px')
            .style('height', '20px')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('justify-content', 'center')
            .style('transition', 'color 0.2s')
            .text('×')
            .on('mouseenter', function() {
              d3.select(this).style('color', '#ef4444')
            })
            .on('mouseleave', function() {
              d3.select(this).style('color', '#F87171')
            })
            .on('click', function(event) {
              event.stopPropagation()
              setSelectedFields(prev => {
                const next = new Map(prev)
                const nodeFields = next.get(nodeId)
                if (nodeFields) {
                  const newFields = new Map(nodeFields)
                  newFields.delete(fieldName)
                  if (newFields.size === 0) {
                    next.delete(nodeId)
                } else {
                    next.set(nodeId, newFields)
                  }
                }
                return next
              })
            })
        })
      })

      // Update panel positions with collision-aware positioning
      const fieldPanelUpdate = fieldPanelEnter.merge(fieldPanels)
      
      // Recalculate positions for updates (in case node moved)
      fieldPanelUpdate.each(function(d: any) {
        const nodeId = d.data.id
        const fields = selectedFields.get(nodeId) || new Map<string, string>()
        const fieldCount = fields.size
        const position = calculatePanelPosition(d, fieldCount)
        d.panelX = position.x
        d.panelY = position.y
        d.fieldCount = fieldCount
      })
      
      fieldPanelUpdate
        .transition()
        .duration(300)
        .ease(d3.easeCubicOut)
        .attr('x', (d: any) => d.panelX)
        .attr('y', (d: any) => d.panelY)
        .attr('height', (d: any) => Math.min(220, 50 + (d.fieldCount * 40)))
        .style('opacity', 1) // Always show panels when fields are selected
      
      // Panels are already visible (opacity 1 set on enter), but ensure they're displayed
      fieldPanelEnter
        .style('opacity', 1)
        .style('display', 'block')

      // Update panel visibility and content when fields change
      fieldPanelUpdate.each(function(d: any) {
        const nodeId = d.data.id
        const fields = selectedFields.get(nodeId) || new Map<string, string>()
        const fieldEntries = Array.from(fields.entries())
        const isCollapsed = d._children && !d.children
        
        const foreignObject = d3.select(this)
        // Always show panel if fields exist, regardless of collapse state
        foreignObject.style('display', fieldEntries.length === 0 ? 'none' : 'block')
        
        if (fieldEntries.length > 0) {
          // Update panel height based on field count
          const estimatedHeight = Math.min(220, 50 + (fieldEntries.length * 40))
          foreignObject.attr('height', estimatedHeight)
          
          // Remove existing content and recreate to ensure it's up to date
          foreignObject.selectAll('*').remove()
          
          const div = foreignObject.append('xhtml:div')
            .style('width', '260px')
            .style('max-height', `${estimatedHeight}px`)
            .style('background', '#1A1A1A')
            .style('border', '1px solid #2A2A2A')
            .style('border-radius', '6px')
            .style('padding', '12px')
            .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.3)')
            .style('font-family', 'system-ui, -apple-system, sans-serif')
            .style('overflow-y', 'auto')
            .style('overflow-x', 'hidden')
            .style('pointer-events', 'auto')
          
          div.append('xhtml:div')
            .style('font-size', '10px')
            .style('font-weight', '600')
            .style('text-transform', 'uppercase')
            .style('letter-spacing', '0.5px')
            .style('color', '#EDEDED')
            .style('margin-bottom', '8px')
            .text('Selected Fields')
          
          const fieldList = div.append('xhtml:div')
            .style('display', 'flex')
            .style('flex-direction', 'column')
            .style('gap', '8px')
          
          fieldEntries.forEach(([fieldName, fieldValue]) => {
            const fieldRow = fieldList.append('xhtml:div')
              .style('display', 'flex')
              .style('align-items', 'center')
              .style('justify-content', 'space-between')
              .style('background', '#262626')
              .style('border-left', '3px solid #22C55E')
              .style('border-radius', '4px')
              .style('padding', '8px')
              .style('font-size', '12px')
              .style('color', '#EDEDED')
              .style('transition', 'background-color 0.2s')
              .on('mouseenter', function() {
                d3.select(this).style('background', '#333333')
              })
              .on('mouseleave', function() {
                d3.select(this).style('background', '#262626')
              })
            
            const fieldText = fieldRow.append('xhtml:span')
              .style('flex', '1')
              .style('overflow', 'hidden')
              .style('text-overflow', 'ellipsis')
              .style('white-space', 'nowrap')
              .style('padding-right', '8px')
              .attr('title', fieldValue)
              .text(`• ${fieldValue}`)
            
            const removeButton = fieldRow.append('xhtml:button')
              .style('flex-shrink', '0')
              .style('background', 'transparent')
              .style('border', 'none')
              .style('color', '#F87171')
              .style('cursor', 'pointer')
              .style('font-size', '16px')
              .style('line-height', '1')
              .style('padding', '0')
              .style('width', '20px')
              .style('height', '20px')
              .style('display', 'flex')
              .style('align-items', 'center')
              .style('justify-content', 'center')
              .style('transition', 'color 0.2s')
              .text('×')
              .on('mouseenter', function() {
                d3.select(this).style('color', '#ef4444')
              })
              .on('mouseleave', function() {
                d3.select(this).style('color', '#F87171')
              })
              .on('click', function(event) {
                event.stopPropagation()
                setSelectedFields(prev => {
                  const next = new Map(prev)
                  const nodeFields = next.get(nodeId)
                  if (nodeFields) {
                    const newFields = new Map(nodeFields)
                    newFields.delete(fieldName)
                    if (newFields.size === 0) {
                      next.delete(nodeId)
                    } else {
                      next.set(nodeId, newFields)
                    }
                  }
                  return next
                })
              })
          })
        }
      })

      fieldPanels.exit().remove()

      function diagonal(s: any, d: any) {
        // Horizontal layout: curve goes from left to right
        // Start from right edge of source circle, end before target circle to avoid label overlap
        const sourceRadius = s.depth === 0 ? 12 : 10 // Match node radius
        const targetRadius = d.depth === 0 ? 12 : 10
        const sourceX = s.x + sourceRadius // Right edge of circle
        const targetX = d.x - targetRadius // Before target circle
        const midX = (sourceX + targetX) / 2
        
        return `M ${sourceX} ${s.y}
                C ${midX} ${s.y},
                  ${midX} ${d.y},
                  ${targetX} ${d.y}`
      }
    }

    // Initial zoom to fit
    const gNode = g.node() as SVGGElement | null
    if (!initialZoomSetRef.current && gNode && zoomRef.current) {
      initialZoomSetRef.current = true
      requestAnimationFrame(() => {
        if (!svgRef.current || !zoomRef.current) return
        const currentG = d3.select(svgRef.current).select('g')
        const currentGNode = currentG.node() as SVGGElement | null
        if (!currentGNode) return

        try {
          const bounds = currentGNode.getBBox()
          if (bounds && bounds.width > 0 && bounds.height > 0 && zoomRef.current) {
            const fullWidth = bounds.width
            const fullHeight = bounds.height
            const scale = Math.min(dimensions.width / fullWidth, dimensions.height / fullHeight) * 0.8
            const translate = [
              (dimensions.width - fullWidth * scale) / 2 - bounds.x * scale,
              (dimensions.height - fullHeight * scale) / 2 - bounds.y * scale,
            ]
            const svg = d3.select(svgRef.current!)
            svg
              .transition()
              .duration(750)
              .call(
                zoomRef.current.transform as any,
                d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
              )
            zoomLevelRef.current = scale
            if (zoomDisplayRef.current) {
              const nodeCount = treeData ? countNodes(treeData) : 0
              zoomDisplayRef.current.textContent = `Zoom: ${Math.round(scale * 100)}% | ${nodeCount} nodes | Click nodes to expand/collapse`
            }
          }
        } catch (error) {
          console.warn('Could not calculate bounds for initial zoom:', error)
        }
      })
    }
  }, [dimensions.width, dimensions.height, treeData, chatId, onNodeClick, selectedKeywords, selectedFields])

  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      const svg = d3.select(svgRef.current)
      svg.transition().duration(300).call(zoomRef.current.scaleBy as any, 1.5)
    }
  }

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      const svg = d3.select(svgRef.current)
      svg.transition().duration(300).call(zoomRef.current.scaleBy as any, 1 / 1.5)
    }
  }

  const handleDownloadPNG = async () => {
    if (!svgRef.current) {
      toast.warning('Graph not ready', 'Please wait a moment and try again')
      return
    }

    try {
      // Clone the SVG to avoid modifying the original
      const svgElement = svgRef.current.cloneNode(true) as SVGSVGElement
      
      // Remove UI elements that shouldn't be in the export
      // Remove plus buttons
      const buttonsToRemove = svgElement.querySelectorAll('.metadata-plus-button')
      buttonsToRemove.forEach(btn => btn.remove())
      
      // Remove field panels (foreignObject elements) as they won't render in PNG
      const fieldPanels = svgElement.querySelectorAll('foreignObject.field-panel')
      fieldPanels.forEach(panel => panel.remove())
      
      // Get SVG dimensions
      const svgWidth = svgElement.width.baseVal.value || dimensions.width
      const svgHeight = svgElement.height.baseVal.value || dimensions.height
      
      // Set explicit width and height on SVG for proper rendering
      svgElement.setAttribute('width', String(svgWidth))
      svgElement.setAttribute('height', String(svgHeight))
      svgElement.setAttribute('style', 'background: #0f0f0f;')
      
      // Get the current transform from the zoom
      const gElement = svgElement.querySelector('g')
      if (gElement && zoomRef.current) {
        // Preserve the current zoom/pan state in the export
        const currentTransform = gElement.getAttribute('transform')
        if (currentTransform) {
          // The transform is already applied, so we keep it
        }
      }
      
      // Serialize SVG to string
      const svgData = new XMLSerializer().serializeToString(svgElement)
      
      // Create a canvas to render the SVG
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        toast.error('Failed to export graph', 'Could not get canvas context')
        return
      }

      // Set canvas dimensions (use 2x scale for better quality)
      const exportScale = 2
      canvas.width = svgWidth * exportScale
      canvas.height = svgHeight * exportScale
      ctx.scale(exportScale, exportScale)

      // Fill background
      ctx.fillStyle = '#0f0f0f'
      ctx.fillRect(0, 0, svgWidth, svgHeight)

      // Create an image from the SVG data
      const img = new Image()
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      img.onload = () => {
        try {
          // Draw the SVG image onto the canvas
          ctx.drawImage(img, 0, 0, svgWidth, svgHeight)

          // Convert canvas to PNG and download
          canvas.toBlob((blob) => {
            if (!blob) {
              toast.error('Failed to export graph', 'Could not create image file')
              URL.revokeObjectURL(url)
              return
            }

            const blobUrl = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = blobUrl
            
            // Generate filename with timestamp and paper title
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
            const rootPaperTitle = treeData?.paper?.title || treeData?.label || 'citation-network'
            const sanitizedTitle = rootPaperTitle
              .replace(/[^a-z0-9\s]/gi, '-')
              .replace(/\s+/g, '-')
              .toLowerCase()
              .slice(0, 50)
            link.download = `citation-network-${sanitizedTitle}-${timestamp}.png`
            
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            
            // Clean up
            setTimeout(() => {
              URL.revokeObjectURL(blobUrl)
              URL.revokeObjectURL(url)
            }, 100)
          }, 'image/png', 1.0) // Maximum quality
        } catch (error: any) {
          toast.error('Failed to export graph', error?.message || 'Could not draw image to canvas')
          URL.revokeObjectURL(url)
        }
      }

      img.onerror = (error) => {
        console.error('Error loading SVG image:', error)
        alert('Failed to export graph as PNG. The graph may contain elements that cannot be exported. Please try again.')
        URL.revokeObjectURL(url)
      }

      img.src = url
    } catch (error: any) {
      toast.error('Failed to export graph', error?.message || 'An unexpected error occurred')
    }
  }

  const handleReset = () => {
    if (svgRef.current && zoomRef.current) {
      const svg = d3.select(svgRef.current)
      const g = d3.select(svgRef.current).select('g')
      const gNode = g.node() as SVGGElement | null
      if (gNode) {
        try {
          const bounds = gNode.getBBox()
          if (bounds && bounds.width > 0 && bounds.height > 0) {
            const fullWidth = bounds.width
            const fullHeight = bounds.height
            const scale = Math.min(dimensions.width / fullWidth, dimensions.height / fullHeight) * 0.8
            const translate = [
              (dimensions.width - fullWidth * scale) / 2 - bounds.x * scale,
              (dimensions.height - fullHeight * scale) / 2 - bounds.y * scale,
            ]
            svg
              .transition()
              .duration(500)
              .call(
                zoomRef.current.transform as any,
                d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
              )
            zoomLevelRef.current = scale
            if (zoomDisplayRef.current) {
              const nodeCount = treeData ? countNodes(treeData) : 0
              zoomDisplayRef.current.textContent = `Zoom: ${Math.round(scale * 100)}% | ${nodeCount} nodes | Click nodes to expand/collapse`
            }
          }
        } catch (error) {
          console.warn('Could not calculate bounds for reset:', error)
        }
      }
    }
  }

  if (!treeData) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>No citation network data available</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col p-4 gap-4">
      {/* Container with padding and spacing */}
      <div ref={containerRef} className="relative bg-[#0f0f0f] rounded-lg border border-[#2a2a2a] w-full flex-1 min-h-[400px] overflow-hidden">
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleZoomIn}
            className="bg-[#1f1f1f] border-[#2a2a2a] text-gray-300 h-8 hover:bg-[#2a2a2a]"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleZoomOut}
            className="bg-[#1f1f1f] border-[#2a2a2a] text-gray-300 h-8 hover:bg-[#2a2a2a]"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            className="bg-[#1f1f1f] border-[#2a2a2a] text-gray-300 h-8 hover:bg-[#2a2a2a]"
            title="Reset Zoom"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadPNG}
            className="bg-[#1f1f1f] border-[#2a2a2a] text-gray-300 h-8 hover:bg-[#2a2a2a]"
            title="Download as PNG"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
        <div 
          ref={zoomDisplayRef}
          className="absolute top-4 left-4 z-10 text-xs text-gray-400 bg-[#1f1f1f]/80 px-2 py-1 rounded"
        >
          Zoom: 100% | {treeData ? countNodes(treeData) : 0} nodes | Click nodes to expand/collapse
        </div>
        {/* SVG container with padding to prevent edge clipping - enable hover zoom */}
        <div 
          className="w-full h-full p-8"
          style={{ overflow: 'hidden', touchAction: 'none' }}
        >
          <svg 
            ref={svgRef} 
            width={dimensions.width} 
            height={dimensions.height} 
            className="w-full h-full cursor-move"
            style={{ touchAction: 'none', display: 'block' }}
          />
        </div>
      </div>

      {/* Enhanced Node Panel */}
      <Dialog open={metadataPopupOpen} onOpenChange={(open) => {
        setMetadataPopupOpen(open)
        if (!open) {
          // Cleanup when dialog closes
          setNodeMetadataFromChatstore(null)
          setLoadingMetadata(false)
          setKeywordPanelOpen(false)
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0f0f0f] border-[#2a2a2a]">
        <DialogHeader>
            {/* Display paper title above the dialog title */}
            {(() => {
              const paper = nodeMetadataFromChatstore || selectedNodeForMetadata?.paper
              const paperTitle = paper?.title 
              const titleLink = paper?.titleLink
              return paperTitle ? (
                <div className="mb-3 pb-3 border-b border-[#2a2a2a]">
                  <div className="flex items-center gap-2">
                    <p className="text-xl text-white font-bold leading-relaxed flex-1">{paperTitle}</p>
                    <div className="flex items-center gap-2">
                      {/* Copy paper title button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(paperTitle)
                          toast.success('Paper title copied to clipboard')
                        }}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-[#2a2a2a]"
                        title="Copy paper title"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {/* Open title link button */}
                      {titleLink && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            window.open(titleLink, '_blank', 'noopener,noreferrer')
                          }}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-[#2a2a2a]"
                          title="Open paper link"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : null
            })()}
            <DialogTitle className="text-white">Add Nodes to Citation Network</DialogTitle>
            {/* <DialogDescription>
              {selectedNodeForMetadata?.label || 'Add new nodes or search for similar papers'}
            </DialogDescription> */}
          </DialogHeader>
          
          {selectedNodeForMetadata && (() => {
            const node = selectedNodeForMetadata
            const nodeId = node.id
            const paper = nodeMetadataFromChatstore || node.paper
            const metadataFields = paper ? getMetadataFields(paper) : []
            // Get current selected fields for this node - create a new Map to ensure reactivity
            const currentFields = selectedFields.get(nodeId)
            const nodeSelectedFields = currentFields ? new Map(currentFields) : new Map<string, string>()
            const canSelectMore = nodeSelectedFields.size < 4
            
            // Create a handler that ensures we use the current node from selectedNodeForMetadata
            // This prevents closure issues where the wrong node might be captured
            const handleCreateChatClick = async () => {
              // Always use the current selectedNodeForMetadata, not the closure variable
              const currentNode = selectedNodeForMetadata
              
              if (!currentNode) {
                toast.warning('No node selected', 'Please select a node first')
                return
              }
              
              // Verify the node matches what we expect
              if (currentNode.id !== nodeId) {
                toast.warning('Node mismatch', 'Using different node than expected')
                // Still proceed with currentNode to ensure we use the latest selection
              }
              
              
              // Use the current selectedNodeForMetadata to ensure we have the latest data
              await handleCreateChatFromNode(currentNode)
            }
            
              return (
              <div key={`node-${nodeId}-${nodeSelectedFields.size}`} className="mt-4 space-y-4">
                {/* Add More Nodes Button */}
                <div className="flex justify-start items-center gap-3">
                  <Button
                    onClick={handleAddEmptyNode}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    size="lg"
                    disabled={searchInProgress}
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    Add More Nodes (Legacy)
                  </Button>
                  <Button
                    onClick={handleCreateChatClick}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    size="lg"
                    disabled={searchInProgress || !onCreateChatFromNode}
                  >
                    <FileText className="mr-2 h-5 w-5" />
                    Create Chat
                  </Button>
                  {/* Show spinner indicator when search is running but popup is closed */}
                  {searchInProgress && !searchPopupOpen && (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Searching...</span>
                    </div>
                  )}
                </div>

                {/* API Response Table */}
                {paper && metadataFields.length > 0 && (
                  <div className="border-t border-[#2a2a2a] pt-4">
                    <div className="mb-3">
                      <h3 className="text-white text-lg font-medium mb-1">API Response Fields</h3>
                      <p className="text-sm text-gray-400">
                        Select up to 4 fields to display beside the node ({nodeSelectedFields.size} / 4 selected)
                      </p>
                      {nodeSelectedFields.size >= 4 && (
                        <p className="text-xs text-yellow-400 mt-1">
                          Maximum of 4 fields selected. Deselect a field to select another.
                        </p>
                      )}
                </div>
                    <div className="border border-[#2a2a2a] rounded-lg overflow-hidden bg-[#171717]">
                      <div className="max-h-[400px] overflow-y-auto">
                        {/* Table Header */}
                        <div className="grid grid-cols-[50px_1fr_2fr] gap-4 p-3 border-b border-[#2a2a2a] bg-[#1f1f1f] sticky top-0">
                          <div className="text-gray-300 font-medium text-sm">Select</div>
                          <div className="text-gray-300 font-medium text-sm">Field Name</div>
                          <div className="text-gray-300 font-medium text-sm">Value</div>
                </div>
                        {/* Table Body */}
                        <div className="divide-y divide-[#2a2a2a]">
                          {metadataFields.map((field, index) => {
                            const isSelected = nodeSelectedFields.has(field.fieldName)
                            const displayValue = formatFieldValue(field.fieldValue)
                            const truncatedValue = displayValue.length > 100 
                              ? displayValue.substring(0, 100) + '...' 
                              : displayValue
                      
                      return (
                        <div
                                key={`${field.fieldName}-${index}`}
                                className="grid grid-cols-[50px_1fr_2fr] gap-4 p-3 hover:bg-[#1f1f1f] transition-colors"
                              >
                                <div className="flex items-center">
                                  <Checkbox
                                    id={`field-checkbox-${nodeId}-${field.fieldName}`}
                                    checked={isSelected}
                                    disabled={(!isSelected && !canSelectMore) || searchInProgress}
                                    onChange={(e) => {
                                      const checked = e.target.checked
                                      setSelectedFields(prev => {
                                    const next = new Map(prev)
                                        // Get existing fields or create new empty Map
                                        const existingFields = next.get(nodeId)
                                        // Create a new Map instance to ensure React detects the change
                                        const fields = existingFields ? new Map(existingFields) : new Map<string, string>()
                                        if (checked) {
                                          if (fields.size < 4) {
                                            const displayValue = formatFieldValue(field.fieldValue)
                                            fields.set(field.fieldName, displayValue)
                                            next.set(nodeId, new Map(fields)) // Ensure we set a new Map instance
                                          }
                                        } else {
                                          fields.delete(field.fieldName)
                                          if (fields.size === 0) {
                                            next.delete(nodeId)
                                          } else {
                                            next.set(nodeId, new Map(fields)) // Ensure we set a new Map instance
                                          }
                                    }
                                    return next
                                  })
                                }}
                                    className="border-[#2a2a2a] checked:bg-[#FF6B35] checked:border-[#FF6B35]"
                                  />
                                </div>
                                <div className="text-gray-300 font-medium text-sm flex items-center">
                                  {field.displayName}
                                </div>
                                <div className="text-gray-400 text-xs font-mono flex items-center break-words">
                                  {truncatedValue}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                      </div>
                    </div>
                  </div>
                )}

                {loadingMetadata && (
                  <div className="text-center py-8">
                    <p className="text-gray-400">Loading metadata from chatstore...</p>
                  </div>
                )}

                {!paper && !loadingMetadata && (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No metadata available for this node</p>
                  </div>
                )}
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Keyword Selection Panel - Separate dialog to match styling */}
      {selectedNodeForMetadata?.paperId && (
        <KeywordSelectionPanel
          open={keywordPanelOpen}
          onOpenChange={(open) => {
            setKeywordPanelOpen(open)
            // Clean up empty nodes if panel is closed without searching (only if no search is in progress)
            if (!open && selectedNodeForMetadata && !searchInProgress) {
              // Check if there are empty nodes that need cleanup
              const hasEmptyNodes = Array.from(emptyNodes.keys()).length > 0
              if (hasEmptyNodes) {
                const removeEmptyNodesFromTree = (node: GraphNode | null): GraphNode | null => {
                  if (!node) return null
                  if (node.id === selectedNodeForMetadata.id) {
                    // Filter out empty nodes from children
                    const filteredChildren = (node.children || []).filter(child => {
                      const isEmpty = child.label === 'New Node' || 
                                     child.displayLabel === 'New Node' || 
                                     child.id.startsWith('empty-') || 
                                     emptyNodes.has(child.id)
                      if (isEmpty) {
                        setEmptyNodes(prev => {
                          const next = new Map(prev)
                          next.delete(child.id)
                          return next
                        })
                      }
                      return !isEmpty
                    })
                    return {
                      ...node,
                      children: filteredChildren,
                    }
                  }
                  return {
                    ...node,
                    children: node.children?.map(removeEmptyNodesFromTree).filter(Boolean) as GraphNode[],
                  }
                }
                setTreeData(prev => prev ? removeEmptyNodesFromTree(prev) : null)
              }
            }
          }}
          corpusId={(() => {
            let paperId = selectedNodeForMetadata.paperId || selectedNodeForMetadata.paper?.id || ''
            return paperId.toString().replace('corpus:', '').replace('paper-', '').replace('root-', '').trim()
          })()}
          messages={messages}
          chatId={chatId || undefined}
          depth={100}
          initialSuggestions={keywordSuggestions}
          onSearch={handleSearchSimilarPapers}
        />
      )}

      {/* Search Progress Popup */}
      <Dialog 
        open={searchPopupOpen} 
        onOpenChange={(open) => {
          // Allow closing popup without canceling search
          // Only close visually, search continues in background
          setSearchPopupOpen(open)
        }}
      >
        <DialogContent className="bg-[#0f0f0f] border-[#2a2a2a]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              Searching for Papers
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-300">
              Searching for papers… The graph will auto-update once results are received.
            </p>
            <p className="text-sm text-gray-400 mt-2">
              You can close this dialog - the search will continue in the background.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* REMOVED: Search Results Panel Dialog - replaced with toast notification */}
      {/* Search results are now stored in chatstore and retrieved when user clicks the node */}
    </div>
  )
}

function countNodes(node: GraphNode): number {
  let count = 1
  if (node.children) {
    node.children.forEach((child: GraphNode) => {
      count += countNodes(child)
    })
  }
  return count
}
