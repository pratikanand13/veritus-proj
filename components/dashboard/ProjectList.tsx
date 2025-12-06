'use client'

import { useState } from 'react'
import { Folder, Trash2, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EditProjectModal } from './EditProjectModal'

interface Project {
  id: string
  name: string
  description?: string
  createdAt: string
}

interface ProjectListProps {
  projects: Project[]
  onSelectProject: (projectId: string) => void
  onUpdateProject: (id: string, name: string, description?: string) => Promise<void>
  onDeleteProject: (projectId: string) => void
}

export function ProjectList({
  projects,
  onSelectProject,
  onUpdateProject,
  onDeleteProject,
}: ProjectListProps) {
  const [showEditModal, setShowEditModal] = useState(false)
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
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Projects</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Folder className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No projects yet. Create your first project!</p>
          </div>
        ) : (
          projects.map((project) => (
            <Card
              key={project.id}
              className="group bg-[#1f1f1f] border-[#2a2a2a] hover:border-[#3a3a3a] cursor-pointer transition-colors"
              onClick={() => onSelectProject(project.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <Folder className="h-5 w-5 text-gray-400" />
                    <CardTitle className="text-white">{project.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleEdit(e, project)}
                      className="h-8 w-8 text-gray-400 hover:text-white hover:bg-[#2a2a2a]"
                      title="Edit project"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDelete(e, project.id)}
                      className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-[#2a2a2a]"
                      title="Delete project"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {project.description && (
                  <CardDescription className="text-gray-400">
                    {project.description}
                  </CardDescription>
                )}
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      <EditProjectModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        onUpdateProject={handleUpdate}
        project={editingProject}
      />
    </div>
  )
}

