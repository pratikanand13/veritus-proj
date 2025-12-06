'use client'

import { ArrowLeft, Folder } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'

interface HeaderProps {
  projectName?: string
  onBack: () => void
  user: { name: string; email: string } | null
}

export function Header({ projectName, onBack }: HeaderProps) {
  return (
    <div className="h-16 border-b border-sidebar-border bg-sidebar flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        {projectName && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="mr-4 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
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

