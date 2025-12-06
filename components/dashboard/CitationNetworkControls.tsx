'use client'

import { LayoutGrid, Network, Circle, Grid3x3, Layers, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { LayoutType } from '@/types/graph-visualization'
import { CitationNetworkResponse } from '@/types/paper-api'

interface CitationNetworkControlsProps {
  layout: LayoutType
  sortBy: 'relevance' | 'citations' | 'year'
  showLabels: boolean
  onLayoutChange: (layout: LayoutType) => void
  onSortChange: (sortBy: 'relevance' | 'citations' | 'year') => void
  onToggleLabels: () => void
  citationNetworkResponse?: CitationNetworkResponse
}

const layoutIcons = {
  force: Network,
  hierarchical: Layers,
  circular: Circle,
  grid: Grid3x3,
  cluster: LayoutGrid,
}

const layoutLabels = {
  force: 'Force-Directed',
  hierarchical: 'Hierarchical',
  circular: 'Circular',
  grid: 'Grid',
  cluster: 'Clustered',
}

export function CitationNetworkControls({
  layout,
  sortBy,
  showLabels,
  onLayoutChange,
  onSortChange,
  onToggleLabels,
  citationNetworkResponse,
}: CitationNetworkControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-3 bg-[#171717] border border-[#2a2a2a] rounded-lg">
      {/* Layout Selector */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-gray-400">Layout:</Label>
        <div className="flex gap-1">
          {(Object.keys(layoutIcons) as LayoutType[]).map((layoutType) => {
            const Icon = layoutIcons[layoutType]
            return (
              <Button
                key={layoutType}
                variant={layout === layoutType ? 'default' : 'outline'}
                size="sm"
                onClick={() => onLayoutChange(layoutType)}
                className={`h-8 px-2 ${
                  layout === layoutType
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-[#1f1f1f] border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]'
                }`}
                title={layoutLabels[layoutType]}
              >
                <Icon className="h-4 w-4" />
              </Button>
            )
          })}
        </div>
      </div>

      {/* Sorting */}
      <div className="flex items-center gap-2">
        <ArrowUpDown className="h-4 w-4 text-gray-400" />
        <Label className="text-xs text-gray-400">Sort:</Label>
        <RadioGroup
          value={sortBy}
          onValueChange={(value) => onSortChange(value as 'relevance' | 'citations' | 'year')}
          className="flex gap-3"
        >
          <div className="flex items-center space-x-1">
            <RadioGroupItem value="relevance" id="sort-relevance" className="border-gray-600" />
            <Label htmlFor="sort-relevance" className="text-xs text-gray-300 cursor-pointer">
              Relevance
            </Label>
          </div>
          <div className="flex items-center space-x-1">
            <RadioGroupItem value="citations" id="sort-citations" className="border-gray-600" />
            <Label htmlFor="sort-citations" className="text-xs text-gray-300 cursor-pointer">
              Citations
            </Label>
          </div>
          <div className="flex items-center space-x-1">
            <RadioGroupItem value="year" id="sort-year" className="border-gray-600" />
            <Label htmlFor="sort-year" className="text-xs text-gray-300 cursor-pointer">
              Year
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* View Options */}
      <div className="flex items-center gap-2">
        <Button
          variant={showLabels ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleLabels}
          className={`h-8 px-3 ${
            showLabels
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-[#1f1f1f] border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]'
          }`}
        >
          Labels
        </Button>
      </div>

      {/* Stats */}
      {citationNetworkResponse?.citationNetwork?.stats && (
        <div className="ml-auto text-xs text-gray-400">
          {citationNetworkResponse.citationNetwork.stats.totalNodes} nodes •{' '}
          {citationNetworkResponse.citationNetwork.stats.totalEdges} edges
        </div>
      )}
    </div>
  )
}

