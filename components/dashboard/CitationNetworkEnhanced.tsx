'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import * as d3Hierarchy from 'd3-hierarchy'
import { VeritusPaper } from '@/types/veritus'
import { CitationNetworkResponse, CitationNetworkNode, CitationNetworkEdge } from '@/types/paper-api'
import { LayoutType, FilterState, ClusterConfig, GraphInteractionState } from '@/types/graph-visualization'
import { findShortestPath } from '@/lib/utils/path-finding'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CitationNetworkFilters } from './CitationNetworkFilters'
import { CitationNetworkControls } from './CitationNetworkControls'

// Clamp helper
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

interface CitationNetworkEnhancedProps {
  papers?: VeritusPaper[]
  citationNetworkResponse?: CitationNetworkResponse
  width?: number
  height?: number
}

export function CitationNetworkEnhanced({ 
  papers, 
  citationNetworkResponse, 
  width = 800, 
  height = 600 
}: CitationNetworkEnhancedProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null)
  
  const [zoomLevel, setZoomLevel] = useState(1)
  const [layout, setLayout] = useState<LayoutType>('force')
  const [sortBy, setSortBy] = useState<'relevance' | 'citations' | 'year'>('relevance')
  const [showLabels, setShowLabels] = useState(true)
  const [filters, setFilters] = useState<FilterState>({})
  const [filteredNetwork, setFilteredNetwork] = useState<{ nodes: CitationNetworkNode[], edges: CitationNetworkEdge[] } | null>(null)
  const [interactionState, setInteractionState] = useState<GraphInteractionState>({
    selectedNodes: new Set(),
    highlightedPath: null,
    hoveredNode: null,
    showLabels: true,
    showEdgeLabels: false,
    nodeSizeMultiplier: 1,
    edgeThicknessMultiplier: 1,
  })

  // Prepare network data
  const prepareNetworkData = useCallback(() => {
    if (!citationNetworkResponse) return null

    let nodes: CitationNetworkNode[] = []
    let edges: CitationNetworkEdge[] = []

    if (citationNetworkResponse.citationNetwork) {
      nodes = citationNetworkResponse.citationNetwork.nodes.map(node => ({
        ...node,
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: 0,
      }))
      edges = citationNetworkResponse.citationNetwork.edges
    } else if (citationNetworkResponse.graph) {
      nodes = citationNetworkResponse.graph.nodes.map(node => ({
        id: node.id,
        label: node.label,
        citations: node.citations,
        type: node.isRoot ? 'root' : 'citing',
        isRoot: node.isRoot,
        year: null,
        authors: null,
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: 0,
      }))
      edges = citationNetworkResponse.graph.edges.map(edge => ({
        source: edge.source,
        target: edge.target,
        type: 'cites' as const,
        weight: edge.weight,
      }))
    }

    return { nodes, edges }
  }, [citationNetworkResponse, width, height])

  // Apply filters
  const applyFilters = useCallback((network: { nodes: CitationNetworkNode[], edges: CitationNetworkEdge[] }, filterState: FilterState) => {
    let filteredNodes = [...network.nodes]
    const originalCount = filteredNodes.length

    if (filterState.searchQuery) {
      const query = filterState.searchQuery.toLowerCase()
      filteredNodes = filteredNodes.filter(n => 
        n.label?.toLowerCase().includes(query) ||
        n.authors?.toLowerCase().includes(query)
      )
    }

    if (filterState.minCitations !== undefined) {
      filteredNodes = filteredNodes.filter(n => n.citations >= filterState.minCitations!)
    }
    if (filterState.maxCitations !== undefined) {
      filteredNodes = filteredNodes.filter(n => n.citations <= filterState.maxCitations!)
    }
    if (filterState.minYear !== undefined) {
      filteredNodes = filteredNodes.filter(n => n.year && n.year >= filterState.minYear!)
    }
    if (filterState.maxYear !== undefined) {
      filteredNodes = filteredNodes.filter(n => n.year && n.year <= filterState.maxYear!)
    }
    if (filterState.types && filterState.types.length > 0) {
      filteredNodes = filteredNodes.filter(n => filterState.types!.includes(n.type))
    }
    if (filterState.authors && filterState.authors.length > 0) {
      filteredNodes = filteredNodes.filter(n =>
        filterState.authors!.some(author =>
          n.authors?.toLowerCase().includes(author.toLowerCase())
        )
      )
    }

    const filteredNodeIds = new Set(filteredNodes.map(n => n.id))
    const filteredEdges = network.edges.filter(e => {
      const sourceId = typeof e.source === 'string' ? e.source : e.source.id
      const targetId = typeof e.target === 'string' ? e.target : e.target.id
      return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId)
    })

    return { nodes: filteredNodes, edges: filteredEdges }
  }, [])

  // Calculate node size based on sort criteria
  const getNodeSize = useCallback((node: CitationNetworkNode, sortCriteria: 'relevance' | 'citations' | 'year') => {
    const baseSize = 8
    const multiplier = interactionState.nodeSizeMultiplier

    // Prefer weight if available
    if (node.weight !== undefined) {
      return clamp(node.weight * 10, 6, 28) * multiplier
    }

    switch (sortCriteria) {
      case 'citations':
        return Math.max(baseSize, Math.min(25, baseSize + (node.citations || 0) / 20)) * multiplier
      case 'year':
        if (!node.year) return baseSize * multiplier
        const currentYear = new Date().getFullYear()
        const age = currentYear - node.year
        return Math.max(baseSize, Math.min(25, baseSize + (50 - age) / 5)) * multiplier
      case 'relevance':
      default:
        const score = node.score || 0
        return Math.max(baseSize, Math.min(25, baseSize + score * 10)) * multiplier
    }
  }, [interactionState.nodeSizeMultiplier])

  // Get node color based on type and sort
  const getNodeColor = useCallback((node: CitationNetworkNode, sortCriteria: 'relevance' | 'citations' | 'year') => {
    if (interactionState.selectedNodes.has(node.id)) return '#3b82f6'
    if (interactionState.hoveredNode === node.id) return '#60a5fa'
    if (interactionState.highlightedPath?.includes(node.id)) return '#fbbf24'

    if (node.isRoot) return '#ffd93d'
    if (node.type === 'citing') return '#ff6b6b'
    if (node.type === 'referenced') return '#4ecdc4'
    if (node.type === 'both') return '#9b59b6'

    // Color gradient based on sort criteria
    if (sortCriteria === 'citations') {
      const maxCitations = Math.max(...(citationNetworkResponse?.citationNetwork?.nodes.map(n => n.citations) || [0]))
      const intensity = node.citations / Math.max(maxCitations, 1)
      return d3.interpolateReds(intensity * 0.7 + 0.3)
    }

    // Weight-based color ramp if weight available
    if (node.weight !== undefined) {
      const t = clamp(node.weight / 3, 0, 1)
      return d3.interpolateWarm(1 - t * 0.6)
    }

    return '#60a5fa'
  }, [interactionState, citationNetworkResponse])

  // Render graph with D3
  useEffect(() => {
    if (!svgRef.current) return

    const networkData = prepareNetworkData()
    if (!networkData) return

    // Apply filters
    const displayData = Object.keys(filters).length > 0 
      ? applyFilters(networkData, filters)
      : networkData

    if (displayData.nodes.length === 0) return

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
    const g = svg.append('g')

    // Set up zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
        setZoomLevel(event.transform.k)
      })

    svg.call(zoom)

    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'citation-network-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', '#1f1f1f')
      .style('border', '1px solid #2a2a2a')
      .style('border-radius', '4px')
      .style('padding', '8px')
      .style('color', '#e5e7eb')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('max-width', '300px')

    // Create edges
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(displayData.edges)
      .enter()
      .append('line')
      .attr('stroke', (d) => {
        if (interactionState.highlightedPath) {
          const sourceId = typeof d.source === 'string' ? d.source : d.source.id
          const targetId = typeof d.target === 'string' ? d.target : d.target.id
          const path = interactionState.highlightedPath
          const isOnPath = path.some((id, i) => 
            (i < path.length - 1 && id === sourceId && path[i + 1] === targetId) ||
            (i < path.length - 1 && id === targetId && path[i + 1] === sourceId)
          )
          return isOnPath ? '#fbbf24' : '#4a5568'
        }
        // Weight color ramp
        const w = typeof d.weight === 'number' ? d.weight : 1
        const t = clamp((w - 0.1) / 2.9, 0, 1)
        return d.type === 'cites'
          ? d3.interpolateRdYlGn(t)
          : d3.interpolateGnBu(t * 0.8 + 0.2)
      })
      .attr('stroke-width', (d) => {
        const baseWidth = 2
        const w = typeof d.weight === 'number' ? d.weight : 1
        const weighted = clamp(baseWidth * (w * 1.5), 1, 6)
        if (interactionState.highlightedPath) {
          const sourceId = typeof d.source === 'string' ? d.source : d.source.id
          const targetId = typeof d.target === 'string' ? d.target : d.target.id
          const path = interactionState.highlightedPath
          const isOnPath = path.some((id, i) => 
            (i < path.length - 1 && id === sourceId && path[i + 1] === targetId) ||
            (i < path.length - 1 && id === targetId && path[i + 1] === sourceId)
          )
          return isOnPath ? weighted * 1.8 : weighted * 0.3
        }
        return weighted * interactionState.edgeThicknessMultiplier
      })
      .attr('stroke-opacity', (d) => {
        if (interactionState.highlightedPath) {
          const sourceId = typeof d.source === 'string' ? d.source : d.source.id
          const targetId = typeof d.target === 'string' ? d.target : d.target.id
          const path = interactionState.highlightedPath
          const isOnPath = path.some((id, i) => 
            (i < path.length - 1 && id === sourceId && path[i + 1] === targetId) ||
            (i < path.length - 1 && id === targetId && path[i + 1] === sourceId)
          )
          return isOnPath ? 1 : 0.2
        }
        return 0.6
      })
      .attr('marker-end', 'url(#arrowhead)')

    // Create arrow markers
    const defs = svg.append('defs')
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#4a5568')

    // Create nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(displayData.nodes)
      .enter()
      .append('circle')
      .attr('r', (d) => getNodeSize(d, sortBy))
      .attr('fill', (d) => getNodeColor(d, sortBy))
      .attr('stroke', '#1e40af')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation()
        const newSelected = new Set(interactionState.selectedNodes)
        if (newSelected.has(d.id)) {
          newSelected.delete(d.id)
        } else {
          if (event.ctrlKey || event.metaKey) {
            newSelected.add(d.id)
          } else {
            newSelected.clear()
            newSelected.add(d.id)
          }
        }
        setInteractionState({ ...interactionState, selectedNodes: newSelected })
      })
      .call(createDrag(simulationRef.current))
      .on('mouseover', (event, d) => {
        setInteractionState({ ...interactionState, hoveredNode: d.id })
        tooltip.transition().duration(200).style('opacity', 1)
        tooltip.html(`
          <div class="font-semibold mb-1">${d.label}</div>
          <div class="text-xs text-gray-400 mb-1">${d.authors || 'N/A'}</div>
          <div class="text-xs">
            Citations: ${d.citations || 0}<br/>
            Year: ${d.year || 'N/A'}<br/>
            Type: ${d.type}
          </div>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px')
      })
      .on('mouseout', () => {
        setInteractionState({ ...interactionState, hoveredNode: null })
        tooltip.transition().duration(200).style('opacity', 0)
      })

    // Create labels
    const labels = g.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(displayData.nodes)
      .enter()
      .append('text')
      .text((d) => {
        const title = d.label || 'Unknown'
        return title.length > 30 ? title.substring(0, 30) + '...' : title
      })
      .attr('font-size', '10px')
      .attr('fill', '#e5e7eb')
      .attr('dx', 15)
      .attr('dy', 4)
      .style('opacity', showLabels ? 1 : 0)
      .style('pointer-events', 'none')

    // Apply layout
    let simulation: d3.Simulation<any, any> | null = null

    switch (layout) {
      case 'force':
        simulation = d3.forceSimulation(displayData.nodes)
          .force('link', d3.forceLink(displayData.edges).id((d: any) => d.id).distance(100))
          .force('charge', d3.forceManyBody().strength(-300))
          .force('center', d3.forceCenter(width / 2, height / 2))
          .force('collision', d3.forceCollide().radius((d: any) => getNodeSize(d, sortBy) + 5))
        break

      case 'circular':
        const angleStep = (2 * Math.PI) / displayData.nodes.length
        displayData.nodes.forEach((node, i) => {
          const angle = i * angleStep
          const radius = Math.min(width, height) / 3
          node.x = width / 2 + radius * Math.cos(angle)
          node.y = height / 2 + radius * Math.sin(angle)
        })
        break

      case 'grid':
        const cols = Math.ceil(Math.sqrt(displayData.nodes.length))
        const cellWidth = width / cols
        const cellHeight = height / Math.ceil(displayData.nodes.length / cols)
        displayData.nodes.forEach((node, i) => {
          const col = i % cols
          const row = Math.floor(i / cols)
          node.x = col * cellWidth + cellWidth / 2
          node.y = row * cellHeight + cellHeight / 2
        })
        break

      case 'hierarchical':
        // Simple hierarchical layout - root at top, others below
        const rootNode = displayData.nodes.find(n => n.isRoot)
        if (rootNode) {
          rootNode.x = width / 2
          rootNode.y = height / 4
        }
        const otherNodes = displayData.nodes.filter(n => !n.isRoot)
        const nodesPerRow = Math.ceil(Math.sqrt(otherNodes.length))
        const rowHeight = (height * 0.6) / Math.ceil(otherNodes.length / nodesPerRow)
        otherNodes.forEach((node, i) => {
          const col = i % nodesPerRow
          const row = Math.floor(i / nodesPerRow)
          node.x = (width / nodesPerRow) * col + (width / nodesPerRow) / 2
          node.y = height / 4 + rowHeight * (row + 1)
        })
        break
    }

    if (simulation) {
      simulationRef.current = simulation
      simulation.on('tick', () => {
        link
          .attr('x1', (d: any) => {
            const source = typeof d.source === 'string' 
              ? displayData.nodes.find(n => n.id === d.source)
              : d.source
            return source?.x || 0
          })
          .attr('y1', (d: any) => {
            const source = typeof d.source === 'string' 
              ? displayData.nodes.find(n => n.id === d.source)
              : d.source
            return source?.y || 0
          })
          .attr('x2', (d: any) => {
            const target = typeof d.target === 'string' 
              ? displayData.nodes.find(n => n.id === d.target)
              : d.target
            return target?.x || 0
          })
          .attr('y2', (d: any) => {
            const target = typeof d.target === 'string' 
              ? displayData.nodes.find(n => n.id === d.target)
              : d.target
            return target?.y || 0
          })

        node.attr('cx', (d: any) => d.x || 0).attr('cy', (d: any) => d.y || 0)
        labels.attr('x', (d: any) => d.x || 0).attr('y', (d: any) => d.y || 0)
      })
    } else {
      // Static layout - update positions immediately
      link
        .attr('x1', (d: any) => {
          const source = typeof d.source === 'string' 
            ? displayData.nodes.find(n => n.id === d.source)
            : d.source
          return source?.x || 0
        })
        .attr('y1', (d: any) => {
          const source = typeof d.source === 'string' 
            ? displayData.nodes.find(n => n.id === d.source)
            : d.source
          return source?.y || 0
        })
        .attr('x2', (d: any) => {
          const target = typeof d.target === 'string' 
            ? displayData.nodes.find(n => n.id === d.target)
            : d.target
          return target?.x || 0
        })
        .attr('y2', (d: any) => {
          const target = typeof d.target === 'string' 
            ? displayData.nodes.find(n => n.id === d.target)
            : d.target
          return target?.y || 0
        })

      node.attr('cx', (d: any) => d.x || 0).attr('cy', (d: any) => d.y || 0)
      labels.attr('x', (d: any) => d.x || 0).attr('y', (d: any) => d.y || 0)
    }

    // Cleanup
    return () => {
      tooltip.remove()
      if (simulationRef.current) {
        simulationRef.current.stop()
      }
    }
  }, [
    citationNetworkResponse,
    layout,
    sortBy,
    showLabels,
    filters,
    interactionState,
    width,
    height,
    prepareNetworkData,
    applyFilters,
    getNodeSize,
    getNodeColor,
  ])

  // Handle path highlighting
  useEffect(() => {
    if (interactionState.selectedNodes.size === 2) {
      const selectedArray = Array.from(interactionState.selectedNodes)
      const networkData = prepareNetworkData()
      if (networkData) {
        const path = findShortestPath(networkData.nodes, networkData.edges, selectedArray[0], selectedArray[1])
        setInteractionState(prev => ({ ...prev, highlightedPath: path }))
      }
    } else {
      setInteractionState(prev => ({ ...prev, highlightedPath: null }))
    }
  }, [interactionState.selectedNodes, prepareNetworkData])

  const handleZoomIn = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      svg.transition().call(d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 1.5)
    }
  }

  const handleZoomOut = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      svg.transition().call(d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 1 / 1.5)
    }
  }

  const handleReset = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      svg.transition().call(d3.zoom<SVGSVGElement, unknown>().transform as any, d3.zoomIdentity)
      setZoomLevel(1)
      setInteractionState({
        ...interactionState,
        selectedNodes: new Set(),
        highlightedPath: null,
      })
    }
  }

  const handleApplyFilters = () => {
    const networkData = prepareNetworkData()
    if (networkData) {
      const filtered = applyFilters(networkData, filters)
      setFilteredNetwork(filtered)
    }
  }

  const handleResetFilters = () => {
    setFilters({})
    setFilteredNetwork(null)
  }

  const hasData = citationNetworkResponse || papers

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>Select papers to visualize citation network</p>
      </div>
    )
  }

  const networkData = citationNetworkResponse?.citationNetwork || null

  return (
    <div className="space-y-4">
      {/* Controls */}
      {networkData && (
        <CitationNetworkControls
          layout={layout}
          sortBy={sortBy}
          showLabels={showLabels}
          onLayoutChange={setLayout}
          onSortChange={setSortBy}
          onToggleLabels={() => setShowLabels(!showLabels)}
          citationNetworkResponse={citationNetworkResponse}
        />
      )}

      {/* Filters */}
      {networkData && (
        <div className="flex items-center gap-2">
          <CitationNetworkFilters
            citationNetwork={networkData}
            filters={filters}
            onFiltersChange={setFilters}
            onApplyFilters={handleApplyFilters}
            onResetFilters={handleResetFilters}
          />
        </div>
      )}

      {/* Graph */}
      <div className="relative bg-[#0f0f0f] rounded-lg border border-[#2a2a2a]">
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleZoomIn}
            className="bg-[#1f1f1f] border-[#2a2a2a] text-gray-300 h-8"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleZoomOut}
            className="bg-[#1f1f1f] border-[#2a2a2a] text-gray-300 h-8"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            className="bg-[#1f1f1f] border-[#2a2a2a] text-gray-300 h-8"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        <div className="absolute top-4 left-4 z-10 text-xs text-gray-400">
          Zoom: {(zoomLevel * 100).toFixed(0)}% | {networkData?.stats.totalNodes || 0} nodes | {networkData?.stats.totalEdges || 0} edges
          {citationNetworkResponse?.meta?.mode && ` | ${citationNetworkResponse.meta.mode}`}
          {interactionState.selectedNodes.size > 0 && ` | ${interactionState.selectedNodes.size} selected`}
        </div>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="w-full h-full"
        />
      </div>
    </div>
  )
}

// Drag behavior function
function createDrag(simulation: d3.Simulation<any, any> | null | undefined) {
  function dragstarted(event: d3.D3DragEvent<SVGCircleElement, CitationNetworkNode, CitationNetworkNode>) {
    if (simulation && !event.active) simulation.alphaTarget(0.3).restart()
    const subject = event.subject as CitationNetworkNode
    subject.fx = subject.x
    subject.fy = subject.y
  }

  function dragged(event: d3.D3DragEvent<SVGCircleElement, CitationNetworkNode, CitationNetworkNode>) {
    const subject = event.subject as CitationNetworkNode
    subject.fx = event.x
    subject.fy = event.y
  }

  function dragended(event: d3.D3DragEvent<SVGCircleElement, CitationNetworkNode, CitationNetworkNode>) {
    if (simulation && !event.active) simulation.alphaTarget(0)
    const subject = event.subject as CitationNetworkNode
    subject.fx = null
    subject.fy = null
  }

  return d3.drag<SVGCircleElement, CitationNetworkNode>()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended)
}

