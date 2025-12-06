'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SearchSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DEFAULT_DEPTH = 100
const DEPTH_STORAGE_KEY = 'paper_search_depth'

export function SearchSettings({ open, onOpenChange }: SearchSettingsProps) {
  const [depth, setDepth] = useState(DEFAULT_DEPTH)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      // Load depth from localStorage
      const savedDepth = localStorage.getItem(DEPTH_STORAGE_KEY)
      if (savedDepth) {
        const parsedDepth = parseInt(savedDepth, 10)
        if (!isNaN(parsedDepth) && parsedDepth > 0) {
          setDepth(parsedDepth)
        }
      }
    }
  }, [open])

  const handleSave = () => {
    const depthValue = Math.max(1, Math.min(500, depth)) // Clamp between 1 and 500
    localStorage.setItem(DEPTH_STORAGE_KEY, depthValue.toString())
    setDepth(depthValue)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1f1f1f] border-[#2a2a2a] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Search Settings</DialogTitle>
          <DialogDescription className="text-gray-400">
            Configure default settings for paper searches
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="depth" className="text-sm font-medium text-gray-300 block">
              Default Depth (Number of similar papers)
            </label>
            <Input
              id="depth"
              type="number"
              min="1"
              max="500"
              value={depth}
              onChange={(e) => setDepth(parseInt(e.target.value) || DEFAULT_DEPTH)}
              className="bg-[#171717] border-[#2a2a2a] text-white"
            />
            <p className="text-xs text-gray-500">
              This depth will be used automatically when searching for papers. Range: 1-500
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[#2a2a2a] text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Helper function to get depth from localStorage
export function getSearchDepth(): number {
  if (typeof window === 'undefined') return DEFAULT_DEPTH
  const savedDepth = localStorage.getItem(DEPTH_STORAGE_KEY)
  if (savedDepth) {
    const parsedDepth = parseInt(savedDepth, 10)
    if (!isNaN(parsedDepth) && parsedDepth > 0) {
      return Math.min(500, Math.max(1, parsedDepth))
    }
  }
  return DEFAULT_DEPTH
}

