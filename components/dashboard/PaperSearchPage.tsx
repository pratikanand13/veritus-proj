'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, FileText, Users, Network, ExternalLink, MessageSquare, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CitationTree } from './CitationTree'
import { CitationNetworkSelector } from './CitationNetworkSelector'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { SearchResultsSkeleton } from './SearchResultsSkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { Paper } from '@/types/paper-api'
import { SearchPaperResponse, CorpusResponse, CitationNetworkResponse } from '@/types/paper-api'
import { VeritusPaper } from '@/types/veritus'
import { shouldUseMockData } from '@/lib/config/mock-config'

interface PaperSearchPageProps {
  chatId?: string | null
  onSelectChat?: (chatId: string) => void
  projectId?: string | null
  chatDepth?: number
}

export function PaperSearchPage({ chatId, onSelectChat, projectId, chatDepth = 100 }: PaperSearchPageProps) {
  const [titleQuery, setTitleQuery] = useState('')
  const [corpusIdQuery, setCorpusIdQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchResult, setSearchResult] = useState<SearchPaperResponse | null>(null)
  const [corpusResult, setCorpusResult] = useState<CorpusResponse | null>(null)
  const [loadingCorpus, setLoadingCorpus] = useState(false)
  const [saveToChat, setSaveToChat] = useState(true)
  const [citationNetworkResponse, setCitationNetworkResponse] = useState<CitationNetworkResponse | null>(null)
  const [loadingCitationNetwork, setLoadingCitationNetwork] = useState(false)
  const [showCitationNetworkSelector, setShowCitationNetworkSelector] = useState(false)
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date; papers?: VeritusPaper[] }>>([])
  
  // Determine if mock mode should be used (configurable via environment or defaults)
  const useMock = shouldUseMockData()

  // Reset messages when chatId changes to ensure chat isolation
  useEffect(() => {
    if (chatId) {
      // Load messages for this specific chat
      fetch(`/api/chats/${chatId}`)
        .then(res => res.json())
        .then(data => {
          if (data.chat && data.chat.messages) {
            setMessages(data.chat.messages || [])
          } else {
            setMessages([])
          }
        })
        .catch(err => {
          console.error('Error loading chat messages:', err)
          setMessages([])
        })
    } else {
      setMessages([])
    }
  }, [chatId])

  const handleTitleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titleQuery.trim()) return

    setLoading(true)
    setError(null)
    setSearchResult(null)
    setCorpusResult(null)

    try {
      const response = await fetch('/api/paper/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: titleQuery.trim(),
          chatId: saveToChat && chatId ? chatId : undefined,
          isMocked: useMock, // Use configurable mock mode
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to search paper')
      }

      const data: SearchPaperResponse = await response.json()
      setSearchResult(data)
      
      // Automatically call corpus API after search succeeds
      if (data.paper?.id) {
        await fetchCorpusData(data.paper.id)
      }
    } catch (err: any) {
      console.error('Search error:', err)
      setError(err.message || 'Failed to search paper')
    } finally {
      setLoading(false)
    }
  }

  const handleCorpusIdSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Input validation
    if (!corpusIdQuery.trim()) {
      setError('Please enter a corpus ID')
      return
    }
    
    if (!corpusIdQuery.trim().startsWith('corpus:')) {
      setError('Corpus ID must start with "corpus:"')
      return
    }

    setLoading(true)
    setError(null)
    setSearchResult(null)
    setCorpusResult(null)

    try {
      const response = await fetch('/api/paper/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          corpusId: corpusIdQuery.trim(),
          chatId: saveToChat && chatId ? chatId : undefined,
          isMocked: useMock, // Use configurable mock mode
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to search paper')
      }

      const data: SearchPaperResponse = await response.json()
      setSearchResult(data)
      
      // Automatically call corpus API after search succeeds
      if (data.paper?.id) {
        await fetchCorpusData(data.paper.id)
      }
    } catch (err: any) {
      console.error('Search error:', err)
      setError(err.message || 'Failed to search paper')
    } finally {
      setLoading(false)
    }
  }

  // Function to fetch corpus data automatically
  const fetchCorpusData = async (corpusId: string) => {
    setLoadingCorpus(true)
    setError(null)

    // Use chat-specific depth
    const depth = chatDepth

    try {
      const response = await fetch('/api/paper/corpus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          corpusId: corpusId,
          depth: depth,
          chatId: saveToChat && chatId ? chatId : undefined,
          isMocked: useMock, // Use configurable mock mode
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get similar papers')
      }

      const data: CorpusResponse = await response.json()
      setCorpusResult(data)
    } catch (err: any) {
      console.error('Corpus search error:', err)
      // Don't set error state for automatic calls, just log it
      console.log('Automatic corpus fetch failed, user can manually retry')
    } finally {
      setLoadingCorpus(false)
    }
  }

  const handleGetSimilarPapers = async () => {
    if (!searchResult?.paper?.id) return

    setLoadingCorpus(true)
    setError(null)

    // Use chat-specific depth
    const depth = chatDepth

    try {
      const response = await fetch('/api/paper/corpus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          corpusId: searchResult.paper.id,
          depth: depth,
          chatId: saveToChat && chatId ? chatId : undefined,
          isMocked: useMock, // Use configurable mock mode
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get similar papers')
      }

      const data: CorpusResponse = await response.json()
      setCorpusResult(data)
    } catch (err: any) {
      console.error('Corpus search error:', err)
      setError(err.message || 'Failed to get similar papers')
    } finally {
      setLoadingCorpus(false)
    }
  }

  const handleClear = () => {
    setTitleQuery('')
    setCorpusIdQuery('')
    setSearchResult(null)
    setCorpusResult(null)
    setCitationNetworkResponse(null)
    setError(null)
    setMessages([])
  }

  const handlePaperClick = async (paper: VeritusPaper) => {
    // Create or select a chat for this paper
    if (onSelectChat && projectId) {
      try {
        // Create a new chat with paper title
        const chatTitle = paper.title.length > 50 ? paper.title.substring(0, 50) + '...' : paper.title
        const chatResponse = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            title: chatTitle,
          }),
        })
        
        if (!chatResponse.ok) {
          throw new Error('Failed to create chat')
        }

        const chatData = await chatResponse.json()
        const newChatId = chatData.chat.id
        onSelectChat(newChatId)

        // Call search API with corpusId if present, otherwise with title
        let searchResponse: Response
        if (paper.id && paper.id.startsWith('corpus:')) {
          // Use corpusId
          searchResponse = await fetch('/api/paper/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              corpusId: paper.id,
              chatId: newChatId,
              isMocked: useMock,
            }),
          })
        } else if (paper.title) {
          // Use title
          searchResponse = await fetch('/api/paper/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: paper.title,
              chatId: newChatId,
              isMocked: useMock,
            }),
          })
        } else {
          throw new Error('No corpusId or title available')
        }

        if (!searchResponse.ok) {
          throw new Error('Failed to search paper')
        }

        const searchData: SearchPaperResponse = await searchResponse.json()
        
        // Add search result as assistant message
        const searchMessage = {
          role: 'assistant' as const,
          content: `Found paper: ${searchData.paper.title}\n\nAuthors: ${searchData.paper.authors}\nYear: ${searchData.paper.year || 'N/A'}\nCitations: ${searchData.paper.impactFactor?.citationCount || 0}\n\n${searchData.paper.abstract || searchData.paper.tldr || ''}`,
          timestamp: new Date(),
          papers: [searchData.paper],
        }

        await fetch(`/api/chats/${newChatId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [searchMessage],
          }),
        })

        // Automatically call corpus API after search succeeds
        if (searchData.paper?.id) {
          try {
            const corpusResponse = await fetch('/api/paper/corpus', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                corpusId: searchData.paper.id,
                depth: chatDepth,
                chatId: newChatId,
                isMocked: useMock,
              }),
            })

            if (corpusResponse.ok) {
              const corpusData: CorpusResponse = await corpusResponse.json()
              
              // Add corpus results as another assistant message
              const corpusMessage = {
                role: 'assistant' as const,
                content: `Found ${corpusData.similarPapers.length} similar papers:\n\n${corpusData.similarPapers.slice(0, 5).map((p: any, idx: number) => `${idx + 1}. ${p.title} (${p.year || 'N/A'}) - ${p.impactFactor?.citationCount || 0} citations`).join('\n')}${corpusData.similarPapers.length > 5 ? `\n\n... and ${corpusData.similarPapers.length - 5} more papers` : ''}`,
                timestamp: new Date(),
                papers: [corpusData.paper, ...corpusData.similarPapers],
              }

              await fetch(`/api/chats/${newChatId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  messages: [searchMessage, corpusMessage],
                }),
              })
            }
          } catch (error) {
            console.error('Error fetching corpus:', error)
          }
        }
      } catch (error) {
        console.error('Error handling paper click:', error)
        setError(error instanceof Error ? error.message : 'Failed to open paper in chat')
      }
    }
  }

  const handleGenerateCitationNetwork = async (params: {
    corpusId: string
    depth: number
    simple: boolean
    keywords: string[]
    authors: string[]
    references: string[]
  }) => {
    setLoadingCitationNetwork(true)
    setError(null)
    
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
    
    const preGenerationMessage = {
      role: 'assistant' as const,
      content: `Generating citation network${params.simple ? ' (Simple Mode - Semantic Similarity)' : ' (Full Mode - Citation Network)'}...\n\n${paramDetails.length > 0 ? `Using: ${paramDetails.join(', ')}` : 'Using default parameters'}\n\nThis may take a few moments.`,
      timestamp: new Date(),
    }
    
    setMessages(prev => [...prev, preGenerationMessage])
    
    try {
      const response = await fetch('/api/paper/citation-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corpusId: params.corpusId,
          depth: params.depth,
          simple: params.simple,
          keywords: params.keywords,
          authors: params.authors,
          references: params.references,
          chatId: saveToChat && chatId ? chatId : undefined,
          isMocked: useMock, // Use configurable mock mode
          sortBy: 'relevance', // Default sort by relevance
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate citation network')
      }

      const data: CitationNetworkResponse = await response.json()
      setCitationNetworkResponse(data)
    } catch (err: any) {
      console.error('Error generating citation network:', err)
      setError(err.message || 'Failed to generate citation network')
    } finally {
      setLoadingCitationNetwork(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full p-4 space-y-4">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <FileText className="h-8 w-8 text-green-500" />
            <h1 className="text-3xl font-semibold text-foreground">Paper Search</h1>
          </div>
          <p className="text-muted-foreground text-base">Search for academic papers by title or corpus ID</p>
        </div>

        {/* Chat Selection Info */}
        {projectId && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-green-500" />
                  <div className="text-sm text-card-foreground">
                    {chatId ? (
                      <span>Results will be saved to the current chat</span>
                    ) : (
                      <span className="text-muted-foreground">Click on any paper to open a chat window</span>
                    )}
                  </div>
                </div>
                {chatId && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="saveToChat"
                      checked={saveToChat}
                      onChange={(e) => setSaveToChat(e.target.checked)}
                      className="w-4 h-4 rounded text-green-500"
                    />
                    <label htmlFor="saveToChat" className="text-sm text-card-foreground cursor-pointer">
                      Save to chat
                    </label>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Forms */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Title Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Search by Title
              </CardTitle>
              <CardDescription>
                Find papers by entering the paper title
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTitleSearch} className="space-y-3">
                <Input
                  type="text"
                  placeholder="Enter paper title..."
                  value={titleQuery}
                  onChange={(e) => setTitleQuery(e.target.value)}
                  disabled={loading}
                />
                <Button
                  type="submit"
                  disabled={loading || !titleQuery.trim()}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Search
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Corpus ID Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search by Corpus ID
              </CardTitle>
              <CardDescription>
                Find papers by entering the corpus ID
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCorpusIdSearch} className="space-y-3">
                <Input
                  type="text"
                  placeholder="Enter corpus ID (e.g., corpus:12345678)"
                  value={corpusIdQuery}
                  onChange={(e) => setCorpusIdQuery(e.target.value)}
                  disabled={loading}
                />
                <Button
                  type="submit"
                  disabled={loading || !corpusIdQuery.trim()}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Search
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="bg-red-900/20 border-red-800">
            <CardContent className="pt-6">
              <p className="text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading State for Search */}
        {loading && !searchResult && (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Result */}
        {searchResult && (
          <Card className="hover:shadow-md transition-all">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <CardTitle className="text-xl mb-3 cursor-pointer hover:text-primary transition-colors" onClick={() => handlePaperClick(searchResult.paper)}>
                    {searchResult.paper.title}
                  </CardTitle>
                  <CardDescription className="mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {searchResult.paper.authors}
                  </CardDescription>
                  <div className="flex flex-wrap gap-2 items-center">
                    {searchResult.paper.year && (
                      <Badge variant="outline">
                        {searchResult.paper.year}
                      </Badge>
                    )}
                    {searchResult.paper.journalName && (
                      <Badge variant="outline">
                        {searchResult.paper.journalName}
                      </Badge>
                    )}
                    {searchResult.paper.impactFactor && (
                      <Badge variant="outline">
                        {searchResult.paper.impactFactor.citationCount} citations
                      </Badge>
                    )}
                    {searchResult.paper.isOpenAccess && (
                      <Badge variant="green">
                        Open Access
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePaperClick(searchResult.paper)}
                    title="Open in chat"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {searchResult.paper.abstract && (
                <div>
                  <h4 className="text-foreground font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Abstract
                  </h4>
                  <p className="text-card-foreground text-sm leading-relaxed">
                    {searchResult.paper.abstract}
                  </p>
                </div>
              )}
              {searchResult.paper.tldr && (
                <div>
                  <h4 className="text-foreground font-medium mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    TLDR
                  </h4>
                  <p className="text-card-foreground text-sm italic bg-muted p-3 rounded-sm border-l-2 border-primary/50">
                    {searchResult.paper.tldr}
                  </p>
                </div>
              )}
              {searchResult.paper.fieldsOfStudy && searchResult.paper.fieldsOfStudy.length > 0 && (
                <div>
                  <h4 className="text-foreground font-medium mb-2">Fields of Study</h4>
                  <div className="flex flex-wrap gap-2">
                    {searchResult.paper.fieldsOfStudy.map((field, idx) => (
                      <Badge key={idx} variant="outline">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                {searchResult.paper.pdfLink && (
                  <a
                    href={searchResult.paper.pdfLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-sm transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View PDF
                  </a>
                )}
                {searchResult.paper.link && (
                  <a
                    href={searchResult.paper.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-sm transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Paper
                  </a>
                )}
                {searchResult.paper.id && (
                  <Button
                    onClick={() => setShowCitationNetworkSelector(true)}
                    className=""
                  >
                    <Network className="h-4 w-4 mr-2" />
                    Generate Citation Graph
                  </Button>
                )}
              </div>
              {loadingCorpus && (
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-3">
                        <Skeleton className="h-5 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-1/2" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-5/6" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Similar Papers Result */}
        {corpusResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Similar Papers ({corpusResult.similarPapers.length})
              </CardTitle>
              {corpusResult.meta && (
                <CardDescription>
                  Query: {corpusResult.meta.query} • Depth: {corpusResult.meta.depth}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {corpusResult.similarPapers.map((paper, idx) => (
                  <Card
                    key={paper.id || idx}
                    className="hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => handlePaperClick(paper)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-base mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                            {paper.title}
                          </CardTitle>
                          <CardDescription className="text-sm mb-2 flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {paper.authors}
                          </CardDescription>
                          <div className="flex flex-wrap gap-2 items-center">
                            {paper.year && (
                              <Badge variant="outline" className="text-xs">
                                {paper.year}
                              </Badge>
                            )}
                            {paper.journalName && (
                              <Badge variant="outline" className="text-xs">
                                {paper.journalName}
                              </Badge>
                            )}
                            {paper.impactFactor && (
                              <Badge variant="outline" className="text-xs">
                                {paper.impactFactor.citationCount} citations
                              </Badge>
                            )}
                            {paper.isOpenAccess && (
                              <Badge className="text-xs bg-green-600/20 text-green-400 border-green-500/50">
                                Open Access
                              </Badge>
                            )}
                            {paper.score && (
                              <Badge className="text-xs bg-purple-600/20 text-purple-300 border-purple-500/50">
                                {(paper.score * 100).toFixed(1)}% similar
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePaperClick(paper)
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MessageSquare className="h-4 w-4 text-blue-400" />
                        </Button>
                      </div>
                    </CardHeader>
                    {paper.tldr && (
                      <CardContent className="pt-0">
                        <p className="text-card-foreground text-sm italic line-clamp-2 bg-muted p-2 rounded-sm">
                          {paper.tldr}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Citation Network Loading Skeleton */}
        {loadingCitationNetwork && !citationNetworkResponse && (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[600px] w-full rounded-sm" />
            </CardContent>
          </Card>
        )}

        {/* Citation Network Graph */}
        {citationNetworkResponse && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-primary" />
                Citation Network
                {citationNetworkResponse.meta?.mode && (
                  <Badge variant="outline" className="ml-2">
                    {citationNetworkResponse.meta.mode === 'simple' ? 'Simple Mode' : 'Full Mode'}
                  </Badge>
                )}
              </CardTitle>
              {citationNetworkResponse.citationNetwork?.stats && (
                <CardDescription>
                  {citationNetworkResponse.citationNetwork.stats.totalNodes} nodes • {citationNetworkResponse.citationNetwork.stats.totalEdges} edges
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <CitationTree
                citationNetworkResponse={citationNetworkResponse}
                chatId={chatId}
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
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!searchResult && !error && (
          <div className="text-center py-12">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Start Your Search
            </h3>
            <p className="text-muted-foreground">
              Use the search forms above to find academic papers
            </p>
          </div>
        )}
        </div>
      </div>

      {/* Citation Network Selector */}
      {searchResult?.paper?.id && (
        <CitationNetworkSelector
          open={showCitationNetworkSelector}
          onOpenChange={setShowCitationNetworkSelector}
          corpusId={searchResult.paper.id}
          depth={chatDepth}
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

