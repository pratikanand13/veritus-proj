'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Mic, MicOff, Plus, FileText, Network, ThumbsUp, ThumbsDown, Copy, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PaperSearchBar } from './PaperSearchBar'
import { PaperSearchResults } from './PaperSearchResults'
import { CitationNetworkEnhanced as CitationNetwork } from './CitationNetworkEnhanced'
import { CitationTree } from './CitationTree'
import { CitationNetworkSelector } from './CitationNetworkSelector'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { VeritusPaper } from '@/types/veritus'
import { CitationNetworkResponse } from '@/types/paper-api'
import { shouldUseMockData } from '@/lib/config/mock-config'
import { MessagesSkeleton } from './MessagesSkeleton'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  papers?: VeritusPaper[]
  citationNetwork?: any
}

interface ChatInterfaceProps {
  chatId: string | null
  messages: Message[]
  chatDepth?: number
  onSendMessage: (content: string, papers?: VeritusPaper[], networkData?: any) => void
  onAddAssistantMessage?: (content: string, papers?: VeritusPaper[], networkData?: any) => void
  onDepthChange?: (depth: number) => void
  onCitationNetwork?: (response: CitationNetworkResponse) => void
  loadingMessages?: boolean
}

export function ChatInterface({ chatId, messages, chatDepth = 100, onSendMessage, onAddAssistantMessage, onDepthChange, onCitationNetwork, loadingMessages = false }: ChatInterfaceProps) {
  const [input, setInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [showPaperSearch, setShowPaperSearch] = useState(false)
  const [searchResults, setSearchResults] = useState<VeritusPaper[]>([])
  const [selectedPapers, setSelectedPapers] = useState<string[]>([])
  const [showNetwork, setShowNetwork] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [depth, setDepth] = useState(chatDepth)
  const [showCitationNetworkSelector, setShowCitationNetworkSelector] = useState(false)
  const [loadingCitationNetwork, setLoadingCitationNetwork] = useState(false)
  const [currentCorpusId, setCurrentCorpusId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Determine if mock mode should be used (configurable via environment or defaults)
  const useMock = shouldUseMockData()

  useEffect(() => {
    setDepth(chatDepth)
  }, [chatDepth])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Find the most recent paper result to get corpusId
  useEffect(() => {
    // Look for the last paper in messages
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i]
      if (message && message.papers && message.papers.length > 0) {
        const paper = message.papers[0]
        if (paper && paper.id) {
          setCurrentCorpusId(paper.id)
          break
        }
      }
    }
  }, [messages])

  // Refresh messages when chatId changes to ensure we have latest data
  useEffect(() => {
    if (chatId && onCitationNetwork) {
      // Messages are managed by parent component, but we can trigger a refresh
      // by calling the parent's refresh handler if available
    }
  }, [chatId])

  const handleGenerateCitationNetwork = async (params: {
    corpusId: string
    depth: number
    simple: boolean
    keywords: string[]
    authors: string[]
    references: string[]
  }) => {
    if (!chatId) return

    setLoadingCitationNetwork(true)
    
    // Add explanatory message before generating the network
    const paramDetails: string[] = []
    if (params.keywords.length > 0) {
      paramDetails.push(`${params.keywords.length} keyword${params.keywords.length !== 1 ? 's' : ''}`)
    }
    if (params.authors.length > 0) {
      paramDetails.push(`${params.authors.length} author${params.authors.length !== 1 ? 's' : ''}`)
    }
    if (params.references.length > 0) {
      paramDetails.push(`${params.references.length} reference${params.references.length !== 1 ? 's' : ''}`)
    }
    
    const preGenerationContent = `Generating citation network${params.simple ? ' (Simple Mode - Semantic Similarity)' : ' (Full Mode - Citation Network)'}...\n\n${paramDetails.length > 0 ? `Using: ${paramDetails.join(', ')}` : 'Using default parameters'}\n\nThis may take a few moments.`
    
    // Add user message requesting the network
    onSendMessage(
      `Generate citation network${params.simple ? ' (simple mode)' : ' (full mode)'}${paramDetails.length > 0 ? ` with ${paramDetails.join(', ')}` : ''}`,
      undefined,
      undefined
    )
    
    // Add pre-generation explanation as assistant message
    if (onAddAssistantMessage) {
      onAddAssistantMessage(preGenerationContent)
    }
    
    try {
      const response = await fetch('/api/paper/citation-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          chatId,
          isMocked: useMock, // Use configurable mock mode
          sortBy: 'relevance', // Default sort by relevance
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate citation network')
      }

      const data: CitationNetworkResponse = await response.json()
      
      // Call the callback to handle the response
      if (onCitationNetwork) {
        onCitationNetwork(data)
      }

      // Also add as a message
      const networkMessage = {
        role: 'assistant' as const,
        content: `Citation network generated${params.simple ? ' (Simple Mode)' : ' (Full Mode)'}:\n\n${params.simple ? `Found ${data.similarPapers?.length || 0} similar papers` : `Network with ${data.citationNetwork?.stats.totalNodes || 0} nodes and ${data.citationNetwork?.stats.totalEdges || 0} edges`}`,
        timestamp: new Date(),
        papers: params.simple && data.similarPapers ? [data.paper, ...data.similarPapers] : [data.paper],
        citationNetwork: data,
      }

      onSendMessage(
        `Generated citation network${params.simple ? ' (simple mode)' : ' (full mode)'}`,
        networkMessage.papers,
        networkMessage.citationNetwork
      )

      // Force refresh of messages after network generation
      // This ensures CitationNetworkSelector sees the updated messages
      if (chatId) {
        // Trigger a re-render by updating a state that causes messages to refresh
        // The parent component should handle this via loadChatMessages
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('chat-messages-updated', { detail: { chatId } }))
        }, 100)
      }
    } catch (error: any) {
      console.error('Error generating citation network:', error)
      setSearchError(error.message || 'Failed to generate citation network')
    } finally {
      setLoadingCitationNetwork(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      onSendMessage(input.trim())
      setInput('')
    }
  }

  const toggleRecording = () => {
    setIsRecording(!isRecording)
    // TODO: Implement voice recording functionality
  }

  const handleSearchResults = (papers: VeritusPaper[]) => {
    setSearchResults(papers)
    setSearchError('')
  }

  const handleSearchError = (error: string) => {
    setSearchError(error)
    setSearchResults([])
  }

  const handleTogglePaper = (paperId: string) => {
    setSelectedPapers(prev =>
      prev.includes(paperId)
        ? prev.filter(id => id !== paperId)
        : [...prev, paperId]
    )
  }

  const handleSelectAll = () => {
    setSelectedPapers(searchResults.map(p => p.id))
  }

  const handleDeselectAll = () => {
    setSelectedPapers([])
  }

  const handleVisualizeNetwork = () => {
    if (selectedPapers.length === 0) {
      setSearchError('Please select at least one paper to visualize')
      return
    }

    const papersToVisualize = searchResults.filter(p => selectedPapers.includes(p.id))
    
    // Create network data
    const networkData = {
      papers: papersToVisualize,
      createdAt: new Date(),
    }

    // Send as message with network data
    onSendMessage(
      `Visualizing citation network for ${selectedPapers.length} paper(s)`,
      papersToVisualize,
      networkData
    )

    setShowNetwork(true)
    setShowPaperSearch(false)
  }

  const selectedPapersData = searchResults.filter(p => selectedPapers.includes(p.id))

  if (!chatId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0f0f0f]">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white mb-2">
            What's on the agenda today?
          </h2>
          <p className="text-gray-400">Select a chat or create a new one to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Paper Search Section */}
      {showPaperSearch && (
        <div className="border-b border-[#2a2a2a] p-4 bg-[#171717]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Paper Search
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowPaperSearch(false)
                setSearchResults([])
                setSelectedPapers([])
                setSearchError('')
              }}
              className="text-gray-400 hover:text-white"
            >
              Close
            </Button>
          </div>
          
          <PaperSearchBar
            onSearchResults={handleSearchResults}
            onError={handleSearchError}
          />

          {searchError && (
            <div className="mt-3 p-3 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md">
              {searchError}
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="mt-4">
              <PaperSearchResults
                papers={searchResults}
                selectedPapers={selectedPapers}
                onTogglePaper={handleTogglePaper}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
              />
              {selectedPapers.length > 0 && (
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={handleVisualizeNetwork}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Network className="mr-2 h-4 w-4" />
                    Visualize Citation Network ({selectedPapers.length})
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {loadingMessages ? (
          <MessagesSkeleton />
        ) : messages.length === 0 && !showNetwork ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-white mb-2">
                What's on the agenda today?
              </h2>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div key={index} className="space-y-2">
                <div
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-[#2a2a2a] text-white'
                        : 'bg-[#1f1f1f] text-gray-300 border border-[#2a2a2a]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    
                    {/* Feedback buttons for assistant messages */}
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#2a2a2a]">
                        <button
                          className="p-1.5 hover:bg-[#2a2a2a] rounded transition-colors"
                          title="Thumbs up"
                        >
                          <ThumbsUp className="h-4 w-4 text-gray-400 hover:text-[#FF6B35]" />
                        </button>
                        <button
                          className="p-1.5 hover:bg-[#2a2a2a] rounded transition-colors"
                          title="Thumbs down"
                        >
                          <ThumbsDown className="h-4 w-4 text-gray-400 hover:text-[#FF6B35]" />
                        </button>
                        <button
                          className="p-1.5 hover:bg-[#2a2a2a] rounded transition-colors"
                          title="Copy"
                          onClick={() => {
                            navigator.clipboard.writeText(message.content)
                          }}
                        >
                          <Copy className="h-4 w-4 text-gray-400 hover:text-[#FF6B35]" />
                        </button>
                        <button
                          className="p-1.5 hover:bg-[#2a2a2a] rounded transition-colors ml-auto"
                          title="Regenerate response"
                        >
                          <RotateCcw className="h-4 w-4 text-gray-400 hover:text-[#FF6B35]" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Show citation network if present */}
                {message.citationNetwork && (
                  <div className="mt-4">
                    <CitationTree 
                      citationNetworkResponse={typeof message.citationNetwork === 'object' && 'paper' in message.citationNetwork ? message.citationNetwork : undefined}
                      chatId={chatId}
                      messages={messages}
                      onExpandNode={async (nodeId: string) => {
                        try {
                          const response = await fetch('/api/paper/citation-network', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              corpusId: nodeId,
                              depth: chatDepth || 50,
                              chatId,
                              isMocked: useMock,
                              sortBy: 'relevance',
                            }),
                          })
                          if (response.ok) {
                            return await response.json()
                          }
                        } catch (error) {
                          console.error('Error expanding node:', error)
                        }
                        return null
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
            
            {/* Show network if visualizing */}
            {showNetwork && selectedPapersData.length > 0 && (
              <div className="mt-4">
                <CitationNetwork papers={selectedPapersData} width={800} height={500} />
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-[#2a2a2a] p-4 bg-[#0f0f0f]/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex gap-2 mb-2 flex-wrap items-center">
          <Button
            type="button"
            onClick={() => setShowPaperSearch(!showPaperSearch)}
            variant="outline"
            className={`border-[#2a2a2a] text-gray-300 text-xs ${
              showPaperSearch ? 'bg-[#2a2a2a]' : ''
            }`}
          >
            <FileText className="mr-2 h-3 w-3" />
            {showPaperSearch ? 'Hide' : 'Search'} Papers
          </Button>
          {currentCorpusId && (
            <Button
              type="button"
              onClick={() => setShowCitationNetworkSelector(true)}
              variant="outline"
              className="border-[#2a2a2a] text-gray-300 text-xs"
            >
              <Network className="mr-2 h-3 w-3" />
              Citation Network
            </Button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Label htmlFor="depth" className="text-xs text-gray-400 whitespace-nowrap">
              Depth:
            </Label>
            <Input
              id="depth"
              type="number"
              min="1"
              max="500"
              value={depth}
              onChange={(e) => {
                const newDepth = parseInt(e.target.value) || 100
                const clampedDepth = Math.max(1, Math.min(500, newDepth))
                setDepth(clampedDepth)
                if (onDepthChange && clampedDepth !== chatDepth) {
                  onDepthChange(clampedDepth)
                }
              }}
              onBlur={() => {
                if (onDepthChange && depth !== chatDepth) {
                  onDepthChange(depth)
                }
              }}
              className="w-20 h-8 bg-[#1f1f1f] border-[#2a2a2a] text-white text-xs"
            />
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="flex-1 relative">
            <button
              type="button"
              onClick={toggleRecording}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 p-1.5 hover:bg-[#2a2a2a] rounded-full transition-colors"
            >
              {isRecording ? (
                <MicOff className="h-5 w-5 text-red-400" />
              ) : (
                <Mic className="h-5 w-5 text-gray-400" />
              )}
            </button>
            <Input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Start typing..."
              className="w-full pl-12 pr-14 bg-[#1f1f1f] border-[#2a2a2a] text-white placeholder:text-gray-500 rounded-full focus-visible:ring-[#FF6B35] focus-visible:border-[#FF6B35]"
            />
          </div>
          <Button
            type="submit"
            disabled={!input.trim()}
            className="rounded-full bg-[#FF6B35] hover:bg-[#FF8555] text-white h-10 w-10 p-0 flex items-center justify-center"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        
        {/* Footer text */}
        <div className="text-center text-xs text-gray-500 mt-2 pb-2">
          Free Research Preview. Responses may produce inaccurate information about people, places, or facts.
        </div>
      </div>

      {/* Citation Network Selector */}
      {currentCorpusId && (
        <CitationNetworkSelector
          open={showCitationNetworkSelector}
          onOpenChange={setShowCitationNetworkSelector}
          corpusId={currentCorpusId || ''}
          depth={depth}
          messages={messages}
          chatId={chatId}
          onGenerate={handleGenerateCitationNetwork}
        />
      )}

      {/* Loading Overlay */}
      <LoadingOverlay
        show={loadingCitationNetwork}
        message="Generating citation network..."
      />
    </div>
  )
}

