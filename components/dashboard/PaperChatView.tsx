'use client'

import { useState, useEffect, ReactNode } from 'react'
import { ExternalLink, FileText, GitBranch, Network, Search, Loader2, ShieldCheck, Sparkles, Bookmark, BookmarkCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KeywordSelectionPanel } from './KeywordSelectionPanel'
import { PaperAccordion } from './PaperAccordion'
import { CitationTree } from './CitationTree'
import { SearchLoadingSkeleton } from './SearchLoadingSkeleton'
import { VeritusPaper } from '@/types/veritus'
import { CitationNetworkResponse } from '@/types/paper-api'
import { NodeTransferPayload } from '@/types/graph-node'

interface PaperChatViewProps {
  chatId: string
  projectId: string
  chatDepth?: number
  onCreateChatFromNode?: (
    paper: VeritusPaper, 
    selectedFields?: Map<string, string>,
    nodeContext?: NodeTransferPayload
  ) => Promise<string | null>
}

const formatDate = (value?: string | null) => {
  if (!value) return 'Not available'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 'Not available'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

const MetaItem = ({ label, value, fullSpan = false }: { label: string; value: ReactNode; fullSpan?: boolean }) => (
  <div
    className={`rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm ${
      fullSpan ? 'md:col-span-2' : ''
    }`}
  >
    <p className="text-[11px] uppercase tracking-[0.1em] text-slate-400">{label}</p>
    <div className="mt-1 text-sm text-slate-50 break-words">{value}</div>
  </div>
)

const ImpactItem = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
    <p className="text-[11px] uppercase tracking-[0.1em] text-slate-400">{label}</p>
    <p className="mt-1 text-base font-semibold text-white">{value}</p>
  </div>
)

const AccessCard = ({
  label,
  href,
  icon,
  buttonLabel,
  available,
}: {
  label: string
  href?: string | null
  icon: ReactNode
  buttonLabel: string
  available: boolean
}) => {
  const isDisabled = !available

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-xs text-slate-400 break-all">{available && href ? href : 'Not available'}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-start gap-2">
        <Button
          asChild={available}
          disabled={!available}
          className={available 
            ? "bg-[#22c55e] hover:bg-[#16a34a] text-black px-4 py-2 w-full" 
            : "bg-gray-600 text-gray-400 cursor-not-allowed px-4 py-2 w-full"
          }
        >
          {available ? (
            <a href={href!} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
              {buttonLabel}
            </a>
          ) : (
            <span className="flex items-center justify-center">{buttonLabel}</span>
          )}
        </Button>
      </div>
    </div>
  )
}

export function PaperChatView({
  chatId,
  projectId,
  chatDepth = 100,
  onCreateChatFromNode,
}: PaperChatViewProps) {
  const [paperData, setPaperData] = useState<any>(null)
  const [searchResults, setSearchResults] = useState<VeritusPaper[]>([])
  const [hasSearchResults, setHasSearchResults] = useState(false)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [loadingCitationNetwork, setLoadingCitationNetwork] = useState(false)
  const [showKeywordSelectionPanel, setShowKeywordSelectionPanel] = useState(false)
  const [citationNetworkResponse, setCitationNetworkResponse] = useState<CitationNetworkResponse | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isBookmarking, setIsBookmarking] = useState(false)
  const [bookmarks, setBookmarks] = useState<any[]>([])

  const fetchBookmarks = async (paperId?: string) => {
    try {
      const response = await fetch('/api/bookmarks')
      if (response.ok) {
        const data = await response.json()
        setBookmarks(data.bookmarks || [])
        if (paperId) {
          setIsBookmarked(data.bookmarks?.some((b: any) => b.paperId === paperId) || false)
        }
      }
    } catch (error) {
      console.error('Error fetching bookmarks:', error)
    }
  }

  const handleBookmark = async () => {
    if (!paperData || isBookmarking) return

    setIsBookmarking(true)
    try {
      if (isBookmarked) {
        // Remove bookmark
        const response = await fetch(`/api/bookmarks?paperId=${paperData.id}`, {
          method: 'DELETE',
        })
        if (response.ok) {
          setIsBookmarked(false)
          setBookmarks(bookmarks.filter((b) => b.paperId !== paperData.id))
        }
      } else {
        // Add bookmark
        const response = await fetch('/api/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paperId: paperData.id,
            paper: paperData,
          }),
        })
        if (response.ok) {
          const data = await response.json()
          setIsBookmarked(true)
          setBookmarks([...bookmarks, data.bookmark])
        }
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error)
    } finally {
      setIsBookmarking(false)
    }
  }

  useEffect(() => {
    // Reset all state when chatId changes to ensure clean state for new chats
    setSearchResults([])
    setHasSearchResults(false)
    setCitationNetworkResponse(null)
    setLoadingSearch(false)
    setLoadingCitationNetwork(false)
    
    // Load chat data to get paperData only (initial paper from which chat started)
    const loadChatData = async () => {
      try {
        const response = await fetch(`/api/chats/${chatId}`)
        if (response.ok) {
          const data = await response.json()
          
          // Only load the initial paperData from chatMetadata (the paper that started this chat)
          if (data.chat?.chatMetadata?.paperData) {
            setPaperData(data.chat.chatMetadata.paperData)
            
            // Fetch bookmarks to check if paper is bookmarked
            fetchBookmarks(data.chat.chatMetadata.paperData.id)
          }
          
          // Load messages but don't auto-populate search results
          // Search results should only appear after user clicks "Search Papers"
          if (data.chat?.messages) {
            setMessages(data.chat.messages)
            
            // IMPORTANT: For new chats created from nodes, we should NOT show search results
            // Only show search results if they were explicitly added via search-papers API
            // AND the message content clearly indicates it's from a search (not initial paper)
            const searchResultMessages = data.chat.messages.filter((msg: any) => {
              // Must have papers array
              if (!msg.papers || !Array.isArray(msg.papers) || msg.papers.length === 0) {
                return false
              }
              
              // Must have content that indicates it's from a search
              if (!msg.content) {
                return false
              }
              
              // Check for explicit search result indicators
              const isSearchResult = 
                msg.content.includes('Found') && 
                msg.content.includes('similar papers') &&
                !msg.content.includes('Root paper:') && // Exclude root paper messages
                !msg.content.startsWith('Paper:') // Exclude initial paper messages
              
              return isSearchResult
            })
            
            // Only set search results if we found explicit search result messages
            // This ensures new chats created from nodes start clean
            if (searchResultMessages.length > 0) {
              // Get papers from the most recent search result message
              const latestSearchMessage = searchResultMessages[searchResultMessages.length - 1]
              const papersFromSearch = latestSearchMessage.papers || []
              if (papersFromSearch.length > 0) {
                setSearchResults(papersFromSearch)
                setHasSearchResults(true)
              }
            } else {
              // Explicitly clear search results for new chats
              setSearchResults([])
              setHasSearchResults(false)
            }
          } else {
            // No messages, ensure clean state
            setSearchResults([])
            setHasSearchResults(false)
          }
        }
      } catch (error) {
        console.error('Error loading chat data:', error)
        // On error, ensure clean state
        setSearchResults([])
        setHasSearchResults(false)
      }
    }
    loadChatData()
  }, [chatId])

  const handleSearchSimilarPapers = async (params: {
    corpusId: string
    jobType: 'keywordSearch' | 'querySearch' | 'combinedSearch'
    keywords?: string[]
    tldrs?: string[]
    authors?: string[]
    references?: string[]
    filters?: {
      fieldsOfStudy?: string[]
      minCitationCount?: number
      openAccessPdf?: boolean
      downloadable?: boolean
      quartileRanking?: string[]
      publicationTypes?: string[]
      sort?: string
      year?: string
      limit?: 100 | 200 | 300
    }
  }) => {
    setLoadingSearch(true)
    setShowKeywordSelectionPanel(false)
    
    try {
      // Build query parameters for job creation
      const queryParams = new URLSearchParams()
      if (params.filters?.limit) {
        queryParams.set('limit', params.filters.limit.toString())
      }
      if (params.filters?.fieldsOfStudy && params.filters.fieldsOfStudy.length > 0) {
        queryParams.set('fieldsOfStudy', params.filters.fieldsOfStudy.join(','))
      }
      if (params.filters?.minCitationCount !== undefined) {
        queryParams.set('minCitationCount', params.filters.minCitationCount.toString())
      }
      if (params.filters?.openAccessPdf !== undefined) {
        queryParams.set('openAccessPdf', params.filters.openAccessPdf.toString())
      }
      if (params.filters?.downloadable !== undefined) {
        queryParams.set('downloadable', params.filters.downloadable.toString())
      }
      if (params.filters?.quartileRanking && params.filters.quartileRanking.length > 0) {
        queryParams.set('quartileRanking', params.filters.quartileRanking.join(','))
      }
      if (params.filters?.publicationTypes && params.filters.publicationTypes.length > 0) {
        queryParams.set('publicationTypes', params.filters.publicationTypes.join(','))
      }
      if (params.filters?.sort) {
        queryParams.set('sort', params.filters.sort)
      }
      if (params.filters?.year) {
        queryParams.set('year', params.filters.year)
      }

      // Build request body based on job type
      const body: any = {}
      if (params.jobType === 'keywordSearch' || params.jobType === 'combinedSearch') {
        if (params.keywords && params.keywords.length > 0) {
          body.phrases = params.keywords
        }
      }
      if (params.jobType === 'querySearch' || params.jobType === 'combinedSearch') {
        if (params.tldrs && params.tldrs.length > 0) {
          body.query = params.tldrs.join(' ')
        }
      }

      // Step 1: Create job
      const createJobResponse = await fetch(`/api/veritus/job/create/${params.jobType}?${queryParams.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!createJobResponse.ok) {
        const errorData = await createJobResponse.json()
        throw new Error(errorData.error || 'Failed to create search job')
      }

      const jobData = await createJobResponse.json()
      const jobId = jobData.jobId

      if (!jobId) {
        throw new Error('No job ID returned from job creation')
      }

      // Step 2: Poll job status (show loading skeleton with quotes)
      let attempts = 0
      const maxAttempts = 30 // 30 attempts * 2 seconds = 60 seconds max
      let jobStatus: any = null
      let papers: VeritusPaper[] = []

      while (attempts < maxAttempts) {
        // Wait 2 seconds before checking status
        await new Promise(resolve => setTimeout(resolve, 2000))

        const statusResponse = await fetch(`/api/veritus/job/${jobId}`)
        if (!statusResponse.ok) {
          throw new Error('Failed to check job status')
        }

        jobStatus = await statusResponse.json()

        if (jobStatus.status === 'success') {
          papers = jobStatus.results || []
          break
        } else if (jobStatus.status === 'error') {
          throw new Error('Job failed')
        }

        attempts++
      }

      if (!papers || papers.length === 0) {
        throw new Error('Search timed out or returned no results')
      }

      // Step 3: Store papers in chat via search-papers API
      const storeBody: any = {
        chatId,
        isMocked: false, // We already got real results
      }
      
      if (params.jobType === 'keywordSearch' || params.jobType === 'combinedSearch') {
        if (params.keywords && params.keywords.length > 0) {
          storeBody.phrases = params.keywords
        }
      }
      if (params.jobType === 'querySearch' || params.jobType === 'combinedSearch') {
        if (params.tldrs && params.tldrs.length > 0) {
          storeBody.query = params.tldrs.join(' ')
        }
      }

      // Add filters for storage
      if (params.filters) {
        if (params.filters.fieldsOfStudy) storeBody.fieldsOfStudy = params.filters.fieldsOfStudy
        if (params.filters.minCitationCount !== undefined) storeBody.minCitationCount = params.filters.minCitationCount
        if (params.filters.openAccessPdf !== undefined) storeBody.openAccessPdf = params.filters.openAccessPdf
        if (params.filters.downloadable !== undefined) storeBody.downloadable = params.filters.downloadable
        if (params.filters.quartileRanking) storeBody.quartileRanking = params.filters.quartileRanking
        if (params.filters.publicationTypes) storeBody.publicationTypes = params.filters.publicationTypes
        if (params.filters.sort) storeBody.sort = params.filters.sort
        if (params.filters.year) storeBody.year = params.filters.year
        if (params.filters.limit) storeBody.limit = params.filters.limit
      }

      // Call search-papers API to store results (it will use the papers we already have)
      // We pass a flag to skip job creation since we already have results
      const storeResponse = await fetch('/api/v1/papers/search-papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...storeBody,
          _skipJobCreation: true, // Internal flag to skip job creation
          _papers: papers, // Pass papers directly
        }),
      })

      // Reload chat to get updated messages with stored papers
      const chatResponse = await fetch(`/api/chats/${chatId}`)
      if (chatResponse.ok) {
        const chatData = await chatResponse.json()
        if (chatData.chat?.messages) {
          setMessages(chatData.chat.messages)
          
          // Only get papers from messages that came from search-papers API
          // Look for messages with "Found X similar papers" content
          const searchResultMessages = chatData.chat.messages.filter((msg: any) => 
            msg.papers && 
            Array.isArray(msg.papers) && 
            msg.papers.length > 0 &&
            msg.content && 
            msg.content.includes('Found') && 
            msg.content.includes('similar papers')
          )
          
          if (searchResultMessages.length > 0) {
            // Get papers from the most recent search result message
            const latestSearchMessage = searchResultMessages[searchResultMessages.length - 1]
            const papersFromSearch = latestSearchMessage.papers || []
            setSearchResults(papersFromSearch)
            setHasSearchResults(papersFromSearch.length > 0)
          } else {
            // Fallback: use papers we got from job
            setSearchResults(papers)
            setHasSearchResults(papers.length > 0)
          }
        }
      }
    } catch (error: any) {
      console.error('Error searching similar papers:', error)
      alert(`Error: ${error.message || 'Failed to search similar papers'}`)
    } finally {
      setLoadingSearch(false)
    }
  }

  const handleGenerateCitationNetwork = async () => {
    if (!chatId || !hasSearchResults) return

    setLoadingCitationNetwork(true)
    try {
      const queryParams = new URLSearchParams()
      queryParams.set('chatId', chatId)

      const response = await fetch(`/api/citation-network?${queryParams.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate citation network')
      }

      const data: CitationNetworkResponse = await response.json()
      setCitationNetworkResponse(data)
    } catch (error: any) {
      console.error('Error generating citation network:', error)
      alert(`Error: ${error.message || 'Failed to generate citation network'}`)
    } finally {
      setLoadingCitationNetwork(false)
    }
  }

  if (!paperData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">No Paper Data</h2>
        <p className="text-muted-foreground mb-6 text-center max-w-md">
          This chat doesn't have paper data. Please select a paper from the Paper Search page to view paper details.
        </p>
        <Button
          onClick={() => {
            // Navigate back to paper search
            window.location.reload()
          }}
          className="bg-[#22c55e] hover:bg-[#16a34a] text-black"
        >
          Go to Paper Search
        </Button>
      </div>
    )
  }

  const pdfAvailable = !!paperData.pdfLink
  const pdfHref = pdfAvailable ? paperData.pdfLink : undefined
  const originalHref = paperData.link || paperData.titleLink || undefined

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Section - Structured Paper Details */}
      <div className="w-1/2 border-r border-white/10 overflow-y-auto bg-[#0c0f14] text-slate-50">
        <div className="p-6 space-y-7">
          {/* Title Section */}
          <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Title</p>
              <Button
                onClick={handleBookmark}
                disabled={isBookmarking}
                variant="outline"
                size="sm"
                className="rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                {isBookmarking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isBookmarked ? (
                  <>
                    <BookmarkCheck className="h-4 w-4 mr-2" />
                    Bookmarked
                  </>
                ) : (
                  <>
                    <Bookmark className="h-4 w-4 mr-2" />
                    Bookmark
                  </>
                )}
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-semibold leading-tight text-white">{paperData.title}</h1>
              <p className="text-base text-slate-200">{formatValue(paperData.authors)}</p>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                <span>{formatValue(paperData.year)}</span>
                <span className="text-slate-600">•</span>
                <span>{paperData.journalName || paperData.v_journal_name || 'Not available'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-100">
                  ID: {paperData.id}
                </Badge>
                <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-100">
                  Engine: {formatValue(paperData.engine)}
                </Badge>
                <Badge
                  variant="outline"
                  className={`border ${paperData.isOpenAccess ? 'border-emerald-400 text-emerald-300' : 'border-white/20 text-slate-100'}`}
                >
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  {paperData.isOpenAccess ? 'Open Access' : 'Closed Access'}
                </Badge>
                <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-100">
                  {paperData.isPrePrint ? 'Pre-Print' : 'Published'}
                </Badge>
                <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-100">
                  Downloadable: {paperData.downloadable ? 'Yes' : 'No'}
                </Badge>
                {paperData.doi && (
                  <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-100">
                    DOI: {paperData.doi}
                  </Badge>
                )}
              </div>
            </div>
          </section>

          {/* TLDR Section */}
          <section className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">TLDR</p>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-200">
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>Key Takeaway</span>
              </div>
              <p className="text-base leading-relaxed text-slate-100">
                {paperData.tldr || 'Not available'}
              </p>
            </div>
          </section>

          {/* Abstract Section */}
          <section className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Abstract</p>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm">
              <p className="text-base leading-relaxed text-slate-100">
                {paperData.abstract || 'Not available'}
              </p>
            </div>
          </section>

          {/* Metadata Box */}
          <section className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Metadata</p>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MetaItem label="Publication Type" value={formatValue(paperData.publicationType)} />
                <MetaItem label="Published Year" value={formatValue(paperData.year)} />
                <MetaItem label="Published Date" value={formatDate(paperData.publishedAt)} />
                <MetaItem label="Journal Name" value={paperData.journalName || 'Not available'} />
                <MetaItem label="Verified Journal Name" value={paperData.v_journal_name || 'Not available'} />
                <MetaItem label="Publisher" value={paperData.v_publisher || 'Not available'} />
                <MetaItem label="Country" value={paperData.v_country || 'Not available'} />
                <MetaItem label="Quartile Ranking" value={paperData.v_quartile_ranking || 'Not available'} />
                <MetaItem label="DOI" value={paperData.doi ? `https://doi.org/${paperData.doi}` : 'Not available'} />
                <MetaItem label="Title Link" value={paperData.titleLink || 'Not available'} />
                <MetaItem
                  label="Fields of Study"
                  fullSpan
                  value={
                    paperData.fieldsOfStudy && paperData.fieldsOfStudy.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {paperData.fieldsOfStudy.map((field: string, idx: number) => (
                          <div key={field} className="flex items-center gap-1">
                            <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-100">
                              {field}
                            </Badge>
                            {idx < paperData.fieldsOfStudy.length - 1 && <span className="text-slate-500">,</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      'Not available'
                    )
                  }
                />
              </div>
            </div>
          </section>

          {/* Impact Metrics Box */}
          <section className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Impact Metrics</p>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ImpactItem label="Citation Count" value={formatValue(paperData.impactFactor?.citationCount)} />
                <ImpactItem label="Influential Citation Count" value={formatValue(paperData.impactFactor?.influentialCitationCount)} />
                <ImpactItem label="Reference Count" value={formatValue(paperData.impactFactor?.referenceCount)} />
                <ImpactItem label="Score" value={paperData.score ?? 'Not available'} />
              </div>
            </div>
          </section>

          {/* Access & External Links Box */}
          <section className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Access & External Links</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-fr">
              <AccessCard
                label="PDF"
                href={pdfHref}
                icon={<FileText className="h-5 w-5" />}
                buttonLabel="View PDF"
                available={pdfAvailable}
              />
              <AccessCard
                label="Semantic Scholar Page"
                href={paperData.semanticLink}
                icon={<GitBranch className="h-5 w-5" />}
                buttonLabel="Semantic Scholar Page"
                available={!!paperData.semanticLink}
              />
              <AccessCard
                label="Original Paper Link"
                href={originalHref}
                icon={<ExternalLink className="h-5 w-5" />}
                buttonLabel="Original Paper Link"
                available={!!originalHref}
              />
            </div>
          </section>
        </div>
      </div>

      {/* Right Section - Actions & Results */}
      <div className="w-1/2 overflow-y-auto bg-background">
        <div className="p-6 space-y-6">
          {/* Empty State - Description */}
          {!hasSearchResults && (
            <div className="text-center space-y-4 py-8">
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold text-foreground">Discover Similar Papers</h2>
                <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Use the <strong className="text-foreground">Search Papers</strong> button below to find similar research papers based on keywords, authors, TLDR summaries, and other criteria from your current paper.
                </p>
                <p className="text-muted-foreground max-w-md mx-auto leading-relaxed text-sm">
                  Our advanced search will help you discover papers that share similar topics, methodologies, or research directions.
                </p>
              </div>
            </div>
          )}

          {/* Search Papers Button */}
          <div className="flex justify-center">
            <Button
              onClick={() => setShowKeywordSelectionPanel(true)}
              disabled={loadingSearch}
              className="bg-[#22c55e] hover:bg-[#16a34a] text-black px-4 py-2"
            >
              {loadingSearch ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search Papers
                </>
              )}
            </Button>
          </div>

          {/* Citation Network Info */}
          {!hasSearchResults && (
            <div className="text-center space-y-2 py-4">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Network className="h-5 w-5 text-green-500" />
                <p className="text-sm">
                  After finding similar papers, you can generate a <strong className="text-foreground">Citation Network Visualization</strong> to explore relationships between papers
                </p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loadingSearch && (
            <SearchLoadingSkeleton message="Searching for similar papers..." />
          )}

          {/* Search Results */}
          {hasSearchResults && !loadingSearch && (
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Found {searchResults.length} similar papers
              </h2>
              <PaperAccordion papers={searchResults} />
            </div>
          )}

          {/* Citation Graph Button - Only show after user has searched */}
          {hasSearchResults && searchResults.length > 0 && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={handleGenerateCitationNetwork}
                disabled={loadingCitationNetwork || !hasSearchResults}
                className="bg-[#22c55e] hover:bg-[#16a34a] text-black px-4 py-2"
              >
                {loadingCitationNetwork ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Network className="mr-2 h-4 w-4" />
                    Generate Citation Network
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Citation Network Display - Only show after user clicks "Generate Citation Network" */}
          {citationNetworkResponse && hasSearchResults && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
              <h2 className="text-xl font-semibold text-foreground mb-4">Citation Network</h2>
              <div className="pt-2">
                <CitationTree
                  citationNetworkResponse={citationNetworkResponse}
                  chatId={chatId}
                  messages={messages}
                  onCreateChatFromNode={onCreateChatFromNode}
                  onExpandNode={async () => null}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keyword Selection Panel */}
      {paperData.id && (
        <KeywordSelectionPanel
          open={showKeywordSelectionPanel}
          onOpenChange={setShowKeywordSelectionPanel}
          corpusId={paperData.id}
          messages={messages}
          chatId={chatId}
          depth={chatDepth}
          onSearch={handleSearchSimilarPapers}
        />
      )}
    </div>
  )
}
