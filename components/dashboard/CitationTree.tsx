'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { ExternalLink, Download, Users, Calendar, TrendingUp, Star, BookOpen, FileText, MoreVertical, ChevronRight, ChevronDown, Plus, Maximize2, X } from 'lucide-react'
import { CitationNetworkResponse } from '@/types/paper-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePaperCache } from '@/lib/hooks/use-paper-cache'
import { CitationTreeFilters, SortOption, SortOrder, FilterState } from './CitationTreeFilters'
import { shouldUseMockData } from '@/lib/config/mock-config'
import { TreeView, TreeDataItem, TreeRenderItemParams } from '@/components/ui/tree-view'
import { transformToTreeData } from '@/lib/utils/citation-tree-transform'
import { PaperDetailsPopover } from './PaperDetailsPopover'
import { CitationTreeVisualization } from './CitationTreeVisualization'
import { VeritusPaper } from '@/types/veritus'
import { NodeTransferPayload } from '@/types/graph-node'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
}

interface CitationTreeProps {
  citationNetworkResponse?: CitationNetworkResponse
  chatId?: string | null
  messages?: any[] // Chat messages to initialize cache from
  onNodeClick?: (nodeId: string) => void
  onExpandNode?: (nodeId: string) => Promise<CitationNetworkResponse | null>
  onCreateChatFromNode?: (
    paper: VeritusPaper,
    selectedFields?: Map<string, string>,
    nodeContext?: NodeTransferPayload
  ) => Promise<string | null>
  onCreateChatFromHeading?: (titleOrPaper: string | VeritusPaper) => Promise<string | null>
}

export function CitationTree({ citationNetworkResponse, chatId, messages, onNodeClick, onExpandNode, onCreateChatFromNode, onCreateChatFromHeading }: CitationTreeProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set())
  const [expandedData, setExpandedData] = useState<Map<string, TreeNode[]>>(new Map())
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortOption>('relevance')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [filters, setFilters] = useState<FilterState>({})
  const [popoverPaper, setPopoverPaper] = useState<VeritusPaper | null>(null)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  const useMock = shouldUseMockData()
  const { getCachedPaper, fetchPaperDetails } = usePaperCache(chatId, messages)

  // Build tree structure from citation network (for extracting filter options)
  const treeData = useMemo(() => {
    if (!citationNetworkResponse?.citationNetwork) return null

    const { nodes, edges } = citationNetworkResponse.citationNetwork
    const rootNode = nodes.find(n => n.isRoot)
    
    if (!rootNode) return null

    const childrenMap = new Map<string, TreeNode[]>()
    
    edges.forEach(edge => {
      const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as any)?.id || edge.source
      const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as any)?.id || edge.target
      
      if (sourceId === rootNode.id) {
        if (!childrenMap.has(rootNode.id)) {
          childrenMap.set(rootNode.id, [])
        }
        const childNode = nodes.find(n => n.id === targetId)
        if (childNode) {
          const nodeData = (childNode.data || {}) as any
          childrenMap.get(rootNode.id)!.push({
            id: childNode.id,
            label: childNode.label,
            type: childNode.type,
            citations: childNode.citations,
            references: childNode.references,
            year: childNode.year,
            authors: childNode.authors,
            score: childNode.score ?? nodeData?.score ?? null,
            publicationType: nodeData?.publicationType || nodeData?.publication_type || null,
            data: nodeData,
            children: [],
          })
        }
      }
      
      if (targetId === rootNode.id) {
        if (!childrenMap.has(rootNode.id)) {
          childrenMap.set(rootNode.id, [])
        }
        const citingNode = nodes.find(n => n.id === sourceId)
        if (citingNode && !childrenMap.get(rootNode.id)!.some(n => n.id === citingNode.id)) {
          const nodeData = (citingNode.data || {}) as any
          childrenMap.get(rootNode.id)!.push({
            id: citingNode.id,
            label: citingNode.label,
            type: citingNode.type,
            citations: citingNode.citations,
            references: citingNode.references,
            year: citingNode.year,
            authors: citingNode.authors,
            score: citingNode.score ?? nodeData?.score ?? null,
            publicationType: nodeData?.publicationType || nodeData?.publication_type || null,
            data: nodeData,
            children: [],
          })
        }
      }
    })

    const rootData = (rootNode.data || citationNetworkResponse.paper || {}) as any
    return {
      id: rootNode.id,
      label: rootNode.label,
      type: 'root' as const,
      citations: rootNode.citations,
      references: rootNode.references,
      year: rootNode.year,
      authors: rootNode.authors,
      score: rootNode.score ?? rootData?.score ?? null,
      publicationType: rootData?.publicationType || rootData?.publication_type || null,
      data: rootData,
      children: childrenMap.get(rootNode.id) || [],
    }
  }, [citationNetworkResponse])

  // Extract available filter options
  const availableOptions = useMemo(() => {
    const publicationTypes = new Set<string>()
    const authors = new Set<string>()

    const collectFromNode = (node: TreeNode) => {
      if (node.publicationType) {
        publicationTypes.add(node.publicationType)
      }
      if (node.authors) {
        node.authors.split(',').forEach(author => {
          const trimmed = author.trim()
          if (trimmed) authors.add(trimmed)
        })
      }
      if (node.children) {
        node.children.forEach(collectFromNode)
      }
    }

    if (treeData) {
      collectFromNode(treeData)
    }

    return {
      publicationTypes: Array.from(publicationTypes).sort(),
      authors: Array.from(authors).sort(),
    }
  }, [treeData])

  // Transform to TreeDataItem format
  const treeViewData = useMemo(() => {
    return transformToTreeData(citationNetworkResponse, {
      expandedData,
      onExpandNode: async (nodeId: string) => {
        if (onExpandNode && !expandedData.has(nodeId)) {
          setLoadingNodes(prev => new Set(prev).add(nodeId))
          try {
            const response = await onExpandNode(nodeId)
            if (response?.citationNetwork) {
              const { nodes } = response.citationNetwork
              const children: TreeNode[] = nodes
                .filter(n => !n.isRoot)
                .map(n => {
                  const nodeData = (n.data || {}) as any
                  return {
                    id: n.id,
                    label: n.label,
                    type: n.type,
                    citations: n.citations,
                    references: n.references,
                    year: n.year,
                    authors: n.authors,
                    score: n.score ?? nodeData?.score ?? null,
                    publicationType: nodeData?.publicationType || nodeData?.publication_type || null,
                    data: nodeData,
                    children: [],
                  }
                })
              setExpandedData(prev => new Map(prev).set(nodeId, children))
            }
            return response
          } catch (error) {
            console.error('Error expanding node:', error)
            return null
          } finally {
            setLoadingNodes(prev => {
              const next = new Set(prev)
              next.delete(nodeId)
              return next
            })
          }
        }
        return null
      },
      onNodeClick: async (nodeId: string) => {
        setSelectedNodeId(nodeId)
        onNodeClick?.(nodeId)
        
        // Find node data
        const findNode = (node: TreeNode): TreeNode | null => {
          if (node.id === nodeId) return node
          if (node.children) {
            for (const child of node.children) {
              const found = findNode(child)
              if (found) return found
            }
          }
          return null
        }
        
        const node = treeData ? findNode(treeData) : null
        if (!node) return
        
        // Fetch full paper details if not already cached
        if (!node.data || !node.data.abstract) {
          const cached = getCachedPaper(node.id)
          if (!cached) {
            setLoadingDetails(prev => new Set(prev).add(node.id))
            try {
              const paper = await fetchPaperDetails(node.id, useMock)
              if (paper) {
                node.data = paper
              }
            } catch (error) {
              console.error('Error fetching paper details:', error)
            } finally {
              setLoadingDetails(prev => {
                const next = new Set(prev)
                next.delete(node.id)
                return next
              })
            }
          } else {
            node.data = cached
          }
        }
      },
      selectedNodeId,
      filters,
      sortBy,
      sortOrder,
    })
  }, [citationNetworkResponse, expandedData, selectedNodeId, filters, sortBy, sortOrder, onExpandNode, onNodeClick, getCachedPaper, fetchPaperDetails, useMock, treeData])

  // Find selected node data for details panel
  const selectedNodeData = useMemo(() => {
    if (!selectedNodeId || !treeData) return null
    
    const findNode = (node: TreeNode): TreeNode | null => {
      if (node.id === selectedNodeId) return node
      if (node.children) {
        for (const child of node.children) {
          const found = findNode(child)
          if (found) return found
        }
      }
      return null
    }
    
    return findNode(treeData)
  }, [selectedNodeId, treeData])

  const typeColors = {
    root: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
    citing: 'bg-red-500/20 text-red-300 border-red-500/50',
    referenced: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
    both: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
  }

  // Custom render function for tree items
  const renderTreeItem = useCallback((params: TreeRenderItemParams) => {
    const { item, depth, isSelected, isOpen, onSelect, onToggle } = params
    
    // Find node metadata from treeData
    const findNodeMetadata = (nodeId: string): TreeNode | null => {
      if (!treeData) return null
      const findNode = (node: TreeNode): TreeNode | null => {
        if (node.id === nodeId) return node
        if (node.children) {
          for (const child of node.children) {
            const found = findNode(child)
            if (found) return found
          }
        }
        // Check expanded data
        const expanded = expandedData.get(nodeId)
        if (expanded) {
          for (const child of expanded) {
            const found = findNode(child)
            if (found) return found
          }
        }
        return null
      }
      return findNode(treeData)
    }
    
    const nodeMetadata = findNodeMetadata(item.id)
    const isLoading = loadingNodes.has(item.id)
    const isLoadingDetails = loadingDetails.has(item.id)
    const hasChildren = (item.children && item.children.length > 0) || expandedData.has(item.id)
    // Check if node is expandable (has expandable flag and chatId is available for API call)
    const isExpandable = nodeMetadata?.data?.id && chatId && !hasChildren
    const nodePaperId = nodeMetadata?.data?.id || nodeMetadata?.data?.sourcePaperId || item.id.replace('paper-', '').replace('root-', '')
    
    if (!nodeMetadata) return null

    // Handle expand button click (calls citation-network API)
    const handleExpandClick = async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!nodePaperId || !chatId || isLoading) return
      
      setLoadingNodes(prev => new Set(prev).add(item.id))
      try {
        const queryParams = new URLSearchParams()
        queryParams.set('chatId', chatId)
        queryParams.set('paperId', nodePaperId)
        
        const response = await fetch(`/api/citation-network?${queryParams.toString()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        
        if (response.ok) {
          const data: CitationNetworkResponse = await response.json()
          // Merge new nodes into expanded data
          if (data.citationNetwork?.nodes) {
            const newNodes = data.citationNetwork.nodes
              .filter(n => !n.isRoot)
              .map(n => ({
                id: n.id,
                label: n.label,
                type: n.type,
                citations: n.citations,
                references: n.references,
                year: n.year,
                authors: n.authors,
                score: n.score,
                publicationType: n.data?.publicationType || null,
                data: n.data,
                children: [],
              }))
            setExpandedData(prev => {
              const next = new Map(prev)
              next.set(item.id, newNodes)
              return next
            })
          }
        }
      } catch (error) {
        console.error('Error expanding node:', error)
      } finally {
        setLoadingNodes(prev => {
          const next = new Set(prev)
          next.delete(item.id)
          return next
        })
      }
    }

    // Handle node click (show popover)
    const handleNodeClick = async (e: React.MouseEvent) => {
      e.stopPropagation()
      onSelect()
      
      // Get paper data for popover
      let paperData: VeritusPaper | null = null
      if (nodeMetadata.data) {
        paperData = nodeMetadata.data as VeritusPaper
      } else {
        // Try to fetch paper details
        const cached = getCachedPaper(nodePaperId)
        if (cached) {
          paperData = cached
        } else {
          setLoadingDetails(prev => new Set(prev).add(item.id))
          try {
            const paper = await fetchPaperDetails(nodePaperId, useMock)
            if (paper) {
              paperData = paper
            }
          } catch (error) {
            console.error('Error fetching paper details:', error)
          } finally {
            setLoadingDetails(prev => {
              const next = new Set(prev)
              next.delete(item.id)
              return next
            })
          }
        }
      }
      
      if (paperData) {
        setPopoverPaper(paperData)
        setPopoverOpen(true)
      }
    }

    return (
      <div
        className={`
          group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all
          ${isSelected ? 'bg-[#2a2a2a] border border-green-500/50' : 'bg-[#171717] hover:bg-[#1f1f1f]'}
        `}
        onClick={handleNodeClick}
      >
        {/* Expand/Collapse Button (for existing children) */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            className="p-1 hover:bg-[#2a2a2a] rounded disabled:opacity-50 flex items-center justify-center w-4 h-4"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : isOpen ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </button>
        ) : (
          <div className="w-4 h-4" />
        )}
        {/* Node Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white truncate">
              {item.name}
              {isLoadingDetails && <span className="ml-2 text-xs text-gray-500">Loading...</span>}
            </span>
            <Badge className={`text-xs ${typeColors[nodeMetadata.type]}`}>
              {nodeMetadata.type}
            </Badge>
            {nodeMetadata.publicationType && (
              <Badge variant="outline" className="text-xs border-[#2a2a2a] text-gray-400">
                <BookOpen className="h-3 w-3 mr-1" />
                {nodeMetadata.publicationType}
              </Badge>
            )}
            {nodeMetadata.score !== null && nodeMetadata.score !== undefined && (
              <Badge variant="outline" className="text-xs border-[#2a2a2a] text-gray-400">
                <Star className="h-3 w-3 mr-1" />
                {(nodeMetadata.score < 1 ? nodeMetadata.score * 100 : nodeMetadata.score > 100 ? nodeMetadata.score / 100 : nodeMetadata.score).toFixed(2)}%
              </Badge>
            )}
            {/* Source Paper Badge */}
            {nodeMetadata.data?.sourcePaperId && (
              <Badge variant="outline" className="text-xs border-green-500/50 text-green-400 bg-green-500/10">
                Source: {nodeMetadata.data.sourcePaperId.substring(0, 8)}...
              </Badge>
            )}
          </div>
          
          {/* Node Metadata */}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            {nodeMetadata.citations !== undefined && (
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {nodeMetadata.citations} citations
              </span>
            )}
            {nodeMetadata.year && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {nodeMetadata.year}
              </span>
            )}
            {nodeMetadata.authors && (
              <span className="flex items-center gap-1 truncate max-w-[200px]">
                <Users className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{nodeMetadata.authors.split(',')[0]}</span>
                {nodeMetadata.authors.split(',').length > 1 && ' et al.'}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Expand Button (+ icon) for expandable nodes */}
          {isExpandable && (
            <button
              onClick={handleExpandClick}
              disabled={isLoading}
              className="p-1 hover:bg-[#2a2a2a] rounded disabled:opacity-50 flex items-center justify-center w-6 h-6 text-green-500 hover:text-green-400 transition-colors"
              title="Expand to show similar papers"
            >
              {isLoading ? (
                <div className="h-4 w-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {nodeMetadata.data?.link && (
                <DropdownMenuItem onClick={() => window.open(nodeMetadata.data.link, '_blank')}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Paper
                </DropdownMenuItem>
              )}
              {nodeMetadata.data?.pdfLink && (
                <DropdownMenuItem onClick={() => window.open(nodeMetadata.data.pdfLink, '_blank')}>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  }, [treeData, loadingNodes, loadingDetails, typeColors, chatId, getCachedPaper, fetchPaperDetails, useMock, expandedData])

  if (!treeViewData || treeViewData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>No citation network data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Citation Tree</h3>
          <p className="text-sm text-gray-400">
            {citationNetworkResponse?.citationNetwork?.stats.totalNodes || 0} nodes •{' '}
            {citationNetworkResponse?.citationNetwork?.stats.totalEdges || 0} connections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-gray-300 hover:text-white hover:bg-white/10"
            onClick={() => setIsFullscreen(true)}
            title="View full screen"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters and Sorting */}
      <CitationTreeFilters
        sortBy={sortBy}
        sortOrder={sortOrder}
        filters={filters}
        availablePublicationTypes={availableOptions.publicationTypes}
        availableAuthors={availableOptions.authors}
        onSortChange={(newSortBy, newSortOrder) => {
          setSortBy(newSortBy)
          setSortOrder(newSortOrder)
        }}
        onFiltersChange={setFilters}
        onClearFilters={() => setFilters({})}
      />

      {/* Graph Visualization - Vertical Tree (inline + full-screen overlay using same instance) */}
      <div className="relative">
        {/* Full-screen backdrop */}
        {isFullscreen && (
          <div
            className="fixed inset-0 z-40 bg-black/70"
            onClick={() => setIsFullscreen(false)}
          />
        )}

        {/* Graph container - position changes based on fullscreen state */}
        <div
          className={
            isFullscreen
              ? 'fixed inset-4 z-50 bg-[#0f0f0f] rounded-lg border border-[#2a2a2a] p-4 shadow-2xl flex flex-col'
              : 'bg-[#0f0f0f] rounded-lg border border-[#2a2a2a] p-4 h-[600px]'
          }
        >
          {isFullscreen && (
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div>
                <p className="text-sm font-medium text-white">Citation Tree — Full Screen</p>
                <p className="text-xs text-gray-400">
                  {citationNetworkResponse?.citationNetwork?.stats.totalNodes || 0} nodes •{' '}
                  {citationNetworkResponse?.citationNetwork?.stats.totalEdges || 0} connections
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-gray-300 hover:text-white hover:bg-white/10"
                onClick={() => setIsFullscreen(false)}
                title="Close full screen"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className={isFullscreen ? 'flex-1 min-h-0' : ''}>
            <CitationTreeVisualization
              citationNetworkResponse={citationNetworkResponse}
              chatId={chatId}
              // When fullscreen, allow SVG to size to container; inline keeps explicit defaults
              width={isFullscreen ? undefined : 800}
              height={isFullscreen ? undefined : 600}
              messages={messages}
              onNodeClick={(paper: VeritusPaper) => {
                setPopoverPaper(paper)
                setPopoverOpen(true)
              }}
              onCreateChatFromNode={onCreateChatFromNode}
            />
          </div>
        </div>
      </div>

      {/* Paper Details Popover */}
      <PaperDetailsPopover
        paper={popoverPaper}
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
        onCreateChatFromHeading={onCreateChatFromHeading}
      />
    </div>
  )
}
