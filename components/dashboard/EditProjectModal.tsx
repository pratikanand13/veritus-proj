'use client'

import { useState, useEffect } from 'react'
import { Folder } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface EditProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateProject: (id: string, name: string, description?: string) => Promise<void>
  project: { id: string; name: string; description?: string } | null
}

export function EditProjectModal({ open, onOpenChange, onUpdateProject, project }: EditProjectModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (project) {
      setName(project.name)
      setDescription(project.description || '')
    }
  }, [project])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!project) return

    if (!name.trim()) {
      setError('Project name is required')
      return
    }

    setLoading(true)
    try {
      await onUpdateProject(project.id, name.trim(), description.trim())
      setError('')
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message || 'Failed to update project')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (project) {
      setName(project.name)
      setDescription(project.description || '')
    }
    setError('')
    onOpenChange(false)
  }

  if (!project) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-gray-400" />
            <DialogTitle>Edit Project</DialogTitle>
          </div>
          <DialogDescription>
            Update project details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="p-6 pt-0 space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="edit-project-name" className="text-sm font-medium text-gray-300">
                Project Name *
              </label>
              <Input
                id="edit-project-name"
                type="text"
                placeholder="Enter project name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError('')
                }}
                required
                className="bg-[#171717] border-[#2a2a2a] text-white placeholder:text-gray-500"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-project-description" className="text-sm font-medium text-gray-300">
                Description (Optional)
              </label>
              <Input
                id="edit-project-description"
                type="text"
                placeholder="Enter project description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-[#171717] border-[#2a2a2a] text-white placeholder:text-gray-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-[#2a2a2a] text-gray-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white"
            >
              {loading ? 'Updating...' : 'Update Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

