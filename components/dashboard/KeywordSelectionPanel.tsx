'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Plus, RefreshCw, Hash, Users, BookOpen, FileText, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { VeritusPaper } from '@/types/veritus'
import { useChatPaperStorage } from '@/lib/hooks/use-chat-paper-storage'
import { toast } from '@/lib/utils/toast'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  papers?: VeritusPaper[]
  citationNetwork?: any
}

interface KeywordSelectionPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  corpusId: string
  messages: Message[]
  chatId?: string | null
  depth?: number // Chat depth for limit parameter
  initialSuggestions?: {
    keywords?: string[]
    authors?: string[]
    references?: string[]
    tldrs?: string[]
  } // Initial suggestions from current node and parent nodes
  onSearch: (params: {
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
  }) => void
}

const VALID_FIELDS_OF_STUDY = [
  'Computer Science', 'Medicine', 'Chemistry', 'Biology', 'Materials Science',
  'Physics', 'Geology', 'Psychology', 'Art', 'History', 'Geography',
  'Sociology', 'Business', 'Political Science', 'Economics', 'Philosophy',
  'Mathematics', 'Engineering', 'Environmental Science',
  'Agricultural and Food Sciences', 'Education', 'Law', 'Linguistics'
]

const VALID_QUARTILE_RANKINGS = ['Q1', 'Q2', 'Q3', 'Q4']
const VALID_PUBLICATION_TYPES = ['journal', 'book series', 'conference']
const VALID_SORT_FIELDS = ['score', 'citationCount', 'influentialCitationCount', 'quartileRanking', 'referenceCount', 'year']
const VALID_SORT_DIRECTIONS = ['asc', 'desc']

export function KeywordSelectionPanel({
  open,
  onOpenChange,
  corpusId,
  messages,
  chatId,
  depth = 100,
  initialSuggestions,
  onSearch,
}: KeywordSelectionPanelProps) {
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [selectedTLDRs, setSelectedTLDRs] = useState<string[]>([])
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([])
  const [selectedReferences, setSelectedReferences] = useState<string[]>([])
  const [customKeyword, setCustomKeyword] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  
  // Filter states
  const [selectedFieldsOfStudy, setSelectedFieldsOfStudy] = useState<string[]>([])
  const [minCitationCount, setMinCitationCount] = useState<string>('')
  const [openAccessPdf, setOpenAccessPdf] = useState<boolean | undefined>(undefined)
  const [downloadable, setDownloadable] = useState<boolean | undefined>(undefined)
  const [selectedQuartileRankings, setSelectedQuartileRankings] = useState<string[]>([])
  const [selectedPublicationTypes, setSelectedPublicationTypes] = useState<string[]>([])
  const [sortField, setSortField] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<string>('desc')
  const [yearFilter, setYearFilter] = useState<string>('')

  // State to store root paper from chat store
  const [rootPaper, setRootPaper] = useState<VeritusPaper | null>(null)
  const [isLoadingRootPaper, setIsLoadingRootPaper] = useState(false)

  // Fetch root paper from chat store when dialog opens
  useEffect(() => {
    const fetchRootPaper = async () => {
      if (!open || !chatId) {
        setRootPaper(null)
        return
      }

      setIsLoadingRootPaper(true)
      try {
        const response = await fetch(`/api/chats/${chatId}`)
        if (response.ok) {
          const data = await response.json()
          const chat = data.chat

          // Get root paper from chatMetadata.paperData (the paper from Stage 2)
          if (chat?.chatMetadata?.paperData) {
            setRootPaper(chat.chatMetadata.paperData)
          } else if (messages && messages.length > 0) {
            // Fallback: get from first message's papers
            const firstMessage = messages[0]
            if (firstMessage?.papers && firstMessage.papers.length > 0) {
              setRootPaper(firstMessage.papers[0])
            }
          }
        }
      } catch (error) {
        console.error('Error fetching root paper:', error)
      } finally {
        setIsLoadingRootPaper(false)
      }
    }

    fetchRootPaper()
  }, [open, chatId, messages])

  // Extract suggested keywords, authors, references, TLDRs, and years from current + parent nodes (initialSuggestions)
  // Priority: initialSuggestions (current + parent nodes) > rootPaper (fallback only)
  const { suggestedKeywords, suggestedAuthors, suggestedReferences, suggestedTLDRs, suggestedYears, suggestedJournals } = useMemo(() => {
    const keywords: string[] = []
    const authors: string[] = []
    const references: string[] = []
    const tldrs: string[] = []
    const years: number[] = []
    const journals: string[] = []

    // PRIMARY SOURCE: initialSuggestions from current node and parent nodes (from chatstore)
    // This is the main source - it contains data from current + parent nodes
    if (initialSuggestions) {
      if (initialSuggestions.keywords) {
        initialSuggestions.keywords.forEach(kw => {
          if (kw && !keywords.includes(kw)) keywords.push(kw)
        })
      }
      if (initialSuggestions.authors) {
        initialSuggestions.authors.forEach(author => {
          if (author && !authors.includes(author)) authors.push(author)
        })
      }
      if (initialSuggestions.references) {
        initialSuggestions.references.forEach(ref => {
          if (ref && !references.includes(ref)) references.push(ref)
        })
      }
      if (initialSuggestions.tldrs) {
        initialSuggestions.tldrs.forEach(tldr => {
          if (tldr && !tldrs.includes(tldr)) tldrs.push(tldr)
        })
      }
    }

    // FALLBACK ONLY: Extract from root paper ONLY if initialSuggestions is empty/missing
    // This ensures we prioritize current + parent node data over root paper
    if (rootPaper && (!initialSuggestions || 
        (!initialSuggestions.keywords?.length && !initialSuggestions.authors?.length && 
         !initialSuggestions.references?.length && !initialSuggestions.tldrs?.length))) {
      // Extract from fieldsOfStudy
      if (rootPaper.fieldsOfStudy && Array.isArray(rootPaper.fieldsOfStudy)) {
        rootPaper.fieldsOfStudy.forEach((field: string) => {
          if (field && !keywords.includes(field)) {
            keywords.push(field)
          }
        })
      }

      // Extract from journalName
      if (rootPaper.journalName && !journals.includes(rootPaper.journalName)) {
        journals.push(rootPaper.journalName)
      }

      // Extract from publicationType
      if (rootPaper.publicationType && !keywords.includes(rootPaper.publicationType)) {
        keywords.push(rootPaper.publicationType)
      }

      // Extract authors
      if (rootPaper.authors) {
        const authorList = rootPaper.authors.split(',').map((a: string) => a.trim()).filter(Boolean)
        authorList.forEach((author: string) => {
          if (author && !authors.includes(author)) {
            authors.push(author)
          }
        })
      }

      // Extract title as reference
      if (rootPaper.title && !rootPaper.title.startsWith('corpus:')) {
        references.push(rootPaper.title)
      }

      // Extract TLDR
      if (rootPaper.tldr && rootPaper.tldr.trim()) {
        tldrs.push(rootPaper.tldr.trim())
      }

      // Extract year
      if (rootPaper.year && typeof rootPaper.year === 'number') {
        years.push(rootPaper.year)
      }
    }

    return {
      suggestedKeywords: keywords.sort(),
      suggestedAuthors: authors.sort(),
      suggestedReferences: references.sort(),
      suggestedTLDRs: tldrs,
      suggestedYears: years.sort((a, b) => b - a), // Sort descending
      suggestedJournals: journals.sort(),
    }
  }, [rootPaper, initialSuggestions])

  // Determine job type based on selections
  const jobType = useMemo(() => {
    const hasKeywords = selectedKeywords.length > 0
    const hasTLDRs = selectedTLDRs.length > 0

    if (hasTLDRs && hasKeywords) {
      return 'combinedSearch'
    } else if (hasTLDRs) {
      return 'querySearch'
    } else if (hasKeywords) {
      return 'keywordSearch'
    }
    return null
  }, [selectedKeywords, selectedTLDRs])

  // Calculate limit from depth
  const limit = useMemo(() => {
    if (depth <= 100) return 100
    if (depth <= 200) return 200
    return 300
  }, [depth])

  const handleToggleKeyword = (keyword: string) => {
    if (selectedKeywords.includes(keyword)) {
      setSelectedKeywords(selectedKeywords.filter(k => k !== keyword))
    } else {
      // Maximum 2 keywords allowed
      if (selectedKeywords.length >= 2) {
        toast.warning('Keyword limit reached', 'Please select only two keywords before continuing.')
        return
      }
      setSelectedKeywords([...selectedKeywords, keyword])
    }
  }

  const handleToggleTLDR = (tldr: string) => {
    if (selectedTLDRs.includes(tldr)) {
      setSelectedTLDRs(selectedTLDRs.filter(t => t !== tldr))
    } else {
      setSelectedTLDRs([...selectedTLDRs, tldr])
    }
  }

  const handleToggleAuthor = (author: string) => {
    if (selectedAuthors.includes(author)) {
      setSelectedAuthors(selectedAuthors.filter(a => a !== author))
    } else {
      setSelectedAuthors([...selectedAuthors, author])
    }
  }

  const handleToggleReference = (ref: string) => {
    if (selectedReferences.includes(ref)) {
      setSelectedReferences(selectedReferences.filter(r => r !== ref))
    } else {
      setSelectedReferences([...selectedReferences, ref])
    }
  }

  const handleAddCustomKeyword = () => {
    if (customKeyword.trim() && !selectedKeywords.includes(customKeyword.trim())) {
      // Maximum 2 keywords allowed
      if (selectedKeywords.length >= 2) {
        toast.warning('Keyword limit reached', 'Please select only two keywords before continuing.')
        setCustomKeyword('')
        return
      }
      setSelectedKeywords([...selectedKeywords, customKeyword.trim()])
      setCustomKeyword('')
    }
  }

  const handleToggleFieldOfStudy = (field: string) => {
    if (selectedFieldsOfStudy.includes(field)) {
      setSelectedFieldsOfStudy(selectedFieldsOfStudy.filter(f => f !== field))
    } else {
      setSelectedFieldsOfStudy([...selectedFieldsOfStudy, field])
    }
  }

  const handleToggleQuartileRanking = (quartile: string) => {
    if (selectedQuartileRankings.includes(quartile)) {
      setSelectedQuartileRankings(selectedQuartileRankings.filter(q => q !== quartile))
    } else {
      setSelectedQuartileRankings([...selectedQuartileRankings, quartile])
    }
  }

  const handleTogglePublicationType = (type: string) => {
    if (selectedPublicationTypes.includes(type)) {
      setSelectedPublicationTypes(selectedPublicationTypes.filter(t => t !== type))
    } else {
      setSelectedPublicationTypes([...selectedPublicationTypes, type])
    }
  }

  const handleSearch = () => {
    if (!jobType) {
      toast.warning('Invalid selection', 'Please select at least keywords (max 2) or TLDRs (50-5000 characters)')
      return
    }

    // Validate keyword limit: maximum 2 keywords allowed
    if (selectedKeywords.length > 2) {
      toast.warning('Too many keywords', 'Please select only two keywords before continuing.')
      return
    }

    // Validate keywordSearch: need 1-2 keywords
    if (jobType === 'keywordSearch' && selectedKeywords.length === 0) {
      toast.warning('No keywords selected', 'Please select at least one keyword for keywordSearch')
      return
    }

    // Validate querySearch: need 50-5000 characters in query
    if (jobType === 'querySearch' && selectedTLDRs.length > 0) {
      const queryLength = selectedTLDRs.join(' ').length
      if (queryLength < 50 || queryLength > 5000) {
        toast.warning('Invalid query length', `querySearch requires 50-5000 characters in query. Your query has ${queryLength} characters.`)
        return
      }
    }

    // Validate combinedSearch: need both valid keywords and query
    if (jobType === 'combinedSearch') {
      if (selectedKeywords.length === 0) {
        toast.warning('No keywords selected', 'Please select at least one keyword for combinedSearch')
        return
      }
      if (selectedKeywords.length > 2) {
        toast.warning('Too many keywords', 'Please select only two keywords before continuing.')
        return
      }
      if (selectedTLDRs.length === 0) {
        toast.warning('Missing TLDR', 'combinedSearch requires at least one TLDR to create a query string.')
        return
      }
      const queryLength = selectedTLDRs.join(' ').length
      if (queryLength < 50 || queryLength > 5000) {
        toast.warning('Invalid query length', `combinedSearch requires 50-5000 characters in query. Your query has ${queryLength} characters.`)
        return
      }
    }

    const filters: any = {}
    if (selectedFieldsOfStudy.length > 0) {
      filters.fieldsOfStudy = selectedFieldsOfStudy
    }
    if (minCitationCount) {
      const count = parseInt(minCitationCount)
      if (!isNaN(count) && count > 0) {
        filters.minCitationCount = count
      }
    }
    if (openAccessPdf !== undefined) {
      filters.openAccessPdf = openAccessPdf
    }
    if (downloadable !== undefined) {
      filters.downloadable = downloadable
    }
    if (selectedQuartileRankings.length > 0) {
      filters.quartileRanking = selectedQuartileRankings
    }
    if (selectedPublicationTypes.length > 0) {
      filters.publicationTypes = selectedPublicationTypes
    }
    if (sortField && sortDirection) {
      filters.sort = `${sortField}:${sortDirection}`
    }
    if (yearFilter) {
      filters.year = yearFilter
    }
    filters.limit = limit

    onSearch({
      corpusId,
      jobType,
      keywords: selectedKeywords.length > 0 ? selectedKeywords : undefined,
      tldrs: selectedTLDRs.length > 0 ? selectedTLDRs : undefined,
      authors: selectedAuthors.length > 0 ? selectedAuthors : undefined,
      references: selectedReferences.length > 0 ? selectedReferences : undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1f1f1f] border-[#2a2a2a] text-white max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle className="text-white text-2xl flex items-center gap-2">
            <Hash className="h-6 w-6 text-[#22c55e]" />
            Search Similar Papers
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Configure parameters for paper search. Select keywords, TLDRs, authors, and references from previous responses.
          </DialogDescription>
        </DialogHeader>
        
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-4">
          <div className="space-y-6 py-4">
          {/* Corpus ID */}
          <div>
            <Label className="text-white mb-2 block">Corpus ID</Label>
            <div className="bg-[#171717] border border-[#2a2a2a] rounded-md p-3 text-gray-300 font-mono text-sm">
              corpus:{corpusId}
            </div>
          </div>

          {/* Job Type Display */}
          {jobType && (
            <div className="bg-[#171717] border border-[#22c55e] rounded-md p-3">
              <p className="text-sm text-gray-300 mb-1">
                <span className="text-[#22c55e] font-medium">Job Type:</span> {jobType}
              </p>
              <p className="text-xs text-gray-400">
                {jobType === 'combinedSearch' && 'Search using both phrases (keywords) and query string (TLDR)'}
                {jobType === 'querySearch' && 'Search using a query string (TLDR) - requires 50-5000 characters'}
                {jobType === 'keywordSearch' && 'Search using phrases (keywords) - maximum 2 keywords allowed'}
              </p>
              {jobType === 'keywordSearch' && selectedKeywords.length > 0 && (
                <p className={`text-xs mt-1 ${selectedKeywords.length <= 2 ? 'text-green-400' : 'text-yellow-400'}`}>
                  Keywords selected: {selectedKeywords.length} {selectedKeywords.length > 2 ? '(max 2)' : '(valid)'}
                </p>
              )}
              {jobType === 'querySearch' && selectedTLDRs.length > 0 && (
                <p className={`text-xs mt-1 ${selectedTLDRs.join(' ').length >= 50 && selectedTLDRs.join(' ').length <= 5000 ? 'text-green-400' : 'text-yellow-400'}`}>
                  Query length: {selectedTLDRs.join(' ').length} characters {selectedTLDRs.join(' ').length < 50 ? '(need at least 50)' : selectedTLDRs.join(' ').length > 5000 ? '(max 5000)' : '(valid)'}
                </p>
              )}
              {jobType === 'combinedSearch' && (
                <>
                  {selectedKeywords.length > 0 && (
                    <p className={`text-xs mt-1 ${selectedKeywords.length <= 2 ? 'text-green-400' : 'text-yellow-400'}`}>
                      Keywords: {selectedKeywords.length} {selectedKeywords.length > 2 ? '(max 2)' : '(valid)'}
                    </p>
                  )}
                  {selectedTLDRs.length > 0 && (
                    <p className={`text-xs mt-1 ${selectedTLDRs.join(' ').length >= 50 && selectedTLDRs.join(' ').length <= 5000 ? 'text-green-400' : 'text-yellow-400'}`}>
                      Query: {selectedTLDRs.join(' ').length} chars {selectedTLDRs.join(' ').length < 50 ? '(need at least 50)' : selectedTLDRs.join(' ').length > 5000 ? '(max 5000)' : '(valid)'}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Keywords Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-white text-base font-medium flex items-center gap-2">
                <Hash className="h-4 w-4 text-[#22c55e]" />
                Keywords
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {initialSuggestions && (initialSuggestions.keywords?.length || initialSuggestions.authors?.length || initialSuggestions.references?.length || initialSuggestions.tldrs?.length) 
                    ? 'From chat store (current + parent nodes)' 
                    : isLoadingRootPaper 
                      ? 'Loading...' 
                      : 'No suggestions available'}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              Select keywords from current and parent nodes in chat store or add custom ones (maximum 2 keywords)
            </p>
            
            {/* Selected Keywords */}
            {selectedKeywords.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 overflow-x-hidden">
                {selectedKeywords.map((keyword) => (
                  <Badge
                    key={keyword}
                    variant="secondary"
                    className="bg-[#22c55e] text-black hover:bg-[#16a34a] cursor-pointer max-w-full flex items-center gap-1"
                    onClick={() => handleToggleKeyword(keyword)}
                  >
                    <span className="truncate flex-1 min-w-0">{keyword}</span>
                    <X className="h-3 w-3 flex-shrink-0" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Suggested Keywords */}
            {suggestedKeywords.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-2">Suggested from chat store (current + parent nodes):</p>
                <div className="flex flex-wrap gap-2 overflow-x-hidden">
                  {suggestedKeywords.map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="outline"
                      className={`cursor-pointer border-[#2a2a2a] hover:border-[#22c55e] max-w-full ${
                        selectedKeywords.includes(keyword)
                          ? 'bg-[#22c55e] text-black border-[#22c55e]'
                          : 'text-gray-300 hover:text-white'
                      }`}
                      onClick={() => handleToggleKeyword(keyword)}
                    >
                      <span className="truncate block max-w-[200px]">{keyword}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Add Custom Keyword */}
            <div className="flex gap-2">
              <Input
                placeholder={selectedKeywords.length >= 2 ? "Maximum 2 keywords reached" : "Type keyword and press Enter (enter any two)"}
                value={customKeyword}
                onChange={(e) => setCustomKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCustomKeyword()
                  }
                }}
                disabled={selectedKeywords.length >= 2}
                className="bg-[#171717] border-[#2a2a2a] text-white placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <Button
                disabled={selectedKeywords.length >= 2 || !customKeyword.trim()}
                onClick={handleAddCustomKeyword}
                className="bg-[#22c55e] hover:bg-[#16a34a] text-black"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* TLDR Section */}
          <div>
            <Label className="text-white text-base font-medium flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-[#22c55e]" />
              TLDR
            </Label>
            <p className="text-sm text-gray-400 mb-3">
              Select TLDR summary from current and parent nodes in chat store
            </p>
            
            {/* Selected TLDRs */}
            {selectedTLDRs.length > 0 && (
              <div className="flex flex-col gap-2 mb-3 overflow-x-hidden">
                {selectedTLDRs.map((tldr) => (
                  <Badge
                    key={tldr}
                    variant="secondary"
                    className="bg-[#22c55e] text-black hover:bg-[#16a34a] cursor-pointer justify-start text-left p-2 w-full max-w-full"
                    onClick={() => handleToggleTLDR(tldr)}
                  >
                    <span className="flex-1 truncate min-w-0">{tldr}</span>
                    <X className="ml-2 h-3 w-3 flex-shrink-0" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Suggested TLDRs */}
            {suggestedTLDRs.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Suggested from chat store (current + parent nodes):</p>
                <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                  {suggestedTLDRs.map((tldr) => (
                    <Badge
                      key={tldr}
                      variant="outline"
                      className={`cursor-pointer border-[#2a2a2a] hover:border-[#22c55e] text-left p-2 ${
                        selectedTLDRs.includes(tldr)
                          ? 'bg-[#22c55e] text-black border-[#22c55e]'
                          : 'text-gray-300 hover:text-white'
                      }`}
                      onClick={() => handleToggleTLDR(tldr)}
                    >
                      <span className="line-clamp-2">{tldr}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Authors Section */}
          <div>
            <Label className="text-white text-base font-medium flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-[#22c55e]" />
              Authors
            </Label>
            <p className="text-sm text-gray-400 mb-3">
              Select authors from current and parent nodes in chat store
            </p>
            
            {/* Selected Authors */}
            {selectedAuthors.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 overflow-x-hidden">
                {selectedAuthors.map((author) => (
                  <Badge
                    key={author}
                    variant="secondary"
                    className="bg-[#22c55e] text-black hover:bg-[#16a34a] cursor-pointer max-w-full flex items-center gap-1"
                    onClick={() => handleToggleAuthor(author)}
                  >
                    <span className="truncate flex-1 min-w-0">{author}</span>
                    <X className="h-3 w-3 flex-shrink-0" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Suggested Authors */}
            {suggestedAuthors.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Suggested from chat store (current + parent nodes):</p>
                <div className="flex flex-wrap gap-2 overflow-x-hidden">
                  {suggestedAuthors.map((author) => (
                    <Badge
                      key={author}
                      variant="outline"
                      className={`cursor-pointer border-[#2a2a2a] hover:border-[#22c55e] max-w-full ${
                        selectedAuthors.includes(author)
                          ? 'bg-[#22c55e] text-black border-[#22c55e]'
                          : 'text-gray-300 hover:text-white'
                      }`}
                      onClick={() => handleToggleAuthor(author)}
                    >
                      <span className="truncate block max-w-[200px]">{author}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* References Section */}
          <div>
            <Label className="text-white text-base font-medium flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-[#22c55e]" />
              References
            </Label>
            <p className="text-sm text-gray-400 mb-3">
              Select paper title from current and parent nodes in chat store
            </p>
            
            {/* Selected References */}
            {selectedReferences.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 overflow-x-hidden">
                {selectedReferences.map((ref) => (
                  <Badge
                    key={ref}
                    variant="secondary"
                    className="bg-[#22c55e] text-black hover:bg-[#16a34a] cursor-pointer max-w-full flex items-center gap-1"
                    onClick={() => handleToggleReference(ref)}
                  >
                    <span className="truncate flex-1 min-w-0">{ref}</span>
                    <X className="h-3 w-3 flex-shrink-0" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Suggested References */}
            {suggestedReferences.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Suggested from chat store (current + parent nodes):</p>
                <div className="flex flex-wrap gap-2 overflow-x-hidden">
                  {suggestedReferences.map((ref) => (
                    <Badge
                      key={ref}
                      variant="outline"
                      className={`cursor-pointer border-[#2a2a2a] hover:border-[#22c55e] max-w-full ${
                        selectedReferences.includes(ref)
                          ? 'bg-[#22c55e] text-black border-[#22c55e]'
                          : 'text-gray-300 hover:text-white'
                      }`}
                      onClick={() => handleToggleReference(ref)}
                    >
                      <span className="truncate block max-w-[200px]">{ref}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Filters Section */}
          <div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="w-full border-[#2a2a2a] text-gray-300 hover:text-white justify-between"
            >
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span>Filters</span>
              </div>
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {showFilters && (
              <div className="mt-4 space-y-4 p-4 bg-[#171717] border border-[#2a2a2a] rounded-md">
                {/* Fields of Study - Dropdown */}
                <div>
                  <Label className="text-white text-sm mb-2 block">Fields of Study (Optional)</Label>
                  <Select 
                    value={selectedFieldsOfStudy.length > 0 ? selectedFieldsOfStudy[0] : ''} 
                    onValueChange={(value) => {
                      if (value && !selectedFieldsOfStudy.includes(value)) {
                        setSelectedFieldsOfStudy([...selectedFieldsOfStudy, value])
                      }
                    }}
                  >
                    <SelectTrigger className="bg-[#171717] border-[#2a2a2a] text-white">
                      <SelectValue placeholder="Select field of study" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {VALID_FIELDS_OF_STUDY.map((field) => (
                        <SelectItem 
                          key={field} 
                          value={field}
                          disabled={selectedFieldsOfStudy.includes(field)}
                        >
                          {field}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Show selected fields as removable badges */}
                  {selectedFieldsOfStudy.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 overflow-x-hidden">
                      {selectedFieldsOfStudy.map((field) => (
                        <Badge
                          key={field}
                          variant="secondary"
                          className="bg-[#22c55e] text-black hover:bg-[#16a34a] cursor-pointer max-w-full flex items-center gap-1"
                          onClick={() => handleToggleFieldOfStudy(field)}
                        >
                          <span className="truncate flex-1 min-w-0">{field}</span>
                          <X className="h-3 w-3 flex-shrink-0" />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Min Citation Count */}
                <div>
                  <Label className="text-white text-sm mb-2 block">Minimum Citation Count</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 10"
                    value={minCitationCount}
                    onChange={(e) => setMinCitationCount(e.target.value)}
                    className="bg-[#171717] border-[#2a2a2a] text-white"
                  />
                </div>

                {/* Open Access & Downloadable */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="openAccessPdf"
                      checked={openAccessPdf === true}
                      onChange={(e) => setOpenAccessPdf(e.target.checked ? true : undefined)}
                    />
                    <Label htmlFor="openAccessPdf" className="text-white text-sm cursor-pointer">
                      Open Access PDF
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="downloadable"
                      checked={downloadable === true}
                      onChange={(e) => setDownloadable(e.target.checked ? true : undefined)}
                    />
                    <Label htmlFor="downloadable" className="text-white text-sm cursor-pointer">
                      Downloadable
                    </Label>
                  </div>
                </div>

                {/* Quartile Ranking */}
                <div>
                  <Label className="text-white text-sm mb-2 block">Quartile Ranking</Label>
                  <div className="flex flex-wrap gap-2">
                    {VALID_QUARTILE_RANKINGS.map((quartile) => (
                      <Badge
                        key={quartile}
                        variant="outline"
                        className={`cursor-pointer border-[#2a2a2a] hover:border-[#22c55e] ${
                          selectedQuartileRankings.includes(quartile)
                            ? 'bg-[#22c55e] text-black border-[#22c55e]'
                            : 'text-gray-300 hover:text-white'
                        }`}
                        onClick={() => handleToggleQuartileRanking(quartile)}
                      >
                        {quartile}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Publication Types */}
                <div>
                  <Label className="text-white text-sm mb-2 block">Publication Types</Label>
                  <div className="flex flex-wrap gap-2">
                    {VALID_PUBLICATION_TYPES.map((type) => (
                      <Badge
                        key={type}
                        variant="outline"
                        className={`cursor-pointer border-[#2a2a2a] hover:border-[#22c55e] ${
                          selectedPublicationTypes.includes(type)
                            ? 'bg-[#22c55e] text-black border-[#22c55e]'
                            : 'text-gray-300 hover:text-white'
                        }`}
                        onClick={() => handleTogglePublicationType(type)}
                      >
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Sort */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white text-sm mb-2 block">Sort Field</Label>
                    <Select value={sortField} onValueChange={setSortField}>
                      <SelectTrigger className="bg-[#171717] border-[#2a2a2a] text-white">
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {VALID_SORT_FIELDS.map((field) => (
                          <SelectItem key={field} value={field}>
                            {field}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white text-sm mb-2 block">Direction</Label>
                    <Select value={sortDirection} onValueChange={setSortDirection}>
                      <SelectTrigger className="bg-[#171717] border-[#2a2a2a] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VALID_SORT_DIRECTIONS.map((dir) => (
                          <SelectItem key={dir} value={dir}>
                            {dir}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Year Filter */}
                <div>
                  <Label className="text-white text-sm mb-2 block">Year (YYYY or YYYY:YYYY)</Label>
                  <Input
                    type="text"
                    placeholder="e.g., 2020 or 2020:2024"
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="bg-[#171717] border-[#2a2a2a] text-white"
                  />
                </div>

                {/* Limit (from depth) */}
                <div>
                  <Label className="text-white text-sm mb-2 block">
                    Limit (from chat depth: {depth})
                  </Label>
                  <div className="bg-[#171717] border border-[#2a2a2a] rounded-md p-3 text-gray-300 text-sm">
                    {limit} results
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Sticky footer with action buttons */}
        <DialogFooter className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1f1f1f] flex-shrink-0 sticky bottom-0 z-10">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#2a2a2a] text-gray-300 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSearch}
            disabled={!jobType}
            className="bg-[#22c55e] hover:bg-[#16a34a] text-black disabled:opacity-50"
          >
            Search Papers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
