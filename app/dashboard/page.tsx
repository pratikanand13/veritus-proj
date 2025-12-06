'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { ProjectList } from '@/components/dashboard/ProjectList'
import { ChatInterface } from '@/components/dashboard/ChatInterface'
import { Header } from '@/components/dashboard/Header'
import { PaperSearchPage } from '@/components/dashboard/PaperSearchPage'
import { shouldUseMockData } from '@/lib/config/mock-config'

interface User {
  id: string
  email: string
  name: string
  areaOfInterest: string
  isAcademic: boolean
}

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
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>
  depth?: number
  isFavorite?: boolean
  createdAt: string
  updatedAt: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [chats, setChats] = useState<Chat[]>([])
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [currentMessages, setCurrentMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>>([])
  const [currentChatDepth, setCurrentChatDepth] = useState<number>(100)
  const [loading, setLoading] = useState(true)
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingChats, setLoadingChats] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  
  // Determine if mock mode should be used (configurable via environment or defaults)
  const useMock = shouldUseMockData()

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadProjects()
      loadChats()
    }
  }, [user])

  useEffect(() => {
    if (selectedChat) {
      loadChatMessages(selectedChat)
    } else {
      setCurrentMessages([])
    }
  }, [selectedChat])

  // Listen for chat messages updated events
  useEffect(() => {
    const handleChatMessagesUpdated = (event: CustomEvent) => {
      if (event.detail.chatId === selectedChat && selectedChat) {
        loadChatMessages(selectedChat)
      }
    }

    window.addEventListener('chat-messages-updated', handleChatMessagesUpdated as EventListener)
    return () => {
      window.removeEventListener('chat-messages-updated', handleChatMessagesUpdated as EventListener)
    }
  }, [selectedChat])

  const loadUser = async () => {
    try {
      const response = await fetch('/api/auth/verify')
      if (!response.ok) {
        router.push('/login')
        return
      }
      const data = await response.json()
      setUser(data.user)
    } catch (error) {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const loadProjects = async () => {
    setLoadingProjects(true)
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        // Ensure all projects have id field
        const projectsWithIds = data.projects.map((p: any) => ({
          id: p.id || p._id?.toString(),
          name: p.name,
          description: p.description,
          createdAt: p.createdAt,
        }))
        setProjects(projectsWithIds)
      }
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoadingProjects(false)
    }
  }

  const loadChats = async (projectId?: string | null) => {
    setLoadingChats(true)
    try {
      // Always load all chats for sidebar organization (favorites, recent, etc.)
      const response = await fetch('/api/chats')
      if (response.ok) {
        const data = await response.json()
        // Transform chats to include isFavorite and updatedAt
        const transformedChats = data.chats.map((chat: any) => ({
          ...chat,
          isFavorite: chat.isFavorite || false,
          updatedAt: chat.updatedAt || chat.createdAt,
        }))
        setChats(transformedChats)
      }
    } catch (error) {
      console.error('Error loading chats:', error)
    } finally {
      setLoadingChats(false)
    }
  }

  const loadChatMessages = async (chatId: string) => {
    setLoadingMessages(true)
    try {
      const response = await fetch(`/api/chats/${chatId}`)
      if (response.ok) {
        const data = await response.json()
        setCurrentMessages(data.chat.messages || [])
        setCurrentChatDepth(data.chat.depth || 100)
      }
    } catch (error) {
      console.error('Error loading chat messages:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  const handleCreateProject = async (name: string, description?: string) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })
      if (response.ok) {
        const data = await response.json()
        await loadProjects()
        // Auto-select the newly created project
        setSelectedProject(data.project.id)
        await loadChats(data.project.id)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create project')
      }
    } catch (error) {
      console.error('Error creating project:', error)
      throw error
    }
  }

  const handleUpdateProject = async (id: string, name: string, description?: string) => {
    try {
      // Validate project ID
      if (!id || id.trim().length === 0) {
        throw new Error('Project ID is required')
      }

      console.log('Updating project with ID:', id)
      
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })
      
      if (response.ok) {
        await loadProjects()
      } else {
        const errorData = await response.json()
        console.error('Update project error response:', errorData)
        throw new Error(errorData.error || 'Failed to update project')
      }
    } catch (error: any) {
      console.error('Error updating project:', error)
      throw error
    }
  }

  const handleUpdateChat = async (id: string, title: string) => {
    try {
      const response = await fetch(`/api/chats/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (response.ok) {
        await loadChats(selectedProject || undefined)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update chat')
      }
    } catch (error) {
      console.error('Error updating chat:', error)
      throw error
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        await loadProjects()
        setChats(chats.filter(chat => chat.projectId !== projectId))
        if (selectedProject === projectId) {
          setSelectedProject(null)
          setSelectedChat(null)
        }
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete project')
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      throw error
    }
  }

  const handleCreateChat = async (title: string) => {
    // Use the currently selected project from state
    let projectId = selectedProject
    
    // If no project selected, try to use first available project
    if (!projectId) {
      if (projects.length > 0) {
        projectId = projects[0].id
        setSelectedProject(projectId)
        await loadChats(projectId)
      } else {
        throw new Error('Please create a project first')
      }
    }
    
    // Validate projectId
    if (!projectId || projectId.trim().length === 0) {
      throw new Error('Project ID is required. Please select a project first.')
    }

    console.log('Creating chat with projectId:', projectId, 'title:', title)
    
    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, title }),
      })
      
      if (response.ok) {
        const data = await response.json()
        await loadChats(projectId)
        // Automatically select the newly created chat and load its messages
        setSelectedChat(data.chat.id)
        await loadChatMessages(data.chat.id)
      } else {
        const errorData = await response.json()
        console.error('Create chat error response:', errorData)
        throw new Error(errorData.error || 'Failed to create chat')
      }
    } catch (error: any) {
      console.error('Error creating chat:', error)
      throw error
    }
  }

  const handleDeleteChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        await loadChats(selectedProject || undefined)
        if (selectedChat === chatId) {
          setSelectedChat(null)
        }
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete chat')
      }
    } catch (error) {
      console.error('Error deleting chat:', error)
      throw error
    }
  }

  const handleAddAssistantMessage = async (content: string, papers?: any[], networkData?: any) => {
    if (!selectedChat) return

    const newMessage: any = {
      role: 'assistant' as const,
      content,
      timestamp: new Date(),
    }

    if (papers) {
      newMessage.papers = papers
    }
    if (networkData) {
      newMessage.citationNetwork = networkData
    }

    const updatedMessages = [...currentMessages, newMessage]
    setCurrentMessages(updatedMessages)

    try {
      const response = await fetch(`/api/chats/${selectedChat}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
        }),
      })
      if (!response.ok) {
        console.error('Failed to save assistant message')
      }
    } catch (error) {
      console.error('Error saving assistant message:', error)
    }
  }

  const handleSendMessage = async (content: string, papers?: any[], networkData?: any) => {
    if (!selectedChat) return

    const newMessage: any = {
      role: 'user' as const,
      content,
      timestamp: new Date(),
    }

    if (papers) {
      newMessage.papers = papers
    }
    if (networkData) {
      newMessage.citationNetwork = networkData
    }

    setCurrentMessages([...currentMessages, newMessage])

    try {
      const response = await fetch(`/api/chats/${selectedChat}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...currentMessages, newMessage],
        }),
      })

      if (response.ok) {
        // If network data is present, save it to analytical tree
        if (networkData && papers) {
          try {
            const networkId = `network-${Date.now()}`
            const citationNetwork = {
              nodes: papers.map(paper => ({
                id: paper.id,
                paper,
              })),
              edges: networkData.edges || [],
              metadata: {
                createdAt: new Date(),
                paperIds: papers.map(p => p.id),
              },
            }
            
            const saveResponse = await fetch(`/api/chats/${selectedChat}/citation-network`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                networkId,
                citationNetwork,
              }),
            })
            
            if (!saveResponse.ok) {
              console.error('Failed to save citation network')
            }
          } catch (error) {
            console.error('Error saving network data:', error)
          }
        }

        // Check if this looks like a paper search query and call the API
        const isSearchQuery = content.length > 5 && !networkData && !papers
        
        if (isSearchQuery) {
          try {
            // Call paper search API
            const searchResponse = await fetch('/api/paper/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: content,
                chatId: selectedChat,
                isMocked: useMock, // Use configurable mock mode
              }),
            })

            if (searchResponse.ok) {
              const searchData = await searchResponse.json()
              
              // Add assistant message with search results
              const assistantMessage = {
                role: 'assistant' as const,
                content: `Found paper: ${searchData.paper.title}\n\nAuthors: ${searchData.paper.authors}\nYear: ${searchData.paper.year || 'N/A'}\nCitations: ${searchData.paper.impactFactor?.citationCount || 0}\n\n${searchData.paper.abstract || searchData.paper.tldr || ''}`,
                timestamp: new Date(),
                papers: [searchData.paper],
              }
              
              setCurrentMessages(prev => [...prev, assistantMessage])
              
              // Update chat with assistant message
              await fetch(`/api/chats/${selectedChat}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  messages: [...currentMessages, newMessage, assistantMessage],
                }),
              })
              
              // Automatically call corpus API after search succeeds
              if (searchData.paper?.id) {
                try {
                  const depth = currentChatDepth
                  const corpusResponse = await fetch('/api/paper/corpus', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      corpusId: searchData.paper.id,
                      depth: depth,
                      chatId: selectedChat,
                      isMocked: useMock,
                    }),
                  })

                  if (corpusResponse.ok) {
                    const corpusData = await corpusResponse.json()
                    
                    // Add corpus results as another assistant message
                    const corpusMessage = {
                      role: 'assistant' as const,
                      content: `Found ${corpusData.similarPapers.length} similar papers:\n\n${corpusData.similarPapers.slice(0, 5).map((p: any, idx: number) => `${idx + 1}. ${p.title} (${p.year || 'N/A'}) - ${p.impactFactor?.citationCount || 0} citations`).join('\n')}${corpusData.similarPapers.length > 5 ? `\n\n... and ${corpusData.similarPapers.length - 5} more papers` : ''}`,
                      timestamp: new Date(),
                      papers: [corpusData.paper, ...corpusData.similarPapers],
                    }
                    
                    const updatedMessagesWithCorpus = [...currentMessages, corpusMessage]
                    setCurrentMessages(updatedMessagesWithCorpus)
                    
                    // Update chat with corpus message
                    await fetch(`/api/chats/${selectedChat}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        messages: updatedMessagesWithCorpus,
                      }),
                    })
                    
                    // Trigger storage update event
                    window.dispatchEvent(new CustomEvent('chat-messages-updated', { detail: { chatId: selectedChat } }))
                  }
                } catch (corpusError) {
                  console.error('Error fetching corpus:', corpusError)
                  // Don't show error to user, just log it
                }
              }
              
              return // Exit early, don't show placeholder
            } else {
              // If search failed, show error message instead of placeholder
              const errorData = await searchResponse.json().catch(() => ({ error: `Backend returned ${searchResponse.status}` }))
              const errorMessage = {
                role: 'assistant' as const,
                content: `❌ Search failed: ${errorData.error || `HTTP ${searchResponse.status}`}\n\nPlease check if backend is running at localhost:3001`,
                timestamp: new Date(),
              }
              setCurrentMessages(prev => [...prev, errorMessage])
              
              await fetch(`/api/chats/${selectedChat}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  messages: [...currentMessages, newMessage, errorMessage],
                }),
              })
              
              return // Exit early, don't show placeholder
            }
          } catch (error: any) {
            console.error('Error searching papers:', error)
            // Show error message instead of placeholder
            const errorMessage = {
              role: 'assistant' as const,
              content: `❌ Error searching papers: ${error.message || 'Unknown error'}\n\nPlease check if backend is running at localhost:3001`,
              timestamp: new Date(),
            }
            setCurrentMessages(prev => [...prev, errorMessage])
            
            await fetch(`/api/chats/${selectedChat}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: [...currentMessages, newMessage, errorMessage],
              }),
            })
            
            return // Exit early, don't show placeholder
          }
        }

        // Simulate assistant response (you can integrate with an AI API here)
        setTimeout(() => {
          const assistantMessage = {
            role: 'assistant' as const,
            content: networkData 
              ? `Citation network visualization created for ${papers?.length || 0} paper(s).`
              : `I received your message: "${content}". This is a placeholder response.`,
            timestamp: new Date(),
          }
          setCurrentMessages(prev => [...prev, assistantMessage])
          
          // Update chat with assistant message
          fetch(`/api/chats/${selectedChat}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [...currentMessages, newMessage, assistantMessage],
            }),
          })
        }, 1000)
      }
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const handleNewChat = async (title: string) => {
    // If no project selected, use first project or create a default one
    let projectId = selectedProject
    if (!projectId) {
      if (projects.length > 0) {
        projectId = projects[0].id
        setSelectedProject(projectId)
        await loadChats(projectId)
      } else {
        // Create a default project if none exists
        try {
          const response = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Default Project', description: 'Default project for chats' }),
          })
          if (response.ok) {
            const data = await response.json()
            projectId = data.project.id
            await loadProjects()
            setSelectedProject(projectId)
            await loadChats(projectId)
          } else {
            throw new Error('Please create a project first')
          }
        } catch (error) {
          throw new Error('Please create a project first')
        }
      }
    }
    // Create chat and it will auto-select
    await handleCreateChat(title)
  }

  const handleNewProject = async (name: string, description?: string) => {
    await handleCreateProject(name, description)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <div className="text-foreground text-base font-medium">Loading...</div>
        </div>
      </div>
    )
  }

  if (!selectedProject) {
    return (
      <SidebarProvider>
        <Sidebar
          projects={projects}
          chats={chats}
          onNewChat={handleNewChat}
          onNewProject={handleNewProject}
          onSelectChat={(chatId) => {
            const chat = chats.find(c => c.id === chatId)
            if (chat) {
              setSelectedProject(chat.projectId)
              setSelectedChat(chatId)
            }
          }}
          onSelectProject={async (projectId) => {
            setSelectedProject(projectId)
            if (projectId) {
              await loadChats(projectId)
            } else {
              await loadChats()
            }
            setSelectedChat(null)
          }}
          onUpdateProject={handleUpdateProject}
          onUpdateChat={handleUpdateChat}
          onDeleteProject={handleDeleteProject}
          onDeleteChat={handleDeleteChat}
          user={user}
          selectedProject={selectedProject}
          selectedChat={selectedChat}
          loadingProjects={loadingProjects}
          loadingChats={loadingChats}
        />
        <SidebarInset>
          <div className="flex-1 flex flex-col h-screen">
            <Header
              projectName={undefined}
              onBack={() => {}}
              user={user}
            />
            <div className="flex-1 overflow-y-auto">
              <ProjectList
                projects={projects}
                onSelectProject={async (projectId) => {
                  setSelectedProject(projectId)
                  await loadChats(projectId)
                  setSelectedChat(null) // Clear any selected chat when switching projects
                }}
                onUpdateProject={handleUpdateProject}
                onDeleteProject={handleDeleteProject}
              />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  const selectedProjectData = projects.find(p => p.id === selectedProject)

  return (
    <SidebarProvider>
      <Sidebar
        projects={projects}
        chats={chats}
        onNewChat={handleNewChat}
        onNewProject={handleNewProject}
        onSelectChat={setSelectedChat}
        onSelectProject={async (projectId) => {
          setSelectedProject(projectId)
          setSelectedChat(null)
          // Reload chats to get updated data
          await loadChats()
        }}
        onUpdateProject={handleUpdateProject}
        onUpdateChat={handleUpdateChat}
        onToggleFavorite={async (chatId: string, isFavorite: boolean) => {
          try {
            const response = await fetch(`/api/chats/${chatId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isFavorite }),
            })
            if (response.ok) {
              // Update local state
              setChats(prevChats => 
                prevChats.map(chat => 
                  chat.id === chatId ? { ...chat, isFavorite } : chat
                )
              )
            }
          } catch (error) {
            console.error('Error toggling favorite:', error)
          }
        }}
        onDeleteProject={handleDeleteProject}
        onDeleteChat={handleDeleteChat}
        user={user}
        selectedProject={selectedProject}
        selectedChat={selectedChat}
        loadingProjects={loadingProjects}
        loadingChats={loadingChats}
      />
      <SidebarInset>
        <div className="flex flex-col h-screen overflow-hidden">
          <Header
            projectName={selectedProjectData?.name}
            onBack={() => {
              setSelectedProject(null)
              setSelectedChat(null)
            }}
            user={user}
          />
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {selectedChat ? (
                <ChatInterface
                  chatId={selectedChat}
                  messages={currentMessages}
                  chatDepth={currentChatDepth}
                  loadingMessages={loadingMessages}
                  onSendMessage={handleSendMessage}
                  onAddAssistantMessage={handleAddAssistantMessage}
                  onDepthChange={async (newDepth: number) => {
                    try {
                      const response = await fetch(`/api/chats/${selectedChat}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ depth: newDepth }),
                      })
                      if (response.ok) {
                        setCurrentChatDepth(newDepth)
                      }
                    } catch (error) {
                      console.error('Error updating chat depth:', error)
                    }
                  }}
                  onCitationNetwork={async (response) => {
                    // Store citation network response in chat
                    try {
                      await fetch(`/api/chats/${selectedChat}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          messages: currentMessages,
                        }),
                      })
                    } catch (error) {
                      console.error('Error storing citation network:', error)
                    }
                  }}
                />
              ) : selectedProject ? (
                <PaperSearchPage
                  chatId={selectedChat}
                  onSelectChat={setSelectedChat}
                  projectId={selectedProject}
                  chatDepth={currentChatDepth}
                />
              ) : (
                <ProjectList
                  projects={projects}
                  onSelectProject={async (projectId) => {
                    setSelectedProject(projectId)
                    await loadChats(projectId)
                    setSelectedChat(null)
                  }}
                  onUpdateProject={handleUpdateProject}
                  onDeleteProject={handleDeleteProject}
                />
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

