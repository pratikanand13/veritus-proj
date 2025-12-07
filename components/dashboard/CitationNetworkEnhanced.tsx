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
      const sourceId = typeof e.source === 'string' 
        ? e.source 
        : (e.source as CitationNetworkNode).id
      const targetId = typeof e.target === 'string' 
        ? e.target 
        : (e.target as CitationNetworkNode).id
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
          const sourceId = typeof d.source === 'string' ? d.source : (d.source as CitationNetworkNode).id
          const targetId = typeof d.target === 'string' ? d.target : (d.target as CitationNetworkNode).id
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
          const sourceId = typeof d.source === 'string' ? d.source : (d.source as CitationNetworkNode).id
          const targetId = typeof d.target === 'string' ? d.target : (d.target as CitationNetworkNode).id
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
          const sourceId = typeof d.source === 'string' ? d.source : (d.source as CitationNetworkNode).id
          const targetId = typeof d.target === 'string' ? d.target : (d.target as CitationNetworkNode).id
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

    // Create wrapped labels using foreignObject for proper text wrapping
    const maxLabelWidth = 120 // Fixed max width for wrapping
    const labelOffset = 15 // Horizontal offset from node center
    const fontSize = 10
    const lineHeight = fontSize * 1.2
    
    const labels = g.append('g')
      .attr('class', 'labels')
      .selectAll('g.label-group')
      .data(displayData.nodes)
      .enter()
      .append('g')
      .attr('class', 'label-group')
      .style('opacity', showLabels ? 1 : 0)
      .style('pointer-events', 'none')
    
    // Create foreignObject for each label to enable text wrapping
    const labelForeignObjects = labels.append('foreignObject')
      .attr('width', maxLabelWidth)
      .attr('height', (d) => {
        const { height } = wrapText(d.label || 'Unknown', maxLabelWidth)
        return height
      })
      .attr('x', labelOffset)
      .attr('y', (d) => {
        const { height } = wrapText(d.label || 'Unknown', maxLabelWidth)
        return -height / 2 // Vertically center the label
      })
    
    // Create div elements inside foreignObject for text wrapping
    labelForeignObjects.append('xhtml:div')
      .style('font-size', `${fontSize}px`)
      .style('color', '#e5e7eb')
      .style('line-height', `${lineHeight}px`)
      .style('font-family', 'system-ui, -apple-system, sans-serif')
      .style('word-wrap', 'break-word')
      .style('overflow-wrap', 'break-word')
      .style('white-space', 'normal')
      .style('width', `${maxLabelWidth}px`)
      .html((d) => {
        const { wrappedLines } = wrapText(d.label || 'Unknown', maxLabelWidth)
        // Escape HTML and join lines with <br>
        return wrappedLines
          .map(line => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
          .join('<br>')
      })

    // Apply layout
    let simulation: d3.Simulation<any, any> | null = null

    // Ensure nodes have D3 simulation properties with better initial positioning
    // Distribute nodes in a wider area initially to prevent clustering
    const nodesWithSimulationProps = displayData.nodes.map((node, i) => {
      const nodeWithProps = node as CitationNetworkNode & Partial<d3.SimulationNodeDatum>
      // If node doesn't have position, initialize it in a wider distribution
      const hasPosition = (nodeWithProps as any).x !== undefined && (nodeWithProps as any).x !== null
      if (!hasPosition) {
        // Use a spiral or wider random distribution for better initial spread
        const angle = (i / displayData.nodes.length) * 2 * Math.PI
        const radius = Math.min(width, height) * 0.3 * (0.5 + Math.random() * 0.5)
        ;(nodeWithProps as any).x = width / 2 + radius * Math.cos(angle)
        ;(nodeWithProps as any).y = height / 2 + radius * Math.sin(angle)
      }
      return {
        ...nodeWithProps,
        x: (nodeWithProps as any).x ?? width / 2 + (Math.random() - 0.5) * width * 0.3,
        y: (nodeWithProps as any).y ?? height / 2 + (Math.random() - 0.5) * height * 0.3,
        vx: (nodeWithProps as any).vx ?? 0,
        vy: (nodeWithProps as any).vy ?? 0,
        fx: (nodeWithProps as any).fx ?? undefined,
        fy: (nodeWithProps as any).fy ?? undefined,
      } as CitationNetworkNode & d3.SimulationNodeDatum
    })

    // Helper function to wrap text and calculate dimensions
    const wrapText = (text: string, maxWidth: number): { wrappedLines: string[], width: number, height: number } => {
      const words = text.split(/\s+/).filter(word => word.length > 0)
      const fontSize = 10
      const lineHeight = fontSize * 1.2
      const avgCharWidth = 6 // Average character width for 10px font
      
      if (words.length === 0) {
        return { wrappedLines: [''], width: 0, height: lineHeight }
      }
      
      const lines: string[] = []
      let currentLine = words[0]
      
      for (let i = 1; i < words.length; i++) {
        const word = words[i]
        const testLine = currentLine + ' ' + word
        const testWidth = testLine.length * avgCharWidth
        
        if (testWidth > maxWidth && currentLine.length > 0) {
          lines.push(currentLine)
          currentLine = word
        } else {
          currentLine = testLine
        }
      }
      lines.push(currentLine)
      
      // Calculate actual width (longest line)
      const maxLineWidth = Math.max(...lines.map(line => line.length * avgCharWidth))
      const totalHeight = lines.length * lineHeight
      
      return {
        wrappedLines: lines,
        width: Math.min(maxLineWidth, maxWidth),
        height: totalHeight
      }
    }
    
    // Calculate dynamic collision radius that accounts for node, wrapped label, and spacing
    // This ensures nodes and their labels don't overlap
    const getCollisionRadius = (node: CitationNetworkNode) => {
      const nodeRadius = getNodeSize(node, sortBy)
      const label = node.label || 'Unknown'
      
      // Wrap text to calculate actual label dimensions
      const maxLabelWidth = 120 // Fixed max width for wrapping
      const labelOffset = 15 // dx offset from node center (label starts here)
      const labelPadding = 20 // Extra padding around label for readability
      
      const { width: labelWidth, height: labelHeight } = wrapText(label, maxLabelWidth)
      
      // Calculate the full bounding box dimensions
      // Label extends from node center + labelOffset to node center + labelOffset + labelWidth
      const totalWidth = nodeRadius + labelOffset + labelWidth + labelPadding
      const totalHeight = Math.max(nodeRadius * 2, labelHeight + labelPadding)
      
      // Use the larger dimension to create a circular collision radius
      // This ensures nodes don't overlap even when labels are at different angles
      const maxDimension = Math.max(totalWidth, totalHeight)
      
      // Scale collision radius based on number of nodes for better spacing
      const nodeCount = displayData.nodes.length
      const densityFactor = Math.max(1, Math.sqrt(nodeCount / 10)) // Scale up for more nodes
      const minSpacing = 50 * densityFactor // Minimum spacing increases with node count
      
      // Return the larger of: calculated radius or minimum spacing
      const collisionRadius = Math.max(
        maxDimension / 2, // Half of max dimension for circular collision
        nodeRadius + minSpacing // Minimum spacing from node edge
      )
      
      return collisionRadius
    }
    
    // Calculate dynamic spacing parameters based on graph size
    const nodeCount = displayData.nodes.length
    const edgeCount = displayData.edges.length
    const graphDensity = edgeCount / Math.max(nodeCount, 1)
    
    // Scale forces based on graph characteristics
    const baseChargeStrength = -800
    const chargeMultiplier = Math.max(1, Math.sqrt(nodeCount / 5)) // Stronger repulsion for more nodes
    const linkDistanceBase = 150 // Base link distance
    const linkDistanceMultiplier = Math.max(1, Math.sqrt(nodeCount / 8)) // Longer links for more nodes

    switch (layout) {
      case 'force':
        // Create boundary to keep nodes away from right edge (where keywords box might be)
        const boundaryPadding = 300 // Reserve space for keywords box
        const boundaryWidth = width - boundaryPadding
        const centerX = (boundaryWidth + boundaryPadding / 2) / 2
        const centerY = height / 2
        
        // Optimize simulation parameters to prevent overlaps
        // CRITICAL: Slow alpha decay to allow simulation to run longer and settle properly
        // For linear graphs, we need more iterations to separate nodes
        const alphaDecay = 0.01 // Much slower decay (was 0.01-0.05, now fixed at 0.01)
        const alphaMin = 0.0001 // Lower minimum to allow more thorough settling
        
        simulation = d3.forceSimulation<CitationNetworkNode & d3.SimulationNodeDatum>(nodesWithSimulationProps)
          .alpha(1) // Start with high energy
          .alphaDecay(alphaDecay) // Slow decay for more iterations
          .alphaMin(alphaMin) // Very low minimum for thorough settling
          .velocityDecay(0.4) // Moderate damping to allow movement
          // CRITICAL FIX #1: Lower link strength to prevent link force from overriding collision
          .force('link', d3.forceLink<CitationNetworkNode & d3.SimulationNodeDatum, CitationNetworkEdge>(displayData.edges)
            .id((d: any) => d.id)
            .distance((d: any) => {
              // Dynamic link distance based on collision radius
              const sourceRadius = getCollisionRadius(d.source as CitationNetworkNode)
              const targetRadius = getCollisionRadius(d.target as CitationNetworkNode)
              const baseDistance = sourceRadius + targetRadius + (linkDistanceBase * linkDistanceMultiplier)
              // Adjust based on edge weight if available
              const weight = typeof d.weight === 'number' ? d.weight : 1
              return baseDistance * (0.8 + weight * 0.4)
            })
            .strength(0.1)) // CRITICAL: Low link strength (was 0.5-1.5) to prevent overriding collision
          // CRITICAL FIX #2: Stronger repulsion to push nodes apart
          .force('charge', d3.forceManyBody().strength((d: any) => {
            const nodeRadius = getCollisionRadius(d as CitationNetworkNode)
            // Increase base charge strength for better separation
            const baseCharge = baseChargeStrength * chargeMultiplier * 1.5 // 50% stronger
            const sizeFactor = 1 + (nodeRadius / 50)
            return baseCharge * sizeFactor
          }))
          .force('center', d3.forceCenter(centerX, centerY).strength(0.02)) // Weaker center force
          // CRITICAL FIX #3: Collision force MUST be strong and run after link forces
          // Force order matters - collision should be last to override other forces
          .force('collision', d3.forceCollide()
            .radius((d: any) => {
              // Use full collision radius including label dimensions
              return getCollisionRadius(d as CitationNetworkNode) * 1.15 // 15% padding for safety
            })
            .strength(1.0) // Maximum strength
            .iterations(2)) // Multiple iterations per tick for better collision resolution
          .force('x', d3.forceX(centerX).strength(0.01)) // Very weak X pull
          .force('y', d3.forceY(centerY).strength(0.01)) // Very weak Y pull
          // CRITICAL FIX #4: Add strong separation force to push nodes apart
          .force('separation', (alpha: number) => {
            // Additional separation force to prevent clustering
            const padding = 5 // Minimum separation padding
            nodesWithSimulationProps.forEach((nodeA: any, i: number) => {
              const radiusA = getCollisionRadius(nodeA as CitationNetworkNode)
              nodesWithSimulationProps.forEach((nodeB: any, j: number) => {
                if (i >= j) return
                const radiusB = getCollisionRadius(nodeB as CitationNetworkNode)
                const minDistance = radiusA + radiusB + padding
                
                if (nodeA.x !== undefined && nodeA.y !== undefined &&
                    nodeB.x !== undefined && nodeB.y !== undefined) {
                  const dx = (nodeB.x as number) - (nodeA.x as number)
                  const dy = (nodeB.y as number) - (nodeA.y as number)
                  const distance = Math.sqrt(dx * dx + dy * dy) || 1
                  
                  if (distance < minDistance) {
                    // Push nodes apart
                    const force = (minDistance - distance) / distance * alpha * 0.5
                    const fx = dx * force
                    const fy = dy * force
                    nodeA.vx = (nodeA.vx || 0) - fx
                    nodeA.vy = (nodeA.vy || 0) - fy
                    nodeB.vx = (nodeB.vx || 0) + fx
                    nodeB.vy = (nodeB.vy || 0) + fy
                  }
                }
              })
            })
          })
          .force('boundary', (alpha: number) => {
            // Enhanced boundary force to keep nodes within bounds
            nodesWithSimulationProps.forEach((node: any) => {
              const radius = getCollisionRadius(node as CitationNetworkNode)
              const padding = 10 // Extra padding from edges
              
              if (node.x !== undefined && node.x !== null) {
                // Keep nodes away from right edge (keywords box area)
                if (node.x + radius > boundaryWidth - padding) {
                  const pushBack = (node.x + radius - (boundaryWidth - padding)) * alpha * 2.0
                  node.vx = (node.vx || 0) - pushBack
                }
                // Keep nodes away from left edge
                if (node.x - radius < padding) {
                  const pushBack = ((padding + radius) - node.x) * alpha * 2.0
                  node.vx = (node.vx || 0) + pushBack
                }
              }
              if (node.y !== undefined && node.y !== null) {
                // Keep nodes within vertical bounds
                if (node.y + radius > height - padding) {
                  const pushBack = (node.y + radius - (height - padding)) * alpha * 2.0
                  node.vy = (node.vy || 0) - pushBack
                }
                if (node.y - radius < padding) {
                  const pushBack = ((padding + radius) - node.y) * alpha * 2.0
                  node.vy = (node.vy || 0) + pushBack
                }
              }
            })
          })
        break

      case 'circular':
        const angleStep = (2 * Math.PI) / displayData.nodes.length
        displayData.nodes.forEach((node, i) => {
          const angle = i * angleStep
          const radius = Math.min(width, height) / 3
          const nodeWithProps = node as CitationNetworkNode & Partial<d3.SimulationNodeDatum>
          nodeWithProps.x = width / 2 + radius * Math.cos(angle)
          nodeWithProps.y = height / 2 + radius * Math.sin(angle)
        })
        break

      case 'grid':
        const cols = Math.ceil(Math.sqrt(displayData.nodes.length))
        const cellWidth = width / cols
        const cellHeight = height / Math.ceil(displayData.nodes.length / cols)
        displayData.nodes.forEach((node, i) => {
          const col = i % cols
          const row = Math.floor(i / cols)
          const nodeWithProps = node as CitationNetworkNode & Partial<d3.SimulationNodeDatum>
          nodeWithProps.x = col * cellWidth + cellWidth / 2
          nodeWithProps.y = row * cellHeight + cellHeight / 2
        })
        break

      case 'hierarchical':
        // Simple hierarchical layout - root at top, others below
        const rootNode = displayData.nodes.find(n => n.isRoot)
        if (rootNode) {
          const rootWithProps = rootNode as CitationNetworkNode & Partial<d3.SimulationNodeDatum>
          rootWithProps.x = width / 2
          rootWithProps.y = height / 4
        }
        const otherNodes = displayData.nodes.filter(n => !n.isRoot)
        const nodesPerRow = Math.ceil(Math.sqrt(otherNodes.length))
        const rowHeight = (height * 0.6) / Math.ceil(otherNodes.length / nodesPerRow)
        otherNodes.forEach((node, i) => {
          const col = i % nodesPerRow
          const row = Math.floor(i / nodesPerRow)
          const nodeWithProps = node as CitationNetworkNode & Partial<d3.SimulationNodeDatum>
          nodeWithProps.x = (width / nodesPerRow) * col + (width / nodesPerRow) / 2
          nodeWithProps.y = height / 4 + rowHeight * (row + 1)
        })
        break
    }

    if (simulation) {
      // Stop previous simulation if it exists
      if (simulationRef.current) {
        simulationRef.current.stop()
      }
      simulationRef.current = simulation
      
      // Add end event listener to ensure simulation completes smoothly
      simulation.on('end', () => {
        // Ensure final positions are set
        node.attr('cx', (d: any) => (d as any).x || 0).attr('cy', (d: any) => (d as any).y || 0)
        labels.attr('transform', (d: any) => {
          const x = (d as any).x || 0
          const y = (d as any).y || 0
          return `translate(${x},${y})`
        })
      })
      
      simulation.on('tick', () => {
        // Update link positions
        link
          .attr('x1', (d: any) => {
            const source = typeof d.source === 'string' 
              ? nodesWithSimulationProps.find(n => n.id === d.source)
              : d.source
            const sourceWithProps = source as (CitationNetworkNode & Partial<d3.SimulationNodeDatum>) | undefined
            return (sourceWithProps as any)?.x || 0
          })
          .attr('y1', (d: any) => {
            const source = typeof d.source === 'string' 
              ? nodesWithSimulationProps.find(n => n.id === d.source)
              : d.source
            const sourceWithProps = source as (CitationNetworkNode & Partial<d3.SimulationNodeDatum>) | undefined
            return (sourceWithProps as any)?.y || 0
          })
          .attr('x2', (d: any) => {
            const target = typeof d.target === 'string' 
              ? nodesWithSimulationProps.find(n => n.id === d.target)
              : d.target
            const targetWithProps = target as (CitationNetworkNode & Partial<d3.SimulationNodeDatum>) | undefined
            return (targetWithProps as any)?.x || 0
          })
          .attr('y2', (d: any) => {
            const target = typeof d.target === 'string' 
              ? nodesWithSimulationProps.find(n => n.id === d.target)
              : d.target
            const targetWithProps = target as (CitationNetworkNode & Partial<d3.SimulationNodeDatum>) | undefined
            return (targetWithProps as any)?.y || 0
          })

        // Update node and label positions smoothly
        node.attr('cx', (d: any) => (d as any).x || 0).attr('cy', (d: any) => (d as any).y || 0)
        // Position label groups at node center (foreignObject handles offset internally)
        labels.attr('transform', (d: any) => {
          const x = (d as any).x || 0
          const y = (d as any).y || 0
          return `translate(${x},${y})`
        })
      })
    } else {
      // Static layout - update positions immediately using nodesWithSimulationProps
      link
        .attr('x1', (d: any) => {
          const source = typeof d.source === 'string' 
            ? nodesWithSimulationProps.find(n => n.id === d.source)
            : d.source
          const sourceWithProps = source as (CitationNetworkNode & Partial<d3.SimulationNodeDatum>) | undefined
          return (sourceWithProps as any)?.x || 0
        })
        .attr('y1', (d: any) => {
          const source = typeof d.source === 'string' 
            ? nodesWithSimulationProps.find(n => n.id === d.source)
            : d.source
          const sourceWithProps = source as (CitationNetworkNode & Partial<d3.SimulationNodeDatum>) | undefined
          return (sourceWithProps as any)?.y || 0
        })
        .attr('x2', (d: any) => {
          const target = typeof d.target === 'string' 
            ? nodesWithSimulationProps.find(n => n.id === d.target)
            : d.target
          const targetWithProps = target as (CitationNetworkNode & Partial<d3.SimulationNodeDatum>) | undefined
          return (targetWithProps as any)?.x || 0
        })
        .attr('y2', (d: any) => {
          const target = typeof d.target === 'string' 
            ? nodesWithSimulationProps.find(n => n.id === d.target)
            : d.target
          const targetWithProps = target as (CitationNetworkNode & Partial<d3.SimulationNodeDatum>) | undefined
          return (targetWithProps as any)?.y || 0
        })

      node.attr('cx', (d: any) => {
        const nodeWithProps = nodesWithSimulationProps.find(n => n.id === d.id)
        return (nodeWithProps as any)?.x || 0
      }).attr('cy', (d: any) => {
        const nodeWithProps = nodesWithSimulationProps.find(n => n.id === d.id)
        return (nodeWithProps as any)?.y || 0
      })
      // Position label groups at node center (foreignObject handles offset internally)
      labels.attr('transform', (d: any) => {
        const nodeWithProps = nodesWithSimulationProps.find(n => n.id === d.id)
        const x = (nodeWithProps as any)?.x || 0
        const y = (nodeWithProps as any)?.y || 0
        return `translate(${x},${y})`
      })
    }

    // Cleanup
    return () => {
      tooltip.remove()
      if (simulationRef.current) {
        simulationRef.current.stop()
        simulationRef.current = null
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
    const subject = event.subject as CitationNetworkNode & Partial<d3.SimulationNodeDatum>
    subject.fx = (subject as any).x
    subject.fy = (subject as any).y
  }

  function dragged(event: d3.D3DragEvent<SVGCircleElement, CitationNetworkNode, CitationNetworkNode>) {
    const subject = event.subject as CitationNetworkNode & Partial<d3.SimulationNodeDatum>
    subject.fx = event.x
    subject.fy = event.y
  }

  function dragended(event: d3.D3DragEvent<SVGCircleElement, CitationNetworkNode, CitationNetworkNode>) {
    if (simulation && !event.active) simulation.alphaTarget(0)
    const subject = event.subject as CitationNetworkNode & Partial<d3.SimulationNodeDatum>
    subject.fx = null
    subject.fy = null
  }

  return d3.drag<SVGCircleElement, CitationNetworkNode>()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended)
}

