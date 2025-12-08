'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, FileText, Users, Network, ExternalLink, MessageSquare, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CitationTree } from './CitationTree'
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
  onCreateChatFromNode?: (paper: VeritusPaper, selectedFields?: Map<string, string>) => Promise<string | null>
}

export function PaperSearchPage({ chatId, onSelectChat, projectId, chatDepth = 100, onCreateChatFromNode }: PaperSearchPageProps) {
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
      const searchUrl = new URL('/api/v1/papers/search', window.location.origin)
      searchUrl.searchParams.set('title', titleQuery.trim())
      if (saveToChat && chatId) {
        searchUrl.searchParams.set('chatId', chatId)
      }
      if (useMock) {
        searchUrl.searchParams.set('mock', 'true')
      }

      const response = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const corpusUrl = new URL(`/api/v1/papers/${corpusIdQuery.trim()}`, window.location.origin)
      if (saveToChat && chatId) {
        corpusUrl.searchParams.set('chatId', chatId)
      }
      if (useMock) {
        corpusUrl.searchParams.set('mock', 'true')
      }

      const response = await fetch(corpusUrl.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to search paper')
      }

      const data = await response.json()
      // Transform response to match SearchPaperResponse format
      const searchResponse: SearchPaperResponse = {
        paper: data.paper,
        message: data.message || 'Paper found successfully',
        isMocked: data.isMocked || false,
      }
      setSearchResult(searchResponse)
      
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
        // FIRST: Fetch the full paper data from API before creating the chat
        // This ensures the chat is created with complete paper data from the start
        let searchResponse: Response
        if (paper.id && paper.id.startsWith('corpus:')) {
          // Use corpusId
          const corpusUrl = new URL(`/api/v1/papers/${paper.id}`, window.location.origin)
          if (useMock) {
            corpusUrl.searchParams.set('mock', 'true')
          }
          searchResponse = await fetch(corpusUrl.toString(), {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          })
        } else if (paper.title) {
          // Use title
          const searchUrl = new URL('/api/v1/papers/search', window.location.origin)
          searchUrl.searchParams.set('title', paper.title)
          if (useMock) {
            searchUrl.searchParams.set('mock', 'true')
          }
          searchResponse = await fetch(searchUrl.toString(), {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          })
        } else {
          throw new Error('No corpusId or title available')
        }

        if (!searchResponse.ok) {
          throw new Error('Failed to search paper')
        }

        const searchData: SearchPaperResponse = await searchResponse.json()
        const fullPaperData = searchData.paper

        // NOW: Create the chat with the complete paper data from API
        const chatTitle = fullPaperData.title.length > 50 ? fullPaperData.title.substring(0, 50) + '...' : fullPaperData.title
        const chatResponse = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            title: chatTitle,
            paperData: fullPaperData, // Use the complete paper data from API
            messages: [{
              role: 'assistant',
              content: `Paper: ${fullPaperData.title}\n\nAuthors: ${fullPaperData.authors || 'N/A'}\nYear: ${fullPaperData.year || 'N/A'}\nJournal: ${fullPaperData.journalName || 'N/A'}\n\n${fullPaperData.abstract ? `Abstract: ${fullPaperData.abstract}` : ''}\n\n${fullPaperData.tldr ? `TLDR: ${fullPaperData.tldr}` : ''}`,
              timestamp: new Date(),
            }],
          }),
        })
        
        if (!chatResponse.ok) {
          throw new Error('Failed to create chat')
        }

        const chatData = await chatResponse.json()
        const newChatId = chatData.chat.id

        // Update chat metadata with chatId for proper tracking (this also updates metadata fields)
        // This ensures the paper is properly associated with this chat in the metadata
        if (fullPaperData.id) {
          const metadataUrl = new URL(`/api/v1/papers/${fullPaperData.id}`, window.location.origin)
          metadataUrl.searchParams.set('chatId', newChatId)
          if (useMock) {
            metadataUrl.searchParams.set('mock', 'true')
          }
          await fetch(metadataUrl.toString(), {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }).catch(() => {
            // Ignore errors, metadata update is optional
          })
        }

        // Add search result as assistant message
        const searchMessage = {
          role: 'assistant' as const,
          content: `Found paper: ${fullPaperData.title}\n\nAuthors: ${fullPaperData.authors}\nYear: ${fullPaperData.year || 'N/A'}\nCitations: ${fullPaperData.impactFactor?.citationCount || 0}\n\n${fullPaperData.abstract || fullPaperData.tldr || ''}`,
          timestamp: new Date(),
          papers: [fullPaperData],
        }

        await fetch(`/api/chats/${newChatId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [searchMessage],
          }),
        })

        // Verify chat was created with paperData before switching
        // This ensures the chat has the correct data when PaperChatView loads
        try {
          const verifyResponse = await fetch(`/api/chats/${newChatId}`)
          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json()
            // Ensure paperData is set in chatMetadata
            if (!verifyData.chat?.chatMetadata?.paperData) {
              // If paperData is missing, update it (preserve existing chatStore)
              const existingMetadata = verifyData.chat?.chatMetadata || {}
              await fetch(`/api/chats/${newChatId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chatMetadata: {
                    ...existingMetadata,
                    paperData: fullPaperData,
                    // Ensure chatStore is initialized if it doesn't exist
                    chatStore: existingMetadata.chatStore || {
                      [fullPaperData.abstract || fullPaperData.title]: {
                        heading: fullPaperData.abstract || fullPaperData.title,
                        paper: fullPaperData,
                        similarPapers: [],
                        apiResponse: { paper: fullPaperData },
                      },
                    },
                  },
                }),
              })
            }
          }
        } catch (error) {
          console.error('Error verifying chat data:', error)
          // Continue anyway - the chat should have paperData from creation
        }

        // NOW switch to the chat - it already has the correct paperData from the start
        onSelectChat(newChatId)

        // Automatically call corpus API after search succeeds
        if (fullPaperData?.id) {
          try {
            const corpusResponse = await fetch('/api/paper/corpus', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                corpusId: fullPaperData.id,
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


  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto w-full p-8 space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <FileText className="h-10 w-10 text-[#22c55e]" />
              <h1 className="text-4xl font-semibold text-foreground">Paper Search</h1>
            </div>
            <p className="text-muted-foreground text-lg">Search for academic papers by title or corpus ID</p>
          </div>

          {/* Hint Box */}
          {projectId && !chatId && (
            <div className="bg-[#22c55e]/20 border border-[#22c55e]/30 rounded-lg p-4 flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-[#22c55e] flex-shrink-0" />
              <p className="text-sm text-foreground">Click on any paper to open a chat window</p>
            </div>
          )}

          <div className="space-y-6">

            {/* Search Forms */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Title Search */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <FileText className="h-5 w-5 text-[#22c55e]" />
                    Search by Title
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Find papers by entering the paper title
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleTitleSearch} className="space-y-4">
                    <Input
                      type="text"
                      placeholder="Enter paper title..."
                      value={titleQuery}
                      onChange={(e) => setTitleQuery(e.target.value)}
                      disabled={loading}
                      className="bg-background border-border text-foreground"
                    />
                    <Button
                      type="submit"
                      disabled={loading || !titleQuery.trim()}
                      className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white"
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
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Search className="h-5 w-5 text-[#22c55e]" />
                    Search by Corpus ID
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Find papers by entering the corpus ID
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCorpusIdSearch} className="space-y-4">
                    <Input
                      type="text"
                      placeholder="Enter corpus ID (e.g., corpus:12345678)"
                      value={corpusIdQuery}
                      onChange={(e) => setCorpusIdQuery(e.target.value)}
                      disabled={loading}
                      className="bg-background border-border text-foreground"
                    />
                    <Button
                      type="submit"
                      disabled={loading || !corpusIdQuery.trim()}
                      className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white"
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
                  <Button
                    asChild
                    className="bg-[#22c55e] hover:bg-[#16a34a] text-black px-4 py-2"
                  >
                    <a
                      href={searchResult.paper.pdfLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View PDF
                    </a>
                  </Button>
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
                                {(paper.score < 1 ? paper.score * 100 : paper.score > 100 ? paper.score / 100 : paper.score).toFixed(2)}% similar
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
                onCreateChatFromNode={onCreateChatFromNode}
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
      </div>


      {/* Loading Overlay */}
      <LoadingOverlay
        show={loadingCitationNetwork}
        message="Generating citation network..."
      />
    </div>
  )
}

