'use client'

import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface HistoryItem {
  id: string
  title: string
  preview: string
  category?: string
  checked?: boolean
}

interface HistorySidebarProps {
  items?: HistoryItem[]
  onItemClick?: (itemId: string) => void
  onClearHistory?: () => void
}

export function HistorySidebar({ items = [], onItemClick, onClearHistory }: HistorySidebarProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  // Group items by category if they have categories
  const groupedItems = items.reduce((acc, item) => {
    const category = item.category || 'General'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(item)
    return acc
  }, {} as Record<string, HistoryItem[]>)

  return (
    <div className="h-full w-full border-l border-sidebar-border bg-[#1f1f1f] flex flex-col">
      {/* Header */}
      <div className="border-b border-sidebar-border p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-sidebar-foreground font-semibold">
            History
          </span>
          <span className="text-xs text-sidebar-foreground/60">
            {items.length}/50
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-2 space-y-4">
            {Object.entries(groupedItems).map(([category, categoryItems], categoryIndex) => (
              <div key={category}>
                {categoryIndex > 0 && (
                  <div className="flex items-center gap-2 my-4">
                    <div className="flex-1 h-px bg-sidebar-border"></div>
                    <div className="flex gap-1">
                      <div className="w-1 h-1 rounded-full bg-sidebar-foreground/40"></div>
                      <div className="w-1 h-1 rounded-full bg-sidebar-foreground/40"></div>
                    </div>
                    <div className="flex-1 h-px bg-sidebar-border"></div>
                  </div>
                )}
                
                {categoryItems.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                      "hover:bg-sidebar-accent",
                      selectedItems.has(item.id) && "bg-sidebar-accent"
                    )}
                    onClick={() => {
                      toggleItem(item.id)
                      onItemClick?.(item.id)
                    }}
                  >
                    <div className="mt-0.5">
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                          selectedItems.has(item.id) || item.checked
                            ? "bg-[#FF6B35] border-[#FF6B35]"
                            : "border-sidebar-border hover:border-[#FF6B35]/50"
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleItem(item.id)
                        }}
                      >
                        {(selectedItems.has(item.id) || item.checked) && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {item.category && (
                        <div className="text-xs text-sidebar-foreground/60 mb-1">
                          {item.category}
                        </div>
                      )}
                      <div className="text-sm font-medium text-sidebar-foreground mb-1">
                        {item.title}
                      </div>
                      <div className="text-xs text-sidebar-foreground/60 line-clamp-2">
                        {item.preview}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            
            {items.length === 0 && (
              <div className="text-center py-12 text-sidebar-foreground/60">
                <p className="text-sm">No history yet</p>
                <p className="text-xs mt-1">Your chat history will appear here</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      
      {/* Footer */}
      {items.length > 0 && (
        <div className="border-t border-sidebar-border p-4 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearHistory}
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear history
          </Button>
        </div>
      )}
    </div>
  )
}
