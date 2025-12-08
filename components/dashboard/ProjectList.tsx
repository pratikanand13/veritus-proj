'use client'

import { useState, useEffect } from 'react'
import { Folder, Plus, Trash2, Edit2, Sparkles, Search, MessageSquare, BookOpen, TrendingUp, ArrowRight, Bookmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { EditProjectModal } from './EditProjectModal'
import { CreateProjectModal } from './CreateProjectModal'

interface Project {
  id: string
  name: string
  description?: string
  createdAt: string
}

interface Chat {
  id: string
  title: string
  projectId: string
  isFavorite?: boolean
  updatedAt?: string
}

interface ProjectListProps {
  projects: Project[]
  chats?: Chat[]
  onSelectProject: (projectId: string) => void
  onNewProject?: (name: string, description?: string) => Promise<void>
  onUpdateProject: (id: string, name: string, description?: string) => Promise<void>
  onDeleteProject: (projectId: string) => void
}

export function ProjectList({
  projects,
  chats = [],
  onSelectProject,
  onNewProject,
  onUpdateProject,
  onDeleteProject,
}: ProjectListProps) {
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [bookmarkCount, setBookmarkCount] = useState(0)

  // Fetch bookmark count
  useEffect(() => {
    fetch('/api/bookmarks')
      .then(res => res.json())
      .then(data => {
        setBookmarkCount(data.bookmarks?.length || 0)
      })
      .catch(() => {})
  }, [])

  // Calculate recent chats (last 7 days)
  const recentChatsCount = chats.filter(chat => {
    if (!chat.updatedAt) return false
    const chatDate = new Date(chat.updatedAt)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return chatDate >= sevenDaysAgo
  }).length

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
    <div className="flex-1 flex flex-col min-h-screen bg-background pt-8 pb-8 pr-8">
      <div className="w-full space-y-8 pl-8 max-w-7xl">
        {/* Header Row: Your Projects heading and Create Project button */}
        <div className="flex items-center justify-between w-full">
          <div>
            <h2 className="text-3xl font-semibold text-foreground mb-2">Your Projects</h2>
            <p className="text-muted-foreground">Organize your research papers and conversations</p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 font-medium rounded-lg transition-all shadow-sm"
          >
            <Folder className="h-4 w-4 mr-2" />
            <Plus className="h-4 w-4 mr-1" />
            Create Project
          </Button>
        </div>

        {/* Stats Cards - Show when there are few projects */}
        {projects.length <= 10 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Total Projects Card */}
            <Card className="bg-card/50 border-primary/30 shadow-lg shadow-primary/5 group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
              <CardHeader className="pb-1.5 pt-3 px-3 relative z-10">
                <div className="flex items-center justify-between mb-1.5">
                  <CardTitle className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Projects</CardTitle>
                  <div className="p-1 rounded-md bg-primary/20">
                    <Folder className="h-3 w-3 text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0 relative z-10">
                <div className="text-2xl font-bold text-foreground mb-0.5">{projects.length}</div>
                <p className="text-[10px] text-muted-foreground leading-tight">Active research projects</p>
              </CardContent>
            </Card>

            {/* Total Chats Card */}
            <Card className="bg-card/50 border-primary/30 shadow-lg shadow-primary/5 group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
              <CardHeader className="pb-1.5 pt-3 px-3 relative z-10">
                <div className="flex items-center justify-between mb-1.5">
                  <CardTitle className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Chats</CardTitle>
                  <div className="p-1 rounded-md bg-primary/20">
                    <MessageSquare className="h-3 w-3 text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0 relative z-10">
                <div className="text-2xl font-bold text-foreground mb-0.5">{chats.length}</div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {recentChatsCount > 0 ? `${recentChatsCount} active this week` : 'Conversations created'}
                </p>
              </CardContent>
            </Card>

            {/* Bookmarked Papers Card */}
            <Card className="bg-card/50 border-primary/30 shadow-lg shadow-primary/5 group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
              <CardHeader className="pb-1.5 pt-3 px-3 relative z-10">
                <div className="flex items-center justify-between mb-1.5">
                  <CardTitle className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Bookmarked Papers</CardTitle>
                  <div className="p-1 rounded-md bg-primary/20">
                    <Bookmark className="h-3 w-3 text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0 relative z-10">
                <div className="text-2xl font-bold text-foreground mb-0.5">{bookmarkCount}</div>
                <p className="text-[10px] text-muted-foreground leading-tight">Saved for later</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Existing Projects */}
        {projects.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="group cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 bg-card border-border"
                  onClick={() => onSelectProject(project.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <Folder className="h-6 w-6 text-primary" />
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

        {/* Enhanced Empty State or Getting Started Guide */}
        {projects.length === 0 ? (
          <div className="space-y-8">
            {/* Welcome Section */}
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
                <Folder className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold text-foreground mb-2">Welcome to Research Hub</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Organize your academic research papers, explore citation networks, and discover related papers with AI-powered search.
              </p>
            </div>

            {/* Getting Started Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-card border-border hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Folder className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Create a Project</CardTitle>
                  </div>
                  <CardDescription>
                    Start by creating a project to organize your research papers by topic, field, or research area.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Create Your First Project
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card border-border hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Search className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Search Papers</CardTitle>
                  </div>
                  <CardDescription>
                    Use our advanced search to find academic papers by keywords, authors, titles, or TLDR summaries.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-2">Features:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Semantic search</li>
                      <li>Citation network visualization</li>
                      <li>AI-powered recommendations</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <MessageSquare className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Start Conversations</CardTitle>
                  </div>
                  <CardDescription>
                    Create chat threads to discuss papers, ask questions, and explore relationships between research papers.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-2">Capabilities:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Paper analysis</li>
                      <li>Citation exploration</li>
                      <li>Research insights</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Feature Highlights */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Key Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded bg-primary/10 mt-0.5">
                      <Search className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Advanced Paper Search</h4>
                      <p className="text-sm text-muted-foreground">
                        Find papers using semantic search, keywords, authors, or TLDR summaries with AI-powered matching.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded bg-primary/10 mt-0.5">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Citation Networks</h4>
                      <p className="text-sm text-muted-foreground">
                        Visualize and explore relationships between papers through interactive citation network graphs.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded bg-primary/10 mt-0.5">
                      <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">AI Conversations</h4>
                      <p className="text-sm text-muted-foreground">
                        Chat with AI about papers, get insights, and discover related research automatically.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded bg-primary/10 mt-0.5">
                      <Folder className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Project Organization</h4>
                      <p className="text-sm text-muted-foreground">
                        Organize your research by topics, fields, or projects for better management and collaboration.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : projects.length <= 3 && (
          /* Quick Tips for users with few projects */
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" />
                Quick Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <span className="text-xs font-semibold text-primary">1</span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium">Search for papers</p>
                    <p className="text-xs text-muted-foreground">Click on your project to start searching for academic papers</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <span className="text-xs font-semibold text-primary">2</span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium">Create chat threads</p>
                    <p className="text-xs text-muted-foreground">Click on paper titles to create conversations and explore citation networks</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <span className="text-xs font-semibold text-primary">3</span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium">Bookmark important papers</p>
                    <p className="text-xs text-muted-foreground">Save papers you want to reference later or receive email recommendations</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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
