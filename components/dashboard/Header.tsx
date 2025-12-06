'use client'

import { ArrowLeft, Folder } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  projectName?: string
  onBack: () => void
  user: { name: string; email: string } | null
}

export function Header({ projectName, onBack }: HeaderProps) {
  return (
    <div className="h-16 border-b border-sidebar-border bg-sidebar flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        {projectName && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="mr-4 text-sidebar-foreground/70 hover:text-green-400 hover:bg-sidebar-accent transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-sidebar-foreground/70" />
              <span className="text-sidebar-foreground font-medium">{projectName}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

