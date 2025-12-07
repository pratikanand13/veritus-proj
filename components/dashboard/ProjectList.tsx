'use client'

import { useState } from 'react'
import { Folder, Plus, Trash2, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EditProjectModal } from './EditProjectModal'
import { CreateProjectModal } from './CreateProjectModal'

interface Project {
  id: string
  name: string
  description?: string
  createdAt: string
}

interface ProjectListProps {
  projects: Project[]
  onSelectProject: (projectId: string) => void
  onNewProject?: (name: string, description?: string) => Promise<void>
  onUpdateProject: (id: string, name: string, description?: string) => Promise<void>
  onDeleteProject: (projectId: string) => void
}

export function ProjectList({
  projects,
  onSelectProject,
  onNewProject,
  onUpdateProject,
  onDeleteProject,
}: ProjectListProps) {
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const handleEdit = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation()
    setEditingProject(project)
    setShowEditModal(true)
  }

  const handleDelete = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this project? All chats will be deleted.')) {
      onDeleteProject(projectId)
    }
  }

  const handleUpdate = async (id: string, name: string, description?: string) => {
    await onUpdateProject(id, name, description)
    setShowEditModal(false)
    setEditingProject(null)
  }

  const handleCreate = async (name: string, description?: string) => {
    if (onNewProject) {
      await onNewProject(name, description)
    }
    setShowCreateModal(false)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background p-8">
      <div className="w-full max-w-4xl space-y-8">
        {/* Create Project Button */}
        <div className="flex justify-center">
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#22c55e] hover:bg-[#16a34a] text-white px-8 py-6 text-lg font-semibold rounded-lg shadow-lg transition-all hover:shadow-xl"
            size="lg"
          >
            <Folder className="h-6 w-6 mr-3" />
            <Plus className="h-6 w-6 mr-2" />
            Create Project
          </Button>
        </div>

        {/* Existing Projects */}
        {projects.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground text-center mb-6">Your Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="group cursor-pointer transition-all hover:shadow-md bg-card border-border"
                  onClick={() => onSelectProject(project.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <Folder className="h-6 w-6 text-[#22c55e]" />
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-foreground text-base truncate">{project.name}</CardTitle>
                          {project.description && (
                            <CardDescription className="mt-1 line-clamp-2">
                              {project.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleEdit(e, project)}
                          className="h-8 w-8"
                          title="Edit project"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleDelete(e, project.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Delete project"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {projects.length === 0 && (
          <div className="text-center py-12">
            <Folder className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground text-lg">No projects yet</p>
            <p className="text-muted-foreground/70 text-sm mt-2">Create your first project to get started</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateProjectModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onCreateProject={handleCreate}
      />
      <EditProjectModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        onUpdateProject={handleUpdate}
        project={editingProject}
      />
    </div>
  )
}
