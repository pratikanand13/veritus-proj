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
      <div className="fixed inset-0 bg-black/80 transition-opacity" />
      <div onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

const DialogContent = ({ children, className }: DialogContentProps) => {
  return (
    <div
      className={cn(
        "rounded-md bg-card border border-border fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-3.5 p-5 shadow-lg sm:rounded-xl",
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

