'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { VeritusPaper, CitationNetwork as CitationNetworkType, CitationNetworkNode, CitationNetworkEdge } from '@/types/veritus'
import { Graph, CitationNetwork as CitationNetworkData, CitationNetworkResponse } from '@/types/paper-api'
import { buildCitationNetwork } from '@/lib/citation-network'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CitationNetworkProps {
  papers?: VeritusPaper[]
  citationNetworkResponse?: CitationNetworkResponse
  width?: number
  height?: number
  onNodeClick?: (paper: VeritusPaper) => void
  chatId?: string | null
}

export function CitationNetwork({ papers, citationNetworkResponse, width = 800, height = 600, onNodeClick, chatId }: CitationNetworkProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  useEffect(() => {
    if (!svgRef.current) return

    // Determine data source
    let network: { nodes: CitationNetworkNode[], edges: CitationNetworkEdge[] }
    let networkData: CitationNetworkData | null = null
    let mode: 'simple' | 'full' | 'papers' = 'papers'

    if (citationNetworkResponse) {
      if (citationNetworkResponse.citationNetwork) {
        // Full mode - use citationNetwork
        mode = 'full'
        networkData = citationNetworkResponse.citationNetwork
        network = {
          nodes: citationNetworkResponse.citationNetwork.nodes.map(node => ({
            id: node.id,
            paper: (node.data as VeritusPaper) || {
              id: node.id,
              title: node.label,
              impactFactor: { 
                citationCount: node.citations || 0,
                influentialCitationCount: 0,
                referenceCount: 0
              },
              authors: node.authors || '',
              year: node.year,
              journalName: null,
              abstract: null,
              tldr: null,
              fieldsOfStudy: [],
              publicationType: null,
              downloadable: false,
              doi: null,
              pdfLink: null,
              publishedAt: null,
            } as VeritusPaper,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
          })),
          edges: citationNetworkResponse.citationNetwork.edges.map(edge => ({
            ...edge,
            type: edge.type === 'references' ? 'cited_by' : edge.type,
          })),
        }
      } else if (citationNetworkResponse.graph) {
        // Simple mode - use graph
        mode = 'simple'
        network = {
          nodes: citationNetworkResponse.graph.nodes.map(node => ({
            id: node.id,
            paper: {
              id: node.id,
              title: node.label,
              impactFactor: { 
                citationCount: node.citations || 0,
                influentialCitationCount: 0,
                referenceCount: 0
              },
              authors: '',
              year: null,
              journalName: null,
              abstract: null,
              tldr: null,
              fieldsOfStudy: [],
              publicationType: null,
              downloadable: false,
              doi: null,
              pdfLink: null,
              publishedAt: null,
            } as VeritusPaper,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
          })),
          edges: citationNetworkResponse.graph.edges.map(edge => ({
            source: edge.source,
            target: edge.target,
            type: 'cites' as const,
            weight: edge.weight,
          })),
        }
      } else {
        return
      }
    } else if (papers && papers.length > 0) {
      // Legacy mode - build from papers
      mode = 'papers'
      network = buildCitationNetwork(papers)
    } else {
      return
    }

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)

    // Create container for zoomable content
    const g = svg.append('g')

    // Set up zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
        setZoomLevel(event.transform.k)
      })

    svg.call(zoom)

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
    
    // Calculate dynamic collision radius that accounts for node and wrapped label
    const getCollisionRadius = (node: CitationNetworkNode) => {
      const citations = node.paper?.impactFactor?.citationCount || 0
      const nodeRadius = Math.max(8, Math.min(20, 8 + citations / 10))
      const label = node.paper?.title || 'Unknown'
      
      // Wrap text to calculate actual label dimensions
      const maxLabelWidth = 120 // Fixed max width for wrapping
      const labelOffset = 15 // dx offset from node center
      const labelPadding = 20
      
      const { width: labelWidth, height: labelHeight } = wrapText(label, maxLabelWidth)
      
      // Calculate full bounding box
      const totalWidth = nodeRadius + labelOffset + labelWidth + labelPadding
      const totalHeight = Math.max(nodeRadius * 2, labelHeight + labelPadding)
      const maxDimension = Math.max(totalWidth, totalHeight)
      
      // Scale based on number of nodes
      const nodeCount = network.nodes.length
      const densityFactor = Math.max(1, Math.sqrt(nodeCount / 10))
      const minSpacing = 50 * densityFactor
      
      return Math.max(maxDimension / 2, nodeRadius + minSpacing)
    }
    
    // Calculate dynamic spacing parameters
    const nodeCount = network.nodes.length
    const edgeCount = network.edges.length
    const graphDensity = edgeCount / Math.max(nodeCount, 1)
    const baseChargeStrength = -800
    const chargeMultiplier = Math.max(1, Math.sqrt(nodeCount / 5))
    const linkDistanceBase = 150
    const linkDistanceMultiplier = Math.max(1, Math.sqrt(nodeCount / 8))
    
    // Create optimized force simulation with fixes to prevent overlaps
    // CRITICAL FIXES: Lower link strength, slow alpha decay, strong collision, separation force
    const simulation = d3.forceSimulation<CitationNetworkNode>(network.nodes)
      .alpha(1)
      .alphaDecay(0.01) // Slow decay for more iterations (was adaptive 0.01-0.05)
      .alphaMin(0.0001) // Lower minimum for thorough settling
      .velocityDecay(0.4) // Moderate damping to allow movement
      // CRITICAL FIX #1: Lower link strength to prevent overriding collision
      .force('link', d3.forceLink<CitationNetworkNode, CitationNetworkEdge>(network.edges)
        .id((d) => d.id)
        .distance((d) => {
          const sourceNode = typeof d.source === 'object' ? d.source : network.nodes.find(n => n.id === d.source) || network.nodes[0]
          const targetNode = typeof d.target === 'object' ? d.target : network.nodes.find(n => n.id === d.target) || network.nodes[0]
          const sourceRadius = getCollisionRadius(sourceNode)
          const targetRadius = getCollisionRadius(targetNode)
          const baseDistance = sourceRadius + targetRadius + (linkDistanceBase * linkDistanceMultiplier)
          const edge = d as any
          const weight = typeof edge.weight === 'number' ? edge.weight : 1
          return baseDistance * (0.8 + weight * 0.4)
        })
        .strength(0.1)) // CRITICAL: Low link strength (was 0.5-1.5) to prevent overriding collision
      // CRITICAL FIX #2: Stronger repulsion
      .force('charge', d3.forceManyBody<CitationNetworkNode>().strength((d) => {
        const nodeRadius = getCollisionRadius(d)
        const baseCharge = baseChargeStrength * chargeMultiplier * 1.5 // 50% stronger
        const sizeFactor = 1 + (nodeRadius / 50)
        return baseCharge * sizeFactor
      }))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.02))
      // CRITICAL FIX #3: Strong collision with multiple iterations
      .force('collision', d3.forceCollide<CitationNetworkNode>()
        .radius((d) => getCollisionRadius(d) * 1.15) // 15% padding
        .strength(1.0)
        .iterations(2)) // Multiple iterations for better collision resolution
      .force('x', d3.forceX(width / 2).strength(0.01)) // Very weak X pull
      .force('y', d3.forceY(height / 2).strength(0.01)) // Very weak Y pull
      // CRITICAL FIX #4: Add strong separation force
      .force('separation', (alpha: number) => {
        const padding = 5
        network.nodes.forEach((nodeA, i) => {
          const radiusA = getCollisionRadius(nodeA)
          network.nodes.forEach((nodeB, j) => {
            if (i >= j) return
            const radiusB = getCollisionRadius(nodeB)
            const minDistance = radiusA + radiusB + padding
            
            if (nodeA.x !== undefined && nodeA.y !== undefined &&
                nodeB.x !== undefined && nodeB.y !== undefined) {
              const dx = nodeB.x - nodeA.x
              const dy = nodeB.y - nodeA.y
              const distance = Math.sqrt(dx * dx + dy * dy) || 1
              
              if (distance < minDistance) {
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
        const padding = 10
        network.nodes.forEach((node) => {
          const radius = getCollisionRadius(node)
          if (node.x !== undefined && node.x !== null) {
            if (node.x + radius > width - padding) {
              const pushBack = (node.x + radius - (width - padding)) * alpha * 2.0
              node.vx = (node.vx || 0) - pushBack
            }
            if (node.x - radius < padding) {
              const pushBack = ((padding + radius) - node.x) * alpha * 2.0
              node.vx = (node.vx || 0) + pushBack
            }
          }
          if (node.y !== undefined && node.y !== null) {
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

    // Create edges (lines) - properly typed for D3 force link
    type LinkDatum = d3.SimulationLinkDatum<CitationNetworkNode> & CitationNetworkEdge
    const link = g.append('g')
      .selectAll<SVGLineElement, LinkDatum>('line')
      .data(network.edges)
      .enter()
      .append('line')
      .attr('stroke', '#4a5568')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)

    // Create nodes (circles)
    const node = g.append('g')
      .selectAll('circle')
      .data(network.nodes)
      .enter()
      .append('circle')
      .attr('r', (d) => {
        const citations = d.paper?.impactFactor?.citationCount || 0
        return Math.max(8, Math.min(20, 8 + citations / 10))
      })
      .attr('fill', (d) => {
        if (selectedNode === d.id) return '#3b82f6'
        if (mode === 'full' && networkData) {
          const nodeData = networkData.nodes.find(n => n.id === d.id)
          if (nodeData?.isRoot) return '#ffd93d'
          if (nodeData?.type === 'citing') return '#ff6b6b'
          if (nodeData?.type === 'referenced') return '#4ecdc4'
        }
        return '#60a5fa'
      })
      .attr('stroke', '#1e40af')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', async (event, d) => {
        event.stopPropagation()
        setSelectedNode(selectedNode === d.id ? null : d.id)
        // Call onNodeClick if paper data is available
        if (onNodeClick && d.paper) {
          // If paper data is incomplete, try to fetch full details
          let paperData = d.paper
          if (!paperData.abstract && !paperData.tldr && chatId) {
            // Try to get full paper data from cache or API
            try {
              const paperId = paperData.id?.replace('paper-', '').replace('root-', '')
              if (paperId) {
                const response = await fetch(`/api/v1/papers/${paperId}?chatId=${chatId}`)
                if (response.ok) {
                  const data = await response.json()
                  if (data.paper) {
                    paperData = data.paper
                  }
                }
              }
            } catch (error) {
              console.error('Error fetching paper details:', error)
            }
          }
          onNodeClick(paperData)
        }
      })
      .call(drag(simulation))

    // Create wrapped labels using foreignObject for proper text wrapping
    const maxLabelWidth = 120 // Fixed max width for wrapping
    const labelOffset = 15 // Horizontal offset from node center
    const fontSize = 10
    const lineHeight = fontSize * 1.2
    
    const labels = g.append('g')
      .attr('class', 'labels')
      .selectAll('g.label-group')
      .data(network.nodes)
      .enter()
      .append('g')
      .attr('class', 'label-group')
    
    // Create foreignObject for each label to enable text wrapping
    const labelForeignObjects = labels.append('foreignObject')
      .attr('width', maxLabelWidth)
      .attr('height', (d) => {
        const { height } = wrapText(d.paper?.title || 'Unknown', maxLabelWidth)
        return height
      })
      .attr('x', labelOffset)
      .attr('y', (d) => {
        const { height } = wrapText(d.paper?.title || 'Unknown', maxLabelWidth)
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
        const { wrappedLines } = wrapText(d.paper?.title || 'Unknown', maxLabelWidth)
        // Escape HTML and join lines with <br>
        return wrappedLines
          .map(line => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
          .join('<br>')
      })

    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
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

    node.on('mouseover', (event, d) => {
        tooltip.transition().duration(200).style('opacity', 1)
        tooltip.html(`
          <div class="font-semibold mb-1">${d.paper.title}</div>
          <div class="text-xs text-gray-400 mb-1">${d.paper.authors}</div>
          <div class="text-xs">
            Citations: ${d.paper.impactFactor?.citationCount || 0}<br/>
            Year: ${d.paper.year || 'N/A'}<br/>
            Journal: ${d.paper.journalName || 'N/A'}
          </div>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px')
      })
      .on('mouseout', () => {
        tooltip.transition().duration(200).style('opacity', 0)
      })

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => {
          const source = typeof d.source === 'object' ? d.source : network.nodes.find(n => n.id === d.source)
          return source?.x ?? 0
        })
        .attr('y1', (d) => {
          const source = typeof d.source === 'object' ? d.source : network.nodes.find(n => n.id === d.source)
          return source?.y ?? 0
        })
        .attr('x2', (d) => {
          const target = typeof d.target === 'object' ? d.target : network.nodes.find(n => n.id === d.target)
          return target?.x ?? 0
        })
        .attr('y2', (d) => {
          const target = typeof d.target === 'object' ? d.target : network.nodes.find(n => n.id === d.target)
          return target?.y ?? 0
        })

      node
        .attr('cx', (d) => d.x!)
        .attr('cy', (d) => d.y!)

      // Position label groups at node center (foreignObject handles offset internally)
      labels.attr('transform', (d) => {
        const x = d.x || 0
        const y = d.y || 0
        return `translate(${x},${y})`
      })
    })

    // Cleanup
    return () => {
      tooltip.remove()
      simulation.stop()
    }
  }, [papers, citationNetworkResponse, selectedNode, width, height, onNodeClick, chatId])

  const handleZoomIn = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      svg.transition().call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
        1.5
      )
    }
  }

  const handleZoomOut = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      svg.transition().call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
        1 / 1.5
      )
    }
  }

  const handleReset = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      svg.transition().call(
        d3.zoom<SVGSVGElement, unknown>().transform as any,
        d3.zoomIdentity
      )
      setZoomLevel(1)
    }
  }

  const hasData = (papers && papers.length > 0) || citationNetworkResponse

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>Select papers to visualize citation network</p>
      </div>
    )
  }

  return (
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
        Zoom: {(zoomLevel * 100).toFixed(0)}% | {citationNetworkResponse?.citationNetwork?.stats.totalNodes || citationNetworkResponse?.graph?.nodes.length || papers?.length || 0} {citationNetworkResponse?.citationNetwork ? 'nodes' : 'papers'}
        {citationNetworkResponse?.meta?.mode && ` | Mode: ${citationNetworkResponse.meta.mode}`}
        {citationNetworkResponse?.citationNetwork?.stats && (
          <span> | {citationNetworkResponse.citationNetwork.stats.totalEdges} edges</span>
        )}
      </div>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="w-full h-full"
      />
    </div>
  )
}

// Drag behavior function
function drag(simulation: d3.Simulation<CitationNetworkNode, undefined>) {
  function dragstarted(event: d3.D3DragEvent<SVGCircleElement, CitationNetworkNode, CitationNetworkNode>) {
    if (!event.active) simulation.alphaTarget(0.3).restart()
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
    if (!event.active) simulation.alphaTarget(0)
    const subject = event.subject as CitationNetworkNode
    subject.fx = null
    subject.fy = null
  }

  return d3.drag<SVGCircleElement, CitationNetworkNode>()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended)
}

