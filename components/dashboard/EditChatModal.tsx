'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Edit2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface EditChatModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateChat: (id: string, title: string) => Promise<void>
  chat: { id: string; title: string } | null
}

export function EditChatModal({ open, onOpenChange, onUpdateChat, chat }: EditChatModalProps) {
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (chat) {
      setTitle(chat.title)
    }
  }, [chat])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!chat) return

    if (!title.trim()) {
      setError('Chat title is required')
      return
    }

    setLoading(true)
    try {
      await onUpdateChat(chat.id, title.trim())
      setError('')
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message || 'Failed to update chat')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (chat) {
      setTitle(chat.title)
    }
    setError('')
    onOpenChange(false)
  }

  if (!chat) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Edit2 className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold">Edit Chat</DialogTitle>
              <DialogDescription className="text-sm text-gray-400 mt-1">
                Update your chat title to keep it organized
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive" className="bg-red-900/20 border-red-800">
              <AlertDescription className="text-red-400">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-chat-title" className="text-sm font-medium text-gray-300">
              Chat Title <span className="text-red-400">*</span>
            </Label>
            <Input
              id="edit-chat-title"
              type="text"
              placeholder="Enter chat title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setError('')
              }}
              required
              className="bg-[#171717] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500/20 h-11 text-base"
              autoFocus
            />
            <p className="text-xs text-gray-500">
              {title.length} character{title.length !== 1 ? 's' : ''}
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
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
              disabled={loading || !title.trim() || title.trim() === chat.title}
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Updating...
                </span>
              ) : (
                'Update Chat'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

