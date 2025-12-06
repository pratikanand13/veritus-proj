import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { sortPapers } from '@/lib/services/citation-network-builder'
import { CitationNetwork } from '@/types/paper-api'

interface FilterRequest {
  citationNetwork: CitationNetwork
  filters?: {
    minCitations?: number
    maxCitations?: number
    minYear?: number
    maxYear?: number
    types?: ('root' | 'citing' | 'referenced' | 'both')[]
    authors?: string[]
    fieldsOfStudy?: string[]
  }
  sortBy?: 'relevance' | 'citations' | 'year'
  limit?: number
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: FilterRequest = await request.json()
    const { citationNetwork, filters = {}, sortBy = 'relevance', limit } = body

    if (!citationNetwork || !citationNetwork.nodes) {
      return NextResponse.json(
        { error: 'citationNetwork with nodes is required' },
        { status: 400 }
      )
    }

    // Validate sortBy parameter
    const validSortBy = ['relevance', 'citations', 'year']
    const sortAlgorithm = validSortBy.includes(sortBy) ? sortBy : 'relevance'

    let filteredNodes = [...citationNetwork.nodes]
    const originalCount = filteredNodes.length

    // Apply filters
    if (filters.minCitations !== undefined) {
      filteredNodes = filteredNodes.filter((n) => n.citations >= filters.minCitations!)
    }
    if (filters.maxCitations !== undefined) {
      filteredNodes = filteredNodes.filter((n) => n.citations <= filters.maxCitations!)
    }
    if (filters.minYear !== undefined) {
      filteredNodes = filteredNodes.filter(
        (n) => n.year && n.year >= filters.minYear!
      )
    }
    if (filters.maxYear !== undefined) {
      filteredNodes = filteredNodes.filter(
        (n) => n.year && n.year <= filters.maxYear!
      )
    }
    if (filters.types && Array.isArray(filters.types) && filters.types.length > 0) {
      filteredNodes = filteredNodes.filter((n) => filters.types!.includes(n.type))
    }
    if (filters.authors && Array.isArray(filters.authors) && filters.authors.length > 0) {
      filteredNodes = filteredNodes.filter((n) =>
        filters.authors!.some((author) => {
          const nodeAuthors = (n as any).data?.authors || n.authors || ''
          return nodeAuthors.toLowerCase().includes(author.toLowerCase())
        })
      )
    }
    if (
      filters.fieldsOfStudy &&
      Array.isArray(filters.fieldsOfStudy) &&
      filters.fieldsOfStudy.length > 0
    ) {
      filteredNodes = filteredNodes.filter((n) =>
        filters.fieldsOfStudy!.some((field) =>
          (n as any).data?.fieldsOfStudy?.includes(field)
        )
      )
    }

    // Apply sorting
    const papersForSorting = filteredNodes.map((node) => {
      const nodeData = (node as any).data || {
        id: node.id,
        score: (node as any).score,
        impactFactor: { citationCount: node.citations },
        year: node.year,
      }
      return nodeData
    })
    const sortedPapers = sortPapers(papersForSorting, sortAlgorithm)

    // Map sorted papers back to nodes (preserving node structure)
    const sortedNodeIds = sortedPapers.map((p) => p.id)
    const sortedNodes = sortedNodeIds
      .map((id) => filteredNodes.find((n) => n.id === id))
      .filter(Boolean) as typeof filteredNodes

    // Apply limit if specified
    const finalNodes = limit ? sortedNodes.slice(0, limit) : sortedNodes

    // Filter edges to only include filtered nodes
    const filteredNodeIds = new Set(finalNodes.map((n) => n.id))
    const filteredEdges = citationNetwork.edges.filter(
      (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
    )

    // Recalculate stats
    const citingCount = finalNodes.filter(
      (n) => n.type === 'citing' || n.type === 'both'
    ).length
    const referencedCount = finalNodes.filter(
      (n) => n.type === 'referenced' || n.type === 'both'
    ).length

    return NextResponse.json({
      citationNetwork: {
        nodes: finalNodes,
        edges: filteredEdges,
        stats: {
          totalNodes: finalNodes.length,
          totalEdges: filteredEdges.length,
          citingCount: citingCount,
          referencedCount: referencedCount,
        },
      },
      meta: {
        filters: filters,
        sortBy: sortAlgorithm,
        originalCount: originalCount,
        filteredCount: finalNodes.length,
        limit: limit || null,
      },
    })
  } catch (error: any) {
    console.error('Error in filter endpoint:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

