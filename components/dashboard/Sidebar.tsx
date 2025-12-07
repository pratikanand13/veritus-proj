'use client'

import { useState, useMemo } from 'react'
import { 
  Plus, 
  Search, 
  Folder, 
  MessageSquare,
  FileText,
  Edit2,
  Trash2,
  MoreHorizontal,
  Star,
  Clock,
  X,
  User,
  LogOut,
  Settings,
  Key,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Bookmark
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar'
import { CreateProjectModal } from './CreateProjectModal'
import { EditProjectModal } from './EditProjectModal'
import { EditChatModal } from './EditChatModal'
import { ProjectsSkeleton } from './ProjectsSkeleton'
import { ChatsSkeleton } from './ChatsSkeleton'
import { ProPlanCard } from './ProPlanCard'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'
import { ApiKeySettings } from './ApiKeySettings'
import { SearchSettings } from './SearchSettings'
import { BookmarksManagement } from './BookmarksManagement'

interface SidebarProps {
  projects: Array<{ id: string; name: string }>
  chats: Array<{ id: string; title: string; projectId: string; isFavorite?: boolean; updatedAt?: string }>
  onNewProject: (name: string, description?: string) => Promise<void>
  onSelectChat: (chatId: string) => void
  onSelectProject: (projectId: string) => Promise<void>
  onUpdateProject: (id: string, name: string, description?: string) => Promise<void>
  onUpdateChat: (id: string, title: string) => Promise<void>
  onToggleFavorite?: (chatId: string, isFavorite: boolean) => Promise<void>
  onDeleteProject: (id: string) => Promise<void>
  onDeleteChat: (id: string) => Promise<void>
  user: { name: string; email: string } | null
  selectedProject: string | null
  selectedChat: string | null
  loadingProjects?: boolean
  loadingChats?: boolean
}

export function Sidebar({
  projects,
  chats,
  onNewProject,
  onSelectChat,
  onSelectProject,
  onUpdateProject,
  onUpdateChat,
  onToggleFavorite,
  onDeleteProject,
  onDeleteChat,
  user,
  selectedProject,
  selectedChat,
  loadingProjects = false,
  loadingChats = false,
}: SidebarProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showEditProjectModal, setShowEditProjectModal] = useState(false)
  const [showEditChatModal, setShowEditChatModal] = useState(false)
  const [showApiKeySettings, setShowApiKeySettings] = useState(false)
  const [showSearchSettings, setShowSearchSettings] = useState(false)
  const [showBookmarksManagement, setShowBookmarksManagement] = useState(false)
  const [editingProject, setEditingProject] = useState<{ id: string; name: string; description?: string } | null>(null)
  const [editingChat, setEditingChat] = useState<{ id: string; title: string } | null>(null)

  // Filter and organize chats
  const { favoriteChats, recentChats, projectChats } = useMemo(() => {
    const favorites = chats.filter(chat => chat.isFavorite)
    const recent = [...chats]
      .sort((a, b) => {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return dateB - dateA
      })
      .slice(0, 10)
      .filter(chat => !chat.isFavorite) // Exclude favorites from recent
    
    const project = selectedProject 
      ? chats.filter(chat => chat.projectId === selectedProject && !chat.isFavorite)
      : []

    return {
      favoriteChats: favorites,
      recentChats: recent,
      projectChats: project,
    }
  }, [chats, selectedProject])

  // Filter chats by search query
  const filteredFavoriteChats = favoriteChats.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredRecentChats = recentChats.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredProjectChats = projectChats.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateProject = async (name: string, description?: string) => {
    await onNewProject(name, description)
    setShowProjectModal(false)
  }

  const handleEditProject = (project: { id: string; name: string; description?: string }) => {
    setEditingProject(project)
    setShowEditProjectModal(true)
  }

  const handleEditChat = (chat: { id: string; title: string }) => {
    setEditingChat(chat)
    setShowEditChatModal(true)
  }

  const handleDeleteProject = async (id: string) => {
    if (confirm('Are you sure you want to delete this project? All chats will be deleted.')) {
      await onDeleteProject(id)
    }
  }

  const handleDeleteChat = async (id: string) => {
    if (confirm('Are you sure you want to delete this chat?')) {
      await onDeleteChat(id)
    }
  }

  const handleToggleFavorite = async (chatId: string, currentFavorite: boolean) => {
    if (onToggleFavorite) {
      await onToggleFavorite(chatId, !currentFavorite)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const clearSearch = () => {
    setSearchQuery('')
  }

  return (
    <ShadcnSidebar collapsible="none" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex flex-col gap-3 px-2 py-2">
          {/* App Logo/Branding */}
          <div className="flex items-center gap-2 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">Research Hub</span>
              <span className="text-xs text-sidebar-foreground/70">Academic Papers</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <SidebarMenuButton
              onClick={() => setShowProjectModal(true)}
              className="flex-1"
              tooltip="Create new project"
            >
              <Folder className="h-4 w-4" />
              <span>New Project</span>
            </SidebarMenuButton>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-sidebar-foreground/50" />
            <Input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 h-9 bg-sidebar border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus-visible:ring-sidebar-ring"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-sidebar-accent"
              >
                <X className="h-3 w-3 text-sidebar-foreground/50" />
              </button>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Favorites Section */}
        {filteredFavoriteChats.length > 0 && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/70">Favorites</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredFavoriteChats.map((chat) => (
                    <SidebarMenuItem key={chat.id}>
                      <SidebarMenuButton
                        onClick={() => onSelectChat(chat.id)}
                        isActive={selectedChat === chat.id}
                        tooltip={chat.title}
                      >
                        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                        <span className="truncate">{chat.title}</span>
                      </SidebarMenuButton>
                      <div className="flex items-center gap-1">
                        <SidebarMenuAction
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleFavorite(chat.id, true)
                          }}
                          className="opacity-0 group-hover/menu-item:opacity-100 transition-opacity"
                        >
                          <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                        </SidebarMenuAction>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuAction className="opacity-0 group-hover/menu-item:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </SidebarMenuAction>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" align="start" className="w-48">
                            <DropdownMenuItem onClick={() => handleEditChat(chat)}>
                              <Edit2 className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleToggleFavorite(chat.id, true)}
                            >
                              <Star className="mr-2 h-4 w-4" />
                              Remove from Favorites
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteChat(chat.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator />
          </>
        )}

        {/* Recent Chats Section */}
        {filteredRecentChats.length > 0 && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/70">Recent</SidebarGroupLabel>
              <SidebarGroupContent>
                {loadingChats ? (
                  <SidebarMenu>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <SidebarMenuItem key={i}>
                        <SidebarMenuSkeleton />
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                ) : (
                  <SidebarMenu>
                    {filteredRecentChats.map((chat) => (
                      <SidebarMenuItem key={chat.id}>
                        <SidebarMenuButton
                          onClick={() => onSelectChat(chat.id)}
                          isActive={selectedChat === chat.id}
                          tooltip={chat.title}
                        >
                          <Clock className="h-4 w-4" />
                          <span className="truncate">{chat.title}</span>
                        </SidebarMenuButton>
                        <div className="flex items-center gap-1">
                          <SidebarMenuAction
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleFavorite(chat.id, false)
                            }}
                            className="opacity-0 group-hover/menu-item:opacity-100 transition-opacity"
                          >
                            <Star className="h-4 w-4" />
                          </SidebarMenuAction>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <SidebarMenuAction className="opacity-0 group-hover/menu-item:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-4 w-4" />
                              </SidebarMenuAction>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" align="start" className="w-48">
                              <DropdownMenuItem onClick={() => handleEditChat(chat)}>
                                <Edit2 className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleToggleFavorite(chat.id, false)}
                              >
                                <Star className="mr-2 h-4 w-4" />
                                Add to Favorites
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDeleteChat(chat.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                )}
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator />
          </>
        )}

        {/* Projects Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70">Projects</SidebarGroupLabel>
          <SidebarGroupAction
            onClick={() => setShowProjectModal(true)}
            title="Create new project"
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">New Project</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            {loadingProjects ? (
              <ProjectsSkeleton />
            ) : (
              <SidebarMenu>
                {projects.length === 0 ? (
                  <SidebarMenuItem>
                    <div className="px-2 py-3 text-sm text-sidebar-foreground/60 text-center">
                      <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No projects yet</p>
                      <p className="text-xs mt-1">Create your first project to get started</p>
                    </div>
                  </SidebarMenuItem>
                ) : (
                  projects.map((project) => (
                    <SidebarMenuItem key={project.id}>
                      <SidebarMenuButton
                        onClick={async () => {
                          await onSelectProject(project.id)
                        }}
                        isActive={selectedProject === project.id}
                        tooltip={project.name}
                      >
                        <Folder className="h-4 w-4" />
                        <span className="truncate">{project.name}</span>
                      </SidebarMenuButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuAction className="opacity-0 group-hover/menu-item:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </SidebarMenuAction>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start" className="w-48">
                          <DropdownMenuItem onClick={() => handleEditProject(project)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteProject(project.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Project Chats Section */}
        {selectedProject && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/70">
                {projects.find(p => p.id === selectedProject)?.name || 'Project'} Chats
              </SidebarGroupLabel>
              <SidebarGroupContent>
                {loadingChats ? (
                  <ChatsSkeleton />
                ) : (
                  <SidebarMenu>
                    {filteredProjectChats.length === 0 ? (
                      <SidebarMenuItem>
                        <div className="px-2 py-3 text-sm text-sidebar-foreground/60 text-center">
                          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>{searchQuery ? 'No chats found' : 'No chats yet'}</p>
                          {!searchQuery && (
                            <p className="text-xs mt-1">Create your first chat</p>
                          )}
                        </div>
                      </SidebarMenuItem>
                    ) : (
                      filteredProjectChats.map((chat) => (
                        <SidebarMenuItem key={chat.id}>
                          <SidebarMenuButton
                            onClick={() => onSelectChat(chat.id)}
                            isActive={selectedChat === chat.id}
                            tooltip={chat.title}
                          >
                            <MessageSquare className="h-4 w-4" />
                            <span className="truncate">{chat.title}</span>
                          </SidebarMenuButton>
                          <div className="flex items-center gap-1">
                            <SidebarMenuAction
                              onClick={(e) => {
                                e.stopPropagation()
                                handleToggleFavorite(chat.id, false)
                              }}
                              className="opacity-0 group-hover/menu-item:opacity-100 transition-opacity"
                            >
                              <Star className="h-4 w-4" />
                            </SidebarMenuAction>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <SidebarMenuAction className="opacity-0 group-hover/menu-item:opacity-100 transition-opacity">
                                  <MoreHorizontal className="h-4 w-4" />
                                </SidebarMenuAction>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent side="right" align="start" className="w-48">
                                <DropdownMenuItem onClick={() => handleEditChat(chat)}>
                                  <Edit2 className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleToggleFavorite(chat.id, false)}
                                >
                                  <Star className="mr-2 h-4 w-4" />
                                  Add to Favorites
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteChat(chat.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </SidebarMenuItem>
                      ))
                    )}
                  </SidebarMenu>
                )}
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {user && (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="w-full" tooltip={user.name}>
                    <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-sidebar-primary text-sidebar-primary-foreground">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium text-sidebar-foreground">{user.name}</span>
                      <span className="text-xs text-sidebar-foreground/70 truncate max-w-[140px]">{user.email}</span>
                    </div>
                    <ChevronUp className="ml-auto h-4 w-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" className="w-56">
                  <div className="p-2">
                    <div className="text-sm font-medium text-sidebar-foreground">{user.name}</div>
                    <div className="text-xs text-sidebar-foreground/70 truncate">{user.email}</div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => {
                    setShowSearchSettings(true)
                  }}>
                    <Settings className="mr-2 h-4 w-4" />
                    Search Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setShowApiKeySettings(true)
                  }}>
                    <Key className="mr-2 h-4 w-4" />
                    API Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setShowBookmarksManagement(true)
                  }}>
                    <Bookmark className="mr-2 h-4 w-4" />
                    Bookmarks
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>

      {/* Modals */}
      <CreateProjectModal
        open={showProjectModal}
        onOpenChange={setShowProjectModal}
        onCreateProject={handleCreateProject}
      />
      <EditProjectModal
        open={showEditProjectModal}
        onOpenChange={setShowEditProjectModal}
        onUpdateProject={onUpdateProject}
        project={editingProject}
      />
      <EditChatModal
        open={showEditChatModal}
        onOpenChange={setShowEditChatModal}
        onUpdateChat={onUpdateChat}
        chat={editingChat}
      />
      <ApiKeySettings
        open={showApiKeySettings}
        onOpenChange={setShowApiKeySettings}
      />
      <SearchSettings
        open={showSearchSettings}
        onOpenChange={setShowSearchSettings}
      />
      <BookmarksManagement
        open={showBookmarksManagement}
        onOpenChange={setShowBookmarksManagement}
      />
    </ShadcnSidebar>
  )
}
