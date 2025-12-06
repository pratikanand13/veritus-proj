'use client'

import { useState, useEffect } from 'react'
import { X, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { FilterState } from '@/types/graph-visualization'
import { CitationNetwork } from '@/types/paper-api'

interface CitationNetworkFiltersProps {
  citationNetwork: CitationNetwork
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onApplyFilters: () => void
  onResetFilters: () => void
}

export function CitationNetworkFilters({
  citationNetwork,
  filters,
  onFiltersChange,
  onApplyFilters,
  onResetFilters,
}: CitationNetworkFiltersProps) {
  const [localFilters, setLocalFilters] = useState<FilterState>(filters)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    const newFilters = { ...localFilters, [key]: value }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const handleReset = () => {
    const emptyFilters: FilterState = {}
    setLocalFilters(emptyFilters)
    onFiltersChange(emptyFilters)
    onResetFilters()
  }

  // Calculate ranges from data
  const citations = citationNetwork.nodes.map(n => n.citations).filter(Boolean)
  const years = citationNetwork.nodes.map(n => n.year).filter((y): y is number => y !== null)
  
  const minCitations = Math.min(...citations, 0)
  const maxCitations = Math.max(...citations, 0)
  const minYear = years.length > 0 ? Math.min(...years) : 2000
  const maxYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear()

  const uniqueAuthors = Array.from(
    new Set(
      citationNetwork.nodes
        .map(n => n.authors)
        .filter((a): a is string => a !== null)
        .flatMap(a => a.split(',').map(author => author.trim()))
    )
  ).slice(0, 20) // Limit to 20 authors

  const activeFilterCount = Object.values(localFilters).filter(v => {
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'string') return v.length > 0
    return v !== undefined && v !== null
  }).length

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-[#1f1f1f] border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]"
      >
        <Filter className="h-4 w-4 mr-2" />
        Filters
        {activeFilterCount > 0 && (
          <span className="ml-2 px-1.5 py-0.5 bg-green-600 text-white text-xs rounded-full">
            {activeFilterCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute top-12 left-0 z-50 w-80 bg-[#1f1f1f] border border-[#2a2a2a] rounded-lg shadow-lg p-4 space-y-4 max-h-[600px] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Filter Network</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-300">Search Papers</Label>
            <Input
              placeholder="Search by title..."
              value={localFilters.searchQuery || ''}
              onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
              className="bg-[#171717] border-[#2a2a2a] text-white h-8 text-sm"
            />
          </div>

          {/* Citation Range */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-300">
              Citations: {localFilters.minCitations || minCitations} - {localFilters.maxCitations || maxCitations}
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={localFilters.minCitations || ''}
                onChange={(e) => handleFilterChange('minCitations', e.target.value ? parseInt(e.target.value) : undefined)}
                className="bg-[#171717] border-[#2a2a2a] text-white h-8 text-sm"
              />
              <Input
                type="number"
                placeholder="Max"
                value={localFilters.maxCitations || ''}
                onChange={(e) => handleFilterChange('maxCitations', e.target.value ? parseInt(e.target.value) : undefined)}
                className="bg-[#171717] border-[#2a2a2a] text-white h-8 text-sm"
              />
            </div>
          </div>

          {/* Year Range */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-300">
              Year: {localFilters.minYear || minYear} - {localFilters.maxYear || maxYear}
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={localFilters.minYear || ''}
                onChange={(e) => handleFilterChange('minYear', e.target.value ? parseInt(e.target.value) : undefined)}
                className="bg-[#171717] border-[#2a2a2a] text-white h-8 text-sm"
              />
              <Input
                type="number"
                placeholder="Max"
                value={localFilters.maxYear || ''}
                onChange={(e) => handleFilterChange('maxYear', e.target.value ? parseInt(e.target.value) : undefined)}
                className="bg-[#171717] border-[#2a2a2a] text-white h-8 text-sm"
              />
            </div>
          </div>

          {/* Paper Types */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-300">Paper Types</Label>
            <div className="space-y-2">
              {(['root', 'citing', 'referenced', 'both'] as const).map(type => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`type-${type}`}
                    checked={localFilters.types?.includes(type) || false}
                    onCheckedChange={(checked) => {
                      const currentTypes = localFilters.types || []
                      const newTypes = checked
                        ? [...currentTypes, type]
                        : currentTypes.filter(t => t !== type)
                      handleFilterChange('types', newTypes.length > 0 ? newTypes : undefined)
                    }}
                  />
                  <Label htmlFor={`type-${type}`} className="text-xs text-gray-400 capitalize cursor-pointer">
                    {type}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Authors (if available) */}
          {uniqueAuthors.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-gray-300">Authors</Label>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {uniqueAuthors.map(author => (
                  <div key={author} className="flex items-center space-x-2">
                    <Checkbox
                      id={`author-${author}`}
                      checked={localFilters.authors?.includes(author) || false}
                      onCheckedChange={(checked) => {
                        const currentAuthors = localFilters.authors || []
                        const newAuthors = checked
                          ? [...currentAuthors, author]
                          : currentAuthors.filter(a => a !== author)
                        handleFilterChange('authors', newAuthors.length > 0 ? newAuthors : undefined)
                      }}
                    />
                    <Label htmlFor={`author-${author}`} className="text-xs text-gray-400 cursor-pointer truncate">
                      {author}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-[#2a2a2a]">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="flex-1 border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]"
            >
              Reset
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onApplyFilters()
                setIsOpen(false)
              }}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

