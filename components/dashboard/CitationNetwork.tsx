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
            label: node.label,
            paper: (node.data as VeritusPaper) || {
              id: node.id,
              title: node.label,
              impactFactor: { citationCount: node.citations },
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
            } as VeritusPaper,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
          })),
          edges: citationNetworkResponse.citationNetwork.edges,
        }
      } else if (citationNetworkResponse.graph) {
        // Simple mode - use graph
        mode = 'simple'
        network = {
          nodes: citationNetworkResponse.graph.nodes.map(node => ({
            id: node.id,
            label: node.label,
            paper: {
              id: node.id,
              title: node.label,
              impactFactor: { citationCount: node.citations },
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

    // Create force simulation
    const simulation = d3.forceSimulation<CitationNetworkNode>(network.nodes)
      .force('link', d3.forceLink<CitationNetworkNode, CitationNetworkEdge>(network.edges).id((d) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30))

    // Create edges (lines)
    const link = g.append('g')
      .selectAll('line')
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
                const response = await fetch(`/api/v1/papers/${paperId}?chatId=${chatId}&mock=true`)
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

    // Create labels
    const labels = g.append('g')
      .selectAll('text')
      .data(network.nodes)
      .enter()
      .append('text')
      .text((d) => {
        const title = d.paper?.title || d.label || 'Unknown'
        return title.length > 30 ? title.substring(0, 30) + '...' : title
      })
      .attr('font-size', '10px')
      .attr('fill', '#e5e7eb')
      .attr('dx', 15)
      .attr('dy', 4)

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
        .attr('x1', (d) => (d.source as CitationNetworkNode).x!)
        .attr('y1', (d) => (d.source as CitationNetworkNode).y!)
        .attr('x2', (d) => (d.target as CitationNetworkNode).x!)
        .attr('y2', (d) => (d.target as CitationNetworkNode).y!)

      node
        .attr('cx', (d) => d.x!)
        .attr('cy', (d) => d.y!)

      labels
        .attr('x', (d) => d.x!)
        .attr('y', (d) => d.y!)
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
function drag(simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) {
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

