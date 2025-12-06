'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Dummy data structure matching citation network format
const createDummyData = () => {
  return {
    name: 'Root Paper: Machine Learning in Healthcare',
    id: 'root',
    children: [
      {
        name: 'Deep Learning Applications',
        id: 'child1',
        children: [
          { name: 'Neural Networks for Diagnosis', id: 'grandchild1' },
          { name: 'CNN for Medical Imaging', id: 'grandchild2' },
          {
            name: 'RNN for Time Series',
            id: 'grandchild3',
            children: [
              { name: 'LSTM Models', id: 'great-grandchild1' },
              { name: 'GRU Variants', id: 'great-grandchild2' },
            ],
          },
        ],
      },
      {
        name: 'Natural Language Processing',
        id: 'child2',
        children: [
          { name: 'Clinical Text Analysis', id: 'grandchild4' },
          { name: 'Medical Record Extraction', id: 'grandchild5' },
        ],
      },
      {
        name: 'Reinforcement Learning',
        id: 'child3',
        children: [
          { name: 'Treatment Optimization', id: 'grandchild6' },
          {
            name: 'Drug Discovery',
            id: 'grandchild7',
            children: [
              { name: 'Molecular Design', id: 'great-grandchild3' },
              { name: 'Compound Screening', id: 'great-grandchild4' },
            ],
          },
        ],
      },
      {
        name: 'Computer Vision',
        id: 'child4',
        children: [
          { name: 'Radiology Analysis', id: 'grandchild8' },
          { name: 'Pathology Detection', id: 'grandchild9' },
        ],
      },
      {
        name: 'Predictive Analytics',
        id: 'child5',
        children: [
          { name: 'Risk Stratification', id: 'grandchild10' },
          { name: 'Outcome Prediction', id: 'grandchild11' },
        ],
      },
    ],
  }
}

interface CitationTreeVisualizationProps {
  data?: any
  width?: number
  height?: number
}

export function CitationTreeVisualization({
  data,
  width = 928,
  height = 600,
}: CitationTreeVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const zoomLevelRef = useRef(1)
  const initialZoomSetRef = useRef(false)
  const zoomDisplayRef = useRef<HTMLDivElement>(null)
  const treeDataRef = useRef(data || createDummyData())
  const [dimensions, setDimensions] = useState({ width, height })
  
  // Update ref when data changes (but don't trigger re-render)
  const currentData = data || createDummyData()
  if (treeDataRef.current !== currentData) {
    treeDataRef.current = currentData
  }

  // Update dimensions based on container size
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: Math.max(600, rect.width - 48), // Account for padding
          height: Math.max(400, rect.height - 48),
        })
      } else {
        // Fallback to props if container not available
        setDimensions({ width, height })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height])

  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    
    // Set up zoom behavior (only once)
    if (!zoomRef.current) {
      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 3])
        .on('zoom', (event) => {
          // Get svg from ref to avoid stale closure
          if (svgRef.current) {
            const currentSvg = d3.select(svgRef.current)
            const g = currentSvg.select('g')
            if (g.node()) {
              // Apply transform directly to DOM - no React re-render
              g.attr('transform', event.transform)
              zoomLevelRef.current = event.transform.k
              
              // Update display directly via DOM - no React re-render
              if (zoomDisplayRef.current) {
                zoomDisplayRef.current.textContent = `Zoom: ${Math.round(event.transform.k * 100)}% | Click nodes to expand/collapse`
              }
            }
          }
        })

      zoomRef.current = zoom
      svg.call(zoom)
    }

    // Clear previous render (but preserve zoom transform)
    const existingG = svg.select('g')
    const existingGNode = existingG.node()
    const existingTransform = existingGNode ? existingG.attr('transform') : null
    
    svg.selectAll('*').remove()

    const g = svg.append('g')
    
    // Restore zoom transform if it existed
    if (existingTransform) {
      g.attr('transform', existingTransform)
    }

    // Create hierarchy from data (use ref to avoid unnecessary re-renders)
    const root = d3.hierarchy(treeDataRef.current) as any
    root.x0 = dimensions.width / 2
    root.y0 = 0

    // Create tree layout (vertical: width for x-axis, height for y-axis)
    const tree = d3.tree().size([dimensions.width - 200, dimensions.height - 100])

    // Collapse all nodes initially except root
    root.children?.forEach((child: any) => {
      collapse(child)
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

    function update(source: any) {
      const treeData = tree(root as any)

      // Compute the new tree layout
      const nodes = treeData.descendants()
      const links = treeData.links()

      // Normalize for fixed-depth (vertical layout)
      nodes.forEach((d: any) => {
        d.y = d.depth * 120
      })

      // Update the nodes
      const node = g
        .selectAll<SVGGElement, any>('g.node')
        .data(nodes, (d: any) => d.id || (d.id = ++i))

      // Enter any new nodes at the parent's previous position (vertical layout)
      const nodeEnter = node
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', () => `translate(${source.x0},${source.y0})`)
        .on('click', (event, d: any) => {
          if (d.children) {
            d._children = d.children
            d.children = undefined
          } else {
            d.children = d._children
            d._children = undefined
          }
          update(d)
        })

      // Add circle for the nodes
      nodeEnter
        .append('circle')
        .attr('r', 6)
        .attr('fill', (d: any) => (d._children ? '#4ade80' : d.children ? '#22c55e' : '#86efac'))
        .attr('stroke', '#16a34a')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')

      // Add labels for the nodes (positioned below for vertical layout)
      nodeEnter
        .append('text')
        .attr('dy', '1.2em')
        .attr('x', 0)
        .attr('text-anchor', 'middle')
        .text((d: any) => d.data.name)
        .attr('fill', '#e5e7eb')
        .attr('font-size', '12px')
        .style('cursor', 'pointer')

      // Update
      const nodeUpdate = nodeEnter.merge(node as any)

      // Transition to the proper position for the node (vertical: x for horizontal, y for vertical)
      nodeUpdate
        .transition()
        .duration(300)
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`)

      // Update the node attributes and style
      nodeUpdate
        .select('circle')
        .attr('r', 6)
        .attr('fill', (d: any) => (d._children ? '#4ade80' : d.children ? '#22c55e' : '#86efac'))
        .attr('stroke', '#16a34a')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')

      // Remove any exiting nodes (vertical layout)
      const nodeExit = node.exit().transition().duration(300).attr('transform', () => `translate(${source.x},${source.y})`).remove()

      // On exit reduce the node circles size to 0
      nodeExit.select('circle').attr('r', 1e-6)

      // On exit reduce the opacity of text labels
      nodeExit.select('text').style('fill-opacity', 1e-6)

      // Update the links
      const link = g
        .selectAll<SVGPathElement, any>('path.link')
        .data(links, (d: any) => d.target.id)

      // Enter any new links at the parent's previous position
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
        .attr('stroke-width', 2)

      // Update
      const linkUpdate = linkEnter.merge(link)

      // Transition back to the parent element position
      linkUpdate
        .transition()
        .duration(300)
        .attr('d', (d: any) => diagonal(d.source, d.target))

      // Remove any exiting links
      link.exit()
        .transition()
        .duration(300)
        .attr('d', () => {
          const o = { x: source.x, y: source.y }
          return diagonal({ x: o.x, y: o.y } as any, { x: o.x, y: o.y } as any)
        })
        .remove()

      // Store the old positions for transition
      nodes.forEach((d: any) => {
        d.x0 = d.x
        d.y0 = d.y
      })

      // Create a curved (diagonal) path from parent to child (vertical layout)
      function diagonal(s: any, d: any) {
        return `M ${s.x} ${s.y}
                C ${s.x} ${(s.y + d.y) / 2},
                  ${d.x} ${(s.y + d.y) / 2},
                  ${d.x} ${d.y}`
      }
    }

    // Initial zoom to fit (only once on first render)
    const gNode = g.node() as SVGGElement | null
    if (!initialZoomSetRef.current && gNode && zoomRef.current) {
      initialZoomSetRef.current = true
      // Use requestAnimationFrame to ensure bounds are calculated after render
      requestAnimationFrame(() => {
        // Verify node still exists and has content before getting bounds
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
          // Update display directly via DOM - no React re-render
          if (zoomDisplayRef.current) {
            zoomDisplayRef.current.textContent = `Zoom: ${Math.round(scale * 100)}% | Click nodes to expand/collapse`
          }
          }
        } catch (error) {
          // Silently handle getBBox errors (element might not be ready)
          console.warn('Could not calculate bounds for initial zoom:', error)
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions.width, dimensions.height])

  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      const svg = d3.select(svgRef.current)
      svg
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy as any, 1.5)
    }
  }

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      const svg = d3.select(svgRef.current)
      svg
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy as any, 1 / 1.5)
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
          // Update display directly via DOM - no React re-render
          if (zoomDisplayRef.current) {
            zoomDisplayRef.current.textContent = `Zoom: ${Math.round(scale * 100)}% | Click nodes to expand/collapse`
          }
          }
        } catch (error) {
          // Silently handle getBBox errors
          console.warn('Could not calculate bounds for reset:', error)
        }
      }
    }
  }

  return (
    <div ref={containerRef} className="relative bg-[#0f0f0f] rounded-lg border border-[#2a2a2a] w-full h-full min-h-[400px]">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleZoomIn}
          className="bg-[#1f1f1f] border-[#2a2a2a] text-gray-300 h-8 hover:bg-[#2a2a2a]"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleZoomOut}
          className="bg-[#1f1f1f] border-[#2a2a2a] text-gray-300 h-8 hover:bg-[#2a2a2a]"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReset}
          className="bg-[#1f1f1f] border-[#2a2a2a] text-gray-300 h-8 hover:bg-[#2a2a2a]"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
      <div 
        ref={zoomDisplayRef}
        className="absolute top-4 left-4 z-10 text-xs text-gray-400 bg-[#1f1f1f]/80 px-2 py-1 rounded"
      >
        Zoom: 100% | Click nodes to expand/collapse
      </div>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full h-full" />
    </div>
  )
}

