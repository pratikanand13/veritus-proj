'use client'

import { ExternalLink } from 'lucide-react'

export function PoweredByVeritus() {
  return (
    <a
      href="https://veritus.ai"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full border border-border bg-card/80 backdrop-blur-sm px-3 py-1.5 text-xs text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground hover:border-primary/50"
      title="Visit Veritus.ai"
    >
      <span>Powered by</span>
      <span className="font-semibold text-primary">Veritus</span>
      <ExternalLink className="h-3 w-3" />
    </a>
  )
}

