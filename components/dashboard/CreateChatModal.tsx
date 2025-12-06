'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface CreateChatModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateChat: (title: string) => void
  projectName?: string
  projectId?: string | null
}

export function CreateChatModal({ open, onOpenChange, onCreateChat, projectName, projectId }: CreateChatModalProps) {
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!title.trim()) {
      setError('Chat title is required')
      return
    }

    setLoading(true)
    try {
      await onCreateChat(title.trim())
      setTitle('')
      setError('')
      onOpenChange(false)
      // Chat will be automatically selected by parent component
    } catch (err: any) {
      setError(err.message || 'Failed to create chat')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setTitle('')
    setError('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#2a2a2a]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <Plus className="h-5 w-5 text-green-400" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-xl font-semibold text-white">Create New Chat</DialogTitle>
                <DialogDescription className="text-sm text-gray-400 mt-1">
                  {projectName ? `Create a new chat in "${projectName}"` : 'Start a new conversation'}
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded-md"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <Tabs defaultValue="general" className="w-full">
          <div className="px-6 pt-4">
            <TabsList className="grid w-full grid-cols-2 bg-[#171717] border border-[#2a2a2a] h-10">
              <TabsTrigger 
                value="general" 
                className="data-[state=active]:bg-[#2a2a2a] data-[state=active]:text-white text-gray-400 data-[state=active]:shadow-none rounded-sm"
              >
                General
              </TabsTrigger>
              <TabsTrigger 
                value="advanced" 
                className="data-[state=active]:bg-[#2a2a2a] data-[state=active]:text-white text-gray-400 data-[state=active]:shadow-none rounded-sm"
              >
                Advanced
              </TabsTrigger>
            </TabsList>
          </div>

          {/* General Tab Content */}
          <TabsContent value="general" className="px-6 pb-6 mt-4 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-900/20 border-red-800">
                  <AlertDescription className="text-red-400">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="chat-title" className="text-sm font-medium text-gray-300">
                  Chat Title <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="chat-title"
                  type="text"
                  placeholder="Enter chat title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    setError('')
                  }}
                  required
                  className="bg-[#171717] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500/20 h-11 text-base"
                  autoFocus
                />
                <p className="text-xs text-gray-500">
                  {title.length} character{title.length !== 1 ? 's' : ''}
                </p>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={loading}
                  className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a] hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !title.trim()}
                  className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    'Create Chat'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* Advanced Tab Content */}
          <TabsContent value="advanced" className="px-6 pb-6 mt-4 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-900/20 border-red-800">
                  <AlertDescription className="text-red-400">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="chat-title-advanced" className="text-sm font-medium text-gray-300">
                  Chat Title <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="chat-title-advanced"
                  type="text"
                  placeholder="Enter chat title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    setError('')
                  }}
                  required
                  className="bg-[#171717] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500/20 h-11 text-base"
                />
                <p className="text-xs text-gray-500">
                  {title.length} character{title.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">
                  Additional Options
                </Label>
                <p className="text-xs text-gray-500">
                  More options coming soon...
                </p>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={loading}
                  className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a] hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !title.trim()}
                  className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    'Create Chat'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

