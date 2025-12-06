'use client'

import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'

export function ProPlanCard() {
  return (
    <div className="mx-2 mb-2 p-4 rounded-xl bg-card border border-border shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-primary text-primary-foreground flex-shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-card-foreground mb-1">
            Strengthen artificial intelligence: get plan!
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-base font-bold text-primary">$10/mo</span>
            <Button 
              size="sm" 
              className="h-8 px-3 text-xs"
            >
              Get
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

