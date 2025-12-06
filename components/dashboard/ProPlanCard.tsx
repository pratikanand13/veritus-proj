'use client'

import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'

export function ProPlanCard() {
  return (
    <div className="mx-2 mb-2 p-4 rounded-lg bg-gradient-to-br from-[#FF6B35]/20 to-[#FF8555]/10 border border-[#FF6B35]/30">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FF6B35] text-white flex-shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white mb-1">
            Strengthen artificial intelligence: get plan!
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-lg font-bold text-[#FF6B35]">$10/mo</span>
            <Button 
              size="sm" 
              className="bg-[#FF6B35] hover:bg-[#FF8555] text-white h-8 px-4 text-xs font-medium"
            >
              Get
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

