'use client'

import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VeritusPaper } from '@/types/veritus'

interface PaperSearchBarProps {
  onSearchResults: (papers: VeritusPaper[]) => void
  onError: (error: string) => void
}

export function PaperSearchBar({ onSearchResults, onError }: PaperSearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setLoading(true)
    onError('')

    try {
      const searchUrl = new URL('/api/v1/papers/search', window.location.origin)
      searchUrl.searchParams.set('title', searchQuery.trim())
      const response = await fetch(searchUrl.toString())
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to search papers')
      }

      const data = await response.json()
      // New API returns { paper, ... } for single result, wrap in array
      onSearchResults(data.paper ? [data.paper] : data.papers || [])
    } catch (error: any) {
      console.error('Search error:', error)
      onError(error.message || 'Failed to search papers. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSearch} className="flex gap-2">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search papers by title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={loading}
          className="pl-9 bg-[#1f1f1f] border-[#2a2a2a] text-white placeholder:text-gray-500"
        />
      </div>
      <Button
        type="submit"
        disabled={loading || !searchQuery.trim()}
        className="bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Searching...
          </>
        ) : (
          <>
            <Search className="mr-2 h-4 w-4" />
            Search
          </>
        )}
      </Button>
    </form>
  )
}

