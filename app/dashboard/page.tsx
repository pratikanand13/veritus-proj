'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { ProjectList } from '@/components/dashboard/ProjectList'
import { ChatInterface } from '@/components/dashboard/ChatInterface'
import { Header } from '@/components/dashboard/Header'
import { PaperSearchPage } from '@/components/dashboard/PaperSearchPage'
import { PaperChatView } from '@/components/dashboard/PaperChatView'
import { shouldUseMockData } from '@/lib/config/mock-config'
import { toast } from '@/lib/utils/toast'

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
  const [currentChatHasPaperData, setCurrentChatHasPaperData] = useState(false)
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
      // Also check if chat has paperData from chats list or papers in messages
      const chat = chats.find(c => c.id === selectedChat)
      if (chat) {
        const hasPaperData = !!(chat as any).chatMetadata?.paperData
        const hasPapersInMessages = (chat.messages || []).some((msg: any) => 
          msg.papers && Array.isArray(msg.papers) && msg.papers.length > 0
        )
        if (hasPaperData || hasPapersInMessages) {
          setCurrentChatHasPaperData(true)
        }
      }
    } else {
      setCurrentMessages([])
      setCurrentChatHasPaperData(false)
    }
  }, [selectedChat, chats])

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
    } catch (error: any) {
      toast.error('Failed to load projects', error?.message || 'An unexpected error occurred')
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
        // Transform chats to include isFavorite, updatedAt, and chatMetadata
        const transformedChats = data.chats.map((chat: any) => ({
          ...chat,
          isFavorite: chat.isFavorite || false,
          updatedAt: chat.updatedAt || chat.createdAt,
          chatMetadata: chat.chatMetadata || {},
        }))
        setChats(transformedChats)
      }
    } catch (error: any) {
      toast.error('Failed to load chats', error?.message || 'An unexpected error occurred')
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
        const messages = data.chat.messages || []
        setCurrentMessages(messages)
        setCurrentChatDepth(data.chat.depth || 100)
        // Check if chat has paperData in chatMetadata OR has papers in messages
        const hasPaperData = !!(data.chat.chatMetadata?.paperData)
        const hasPapersInMessages = messages.some((msg: any) => msg.papers && Array.isArray(msg.papers) && msg.papers.length > 0)
        setCurrentChatHasPaperData(hasPaperData || hasPapersInMessages)
      }
    } catch (error: any) {
      toast.error('Failed to load messages', error?.message || 'An unexpected error occurred')
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
    } catch (error: any) {
      toast.error('Failed to create project', error?.message || 'An unexpected error occurred')
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
        toast.error('Failed to update project', errorData.error || 'An unexpected error occurred')
        throw new Error(errorData.error || 'Failed to update project')
      }
    } catch (error: any) {
      toast.error('Failed to update project', error?.message || 'An unexpected error occurred')
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
    } catch (error: any) {
      toast.error('Failed to update chat', error?.message || 'An unexpected error occurred')
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
    } catch (error: any) {
      toast.error('Failed to delete project', error?.message || 'An unexpected error occurred')
      throw error
    }
  }

  const handleCreateChat = async (title: string): Promise<string | null> => {
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
        return data.chat.id as string
      } else {
        const errorData = await response.json()
        toast.error('Failed to create chat', errorData.error || 'An unexpected error occurred')
        throw new Error(errorData.error || 'Failed to create chat')
      }
    } catch (error: any) {
      toast.error('Failed to create chat', error?.message || 'An unexpected error occurred')
      throw error
    }
    return null
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
    } catch (error: any) {
      toast.error('Failed to delete chat', error?.message || 'An unexpected error occurred')
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
        toast.warning('Failed to save assistant message')
      }
    } catch (error: any) {
      toast.warning('Failed to save assistant message', error?.message || 'An unexpected error occurred')
    }
  }

  // Instant chat creation from heading click - no metadata, no API calls
  // Just creates a chat with the title and opens it immediately
  const handleCreateChatFromHeading = async (title: string): Promise<string | null> => {
    // Get projectId for chat creation
    let projectId = selectedProject
    if (!projectId) {
      if (projects.length > 0) {
        projectId = projects[0].id
        setSelectedProject(projectId)
        await loadChats(projectId)
      } else {
        toast.warning('Please create a project first')
        return null
      }
    }
    
    if (!projectId || projectId.trim().length === 0) {
      toast.warning('Project ID is required', 'Please select a project first')
      return null
    }

    // Truncate title if too long
    const chatTitle = title.length > 50 ? title.substring(0, 50) + '...' : title

    try {
      // Create chat instantly with just the title - no paperData, no metadata
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId, 
          title: chatTitle,
          // No paperData, no messages - chat opens empty and ready
        }),
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText || 'Unknown error' }
        }
        toast.error('Failed to create chat', errorData.error || 'Unknown error')
        return null
      }

      const data = await response.json()
      const newChatId = data.chat?.id || data.chat?._id
      
      if (!newChatId) {
        toast.error('Failed to create chat', 'No chat ID returned from server')
        return null
      }

      // Optimistically add the new chat to state immediately for instant sidebar update
      const newChat: Chat = {
        id: newChatId,
        title: chatTitle,
        projectId: projectId,
        messages: [],
        depth: 100,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      
      // Add to chats state immediately (optimistic update)
      setChats(prevChats => {
        // Check if chat already exists to avoid duplicates
        if (prevChats.some(chat => chat.id === newChatId)) {
          return prevChats
        }
        // Add new chat at the beginning (most recent)
        return [newChat, ...prevChats]
      })

      // Switch to new chat immediately
      setSelectedChat(newChatId)

      // Refresh chats list from server in background to ensure consistency
      loadChats().catch(error => {
        toast.warning('Failed to refresh chat list', 'The chat was created but may not appear in the sidebar')
        // If refresh fails, the optimistic update is still there
      })

      toast.success('Chat created successfully')
      return newChatId
    } catch (error: any) {
      toast.error('Failed to create chat', error?.message || 'Unknown error')
      return null
    }
  }

  // Create a new chat from a node's full paper data and selected fields
  // This creates a completely clean single-node root tree with ONLY this paper's data
  const handleCreateChatFromNode = async (
    paper: any, 
    selectedFields?: Map<string, string> | undefined,
    nodeContext?: any
  ): Promise<string | null> => {
    // Rule 1: Create a new chat thread immediately with paper's title
    const title = paper?.title || 'Untitled Chat'
    
    // Rule 2: Transfer ONLY this paper's node data (no siblings, children, parents)
    // Extract ONLY the paper data - no citation network, no relationships
    const cleanPaperData = {
      ...paper,
      // Ensure no parent/child relationships are copied
    }

    // Build initial message containing ONLY this paper
    // IMPORTANT: Content format is different from search results to prevent false positives
    // Search results use "Found X similar papers" format, this uses "Paper:" format
    const rootMessage: any = {
      role: 'assistant' as const,
      content: `Paper: ${title}\n\nAuthors: ${paper.authors || 'N/A'}\nYear: ${paper.year || 'N/A'}\nJournal: ${paper.journalName || 'N/A'}\n\n${paper.abstract ? `Abstract: ${paper.abstract}` : ''}\n\n${paper.tldr ? `TLDR: ${paper.tldr}` : ''}`,
      timestamp: new Date(),
      papers: [cleanPaperData], // Store ONLY this paper, no relationships, no cached search results
    }

    // Rule 3: Prepare chatMetadata with paper data, selected fields, and API response data
    // This will initialize chatStore properly when creating the chat
    const chatMetadata: any = {
      paperData: cleanPaperData,
      selectedFields: selectedFields ? Object.fromEntries(selectedFields) : (nodeContext?.selectedFields || {}),
      apiFieldSelections: nodeContext?.apiFieldSelections || nodeContext?.selectedFields || {},
      keywords: nodeContext?.keywords || [],
      tableData: nodeContext?.tableData || {},
      metadataFields: nodeContext?.metadataFields || [],
      extractedValues: nodeContext?.extractedValues || {},
    }

    // Get projectId for chat creation
    let projectId = selectedProject
    if (!projectId) {
      if (projects.length > 0) {
        projectId = projects[0].id
        setSelectedProject(projectId)
        await loadChats(projectId)
      } else {
        throw new Error('Please create a project first')
      }
    }
    
    if (!projectId || projectId.trim().length === 0) {
      throw new Error('Project ID is required. Please select a project first.')
    }

    // Create chat with paperData so chatStore gets initialized properly
    try {
      console.log('Creating new chat with paper:', title)
      console.log('Project ID:', projectId)
      
      // First, create the chat with paperData (this initializes chatStore)
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId, 
          title,
          paperData: cleanPaperData, // Pass paperData to initialize chatStore
          messages: [rootMessage], // Pass initial message
        }),
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText || 'Unknown error' }
        }
        toast.error('Failed to create chat', errorData.error || 'Unknown error')
        return null
      }

      const data = await response.json()
      
      const newChatId = data.chat?.id || data.chat?._id
      
      if (!newChatId) {
        toast.error('Failed to create chat', 'No chat ID returned from server')
        return null
      }

      console.log('Chat created successfully with ID:', newChatId)

      // Optimistically add the new chat to state immediately for instant sidebar update
      const newChat: Chat = {
        id: newChatId,
        title: title,
        projectId: projectId,
        messages: [rootMessage],
        depth: 100,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      
      // Add to chats state immediately (optimistic update)
      setChats(prevChats => {
        // Check if chat already exists to avoid duplicates
        if (prevChats.some(chat => chat.id === newChatId)) {
          return prevChats
        }
        // Add new chat at the beginning (most recent)
        return [newChat, ...prevChats]
      })

      // Update chatMetadata with additional node context data
      try {
        const updateResponse = await fetch(`/api/chats/${newChatId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatMetadata, // Update with selected fields, keywords, etc.
          }),
        })
        
        if (!updateResponse.ok) {
          const errorText = await updateResponse.text()
          toast.warning('Failed to update chat metadata', errorText)
        }
      } catch (error: any) {
        toast.warning('Failed to update chat metadata', error?.message || 'Metadata update failed')
        // Continue even if metadata update fails
      }

      // Switch to new chat immediately
      console.log('Switching to new chat:', newChatId)
      setSelectedChat(newChatId)
      
      // The useEffect will call loadChatMessages and set currentChatHasPaperData
      // But we also set it here to ensure it's set immediately
      setCurrentChatHasPaperData(true)
      
      // Refresh chats list from server in background to ensure consistency
      loadChats().catch(error => {
        toast.warning('Failed to refresh chat list', 'The chat was created but may not appear in the sidebar')
        // If refresh fails, the optimistic update is still there
      })
      
      toast.success('Chat created successfully')
      return newChatId
    } catch (error: any) {
      toast.error('Failed to create chat', error?.message || 'Unknown error')
      return null
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
              toast.warning('Failed to save citation network')
            }
          } catch (error: any) {
            toast.warning('Failed to save network data', error?.message || 'An unexpected error occurred')
          }
        }

        // Check if this looks like a paper search query and call the API
        const isSearchQuery = content.length > 5 && !networkData && !papers
        
        if (isSearchQuery) {
          try {
            // Call paper search API
            const searchUrl = new URL('/api/v1/papers/search', window.location.origin)
            searchUrl.searchParams.set('title', content)
            if (selectedChat) {
              searchUrl.searchParams.set('chatId', selectedChat)
            }
            if (useMock) {
              searchUrl.searchParams.set('mock', 'true')
            }
            const searchResponse = await fetch(searchUrl.toString(), {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
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
                } catch (corpusError: any) {
                  toast.warning('Failed to fetch paper details', 'Some information may be incomplete')
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
            toast.error('Failed to search papers', error?.message || 'Unknown error')
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
    } catch (error: any) {
      toast.error('Failed to send message', error?.message || 'An unexpected error occurred')
    }
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
                onNewProject={handleNewProject}
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
          } catch (error: any) {
            toast.warning('Failed to toggle favorite', error?.message || 'An unexpected error occurred')
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
                currentChatHasPaperData ? (
                  <PaperChatView
                    chatId={selectedChat}
                    projectId={selectedProject!}
                    chatDepth={currentChatDepth}
                    onCreateChatFromNode={handleCreateChatFromNode}
                    onCreateChatFromHeading={handleCreateChatFromHeading}
                  />
                ) : (
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
                      } catch (error: any) {
                        toast.warning('Failed to update chat depth', error?.message || 'An unexpected error occurred')
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
                      } catch (error: any) {
                        toast.warning('Failed to store citation network', error?.message || 'An unexpected error occurred')
                      }
                    }}
                    onCreateChatFromNode={handleCreateChatFromNode}
                  />
                )
              ) : selectedProject ? (
                <PaperSearchPage
                  chatId={selectedChat}
                  onSelectChat={async (chatId: string) => {
                    setSelectedChat(chatId)
                    // Immediately check if this chat has paperData
                    // This handles the case where chat is created from paper click
                    try {
                      const response = await fetch(`/api/chats/${chatId}`)
                      if (response.ok) {
                        const data = await response.json()
                        const hasPaperData = !!(data.chat.chatMetadata?.paperData)
                        const hasPapersInMessages = (data.chat.messages || []).some((msg: any) => 
                          msg.papers && Array.isArray(msg.papers) && msg.papers.length > 0
                        )
                        setCurrentChatHasPaperData(hasPaperData || hasPapersInMessages)
                      }
                    } catch (error: any) {
                      toast.warning('Failed to check chat data', error?.message || 'An unexpected error occurred')
                    }
                  }}
                  projectId={selectedProject}
                  chatDepth={currentChatDepth}
                  onCreateChatFromNode={handleCreateChatFromNode}
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

