'use client'

import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkles } from 'lucide-react'

const MOTIVATIONAL_QUOTES = [
  "Great research takes time. We're finding the perfect papers for you...",
  "Exploring the academic landscape to discover relevant research...",
  "Every great discovery starts with a single search. We're on it!",
  "Connecting the dots between papers to find what matters most...",
  "Knowledge is power. We're gathering insights for you..."
]

interface SearchLoadingSkeletonProps {
  message?: string
}

export function SearchLoadingSkeleton({ message }: SearchLoadingSkeletonProps) {
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0)

  // Rotate quotes every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuoteIndex((prev) => (prev + 1) % MOTIVATIONAL_QUOTES.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-4 p-6">
      {/* Loading Header */}
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="h-6 w-6 text-[#FF6B35] animate-pulse" />
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {message || 'Searching for papers...'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {MOTIVATIONAL_QUOTES[currentQuoteIndex]}
          </p>
        </div>
      </div>

      {/* Skeleton Papers */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

