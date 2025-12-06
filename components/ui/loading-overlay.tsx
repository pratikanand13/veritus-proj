'use client'

import { Loader2 } from 'lucide-react'

interface LoadingOverlayProps {
  message?: string
  show: boolean
}

export function LoadingOverlay({ message = 'Loading...', show }: LoadingOverlayProps) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1f1f1f] border border-[#2a2a2a] rounded-lg p-6 shadow-xl flex flex-col items-center gap-4 min-w-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-white text-sm font-medium">{message}</p>
      </div>
    </div>
  )
}



