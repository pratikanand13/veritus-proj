'use client'

import { useState } from 'react'
import { Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type SortOption = 'relevance' | 'citations' | 'year' | 'score' | 'publicationType' | 'authors'
export type SortOrder = 'asc' | 'desc'

export interface FilterState {
  publicationTypes?: string[]
  minScore?: number
  maxScore?: number
  minYear?: number
  maxYear?: number
  authors?: string[]
  minCitations?: number
  maxCitations?: number
}

interface CitationTreeFiltersProps {
  sortBy: SortOption
  sortOrder: SortOrder
  filters: FilterState
  availablePublicationTypes: string[]
  availableAuthors: string[]
  onSortChange: (sortBy: SortOption, sortOrder: SortOrder) => void
  onFiltersChange: (filters: FilterState) => void
  onClearFilters: () => void
}

export function CitationTreeFilters({
  sortBy,
  sortOrder,
  filters,
  availablePublicationTypes,
  availableAuthors,
  onSortChange,
  onFiltersChange,
  onClearFilters,
}: CitationTreeFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState<FilterState>(filters)

  const hasActiveFilters = 
    (localFilters.publicationTypes && localFilters.publicationTypes.length > 0) ||
    localFilters.minScore !== undefined ||
    localFilters.maxScore !== undefined ||
    localFilters.minYear !== undefined ||
    localFilters.maxYear !== undefined ||
    (localFilters.authors && localFilters.authors.length > 0) ||
    localFilters.minCitations !== undefined ||
    localFilters.maxCitations !== undefined

  const handleApplyFilters = () => {
    onFiltersChange(localFilters)
    setIsOpen(false)
  }

  const handleClearFilters = () => {
    const cleared: FilterState = {}
    setLocalFilters(cleared)
    onClearFilters()
    setIsOpen(false)
  }

  const togglePublicationType = (type: string) => {
    const current = localFilters.publicationTypes || []
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type]
    setLocalFilters({ ...localFilters, publicationTypes: updated })
  }

  const toggleAuthor = (author: string) => {
    const current = localFilters.authors || []
    const updated = current.includes(author)
      ? current.filter(a => a !== author)
      : [...current, author]
    setLocalFilters({ ...localFilters, authors: updated })
  }

  return (
    <div className="space-y-3">
      {/* Sort Controls */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">Sort by:</span>
        <Select
          value={sortBy}
          onValueChange={(value) => onSortChange(value as SortOption, sortOrder)}
        >
          <SelectTrigger className="w-[180px] bg-[#171717] border-[#2a2a2a] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1f1f1f] border-[#2a2a2a]">
            <SelectItem value="relevance">Relevance</SelectItem>
            <SelectItem value="citations">Citations</SelectItem>
            <SelectItem value="year">Year</SelectItem>
            <SelectItem value="score">Score</SelectItem>
            <SelectItem value="publicationType">Publication Type</SelectItem>
            <SelectItem value="authors">Authors</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sortOrder}
          onValueChange={(value) => onSortChange(sortBy, value as SortOrder)}
        >
          <SelectTrigger className="w-[120px] bg-[#171717] border-[#2a2a2a] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1f1f1f] border-[#2a2a2a]">
            <SelectItem value="asc">Ascending</SelectItem>
            <SelectItem value="desc">Descending</SelectItem>
          </SelectContent>
        </Select>

        {/* Filter Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className={`border-[#2a2a2a] text-gray-300 ${hasActiveFilters ? 'bg-green-500/20 border-green-500/50' : ''}`}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {hasActiveFilters && (
            <Badge className="ml-2 bg-green-500/20 text-green-300 border-green-500/50">
              {[
                localFilters.publicationTypes?.length || 0,
                localFilters.authors?.length || 0,
                localFilters.minScore !== undefined ? 1 : 0,
                localFilters.maxScore !== undefined ? 1 : 0,
                localFilters.minYear !== undefined ? 1 : 0,
                localFilters.maxYear !== undefined ? 1 : 0,
                localFilters.minCitations !== undefined ? 1 : 0,
                localFilters.maxCitations !== undefined ? 1 : 0,
              ].reduce((a, b) => a + b, 0)}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filter Panel */}
      {isOpen && (
        <Card className="bg-[#1f1f1f] border-[#2a2a2a]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-white flex items-center justify-between">
              <span>Filters</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 text-gray-400"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Publication Type */}
            {availablePublicationTypes.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 mb-2">Publication Type</div>
                <div className="flex flex-wrap gap-2">
                  {availablePublicationTypes.map((type) => (
                    <Badge
                      key={type}
                      variant="outline"
                      className={`cursor-pointer text-xs ${
                        localFilters.publicationTypes?.includes(type)
                          ? 'bg-green-500/20 border-green-500/50 text-green-300'
                          : 'border-[#2a2a2a] text-gray-400 hover:border-gray-500'
                      }`}
                      onClick={() => togglePublicationType(type)}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Score Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-400 mb-1">Min Score</div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={localFilters.minScore ?? ''}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      minScore: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  className="bg-[#171717] border-[#2a2a2a] text-white"
                  placeholder="0.0"
                />
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Max Score</div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={localFilters.maxScore ?? ''}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      maxScore: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  className="bg-[#171717] border-[#2a2a2a] text-white"
                  placeholder="1.0"
                />
              </div>
            </div>

            {/* Year Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-400 mb-1">Min Year</div>
                <Input
                  type="number"
                  min="1900"
                  max={new Date().getFullYear()}
                  value={localFilters.minYear ?? ''}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      minYear: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  className="bg-[#171717] border-[#2a2a2a] text-white"
                  placeholder="1900"
                />
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Max Year</div>
                <Input
                  type="number"
                  min="1900"
                  max={new Date().getFullYear()}
                  value={localFilters.maxYear ?? ''}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      maxYear: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  className="bg-[#171717] border-[#2a2a2a] text-white"
                  placeholder={new Date().getFullYear().toString()}
                />
              </div>
            </div>

            {/* Citations Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-400 mb-1">Min Citations</div>
                <Input
                  type="number"
                  min="0"
                  value={localFilters.minCitations ?? ''}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      minCitations: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  className="bg-[#171717] border-[#2a2a2a] text-white"
                  placeholder="0"
                />
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Max Citations</div>
                <Input
                  type="number"
                  min="0"
                  value={localFilters.maxCitations ?? ''}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      maxCitations: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  className="bg-[#171717] border-[#2a2a2a] text-white"
                  placeholder="∞"
                />
              </div>
            </div>

            {/* Authors */}
            {availableAuthors.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 mb-2">Authors</div>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {availableAuthors.slice(0, 20).map((author) => (
                    <Badge
                      key={author}
                      variant="outline"
                      className={`cursor-pointer text-xs ${
                        localFilters.authors?.includes(author)
                          ? 'bg-green-500/20 border-green-500/50 text-green-300'
                          : 'border-[#2a2a2a] text-gray-400 hover:border-gray-500'
                      }`}
                      onClick={() => toggleAuthor(author)}
                    >
                      {author}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-[#2a2a2a]">
              <Button
                onClick={handleApplyFilters}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                Apply Filters
              </Button>
              <Button
                onClick={handleClearFilters}
                variant="outline"
                className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]"
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

