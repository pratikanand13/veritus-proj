import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

interface DialogContentProps {
  children: React.ReactNode
  className?: string
}

const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => onOpenChange(false)}
    >
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity" />
      <div onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

const DialogContent = ({ children, className }: DialogContentProps) => {
  // Check if this is a large modal (full screen style) or flex layout
  const isLargeModal = className?.includes('max-w-[95vw]') || className?.includes('w-[95vw]')
  const isFlexLayout = className?.includes('flex flex-col') || className?.includes('flex-col') || className?.includes('flex-1')
  
  return (
    <div
      className={cn(
        "rounded-md bg-card border border-border fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] shadow-lg sm:rounded-xl",
        isLargeModal 
          ? "w-[95vw] h-[95vh] max-w-[95vw] max-h-[95vh] flex flex-col" 
          : isFlexLayout
          ? "flex flex-col w-full max-w-4xl"
          : "grid w-full max-w-lg gap-3.5 p-5",
        className
      )}
    >
      {children}
    </div>
  )
}

const DialogHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={cn("flex flex-col space-y-1 text-base", className)}>
      {children}
    </div>
  )
}

const DialogTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <h2 className={cn("text-[0.9rem] font-semibold leading-none tracking-tight", className)}>
      {children}
    </h2>
  )
}

const DialogDescription = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <p className={cn("text-sm text-gray-400", className)}>
      {children}
    </p>
  )
}

const DialogFooter = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}>
      {children}
    </div>
  )
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter }

