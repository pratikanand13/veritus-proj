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

  // Use robust chat paper storage hook
  const {
    extractKeywords: getKeywordsFromStorage,
    extractAuthors: getAuthorsFromStorage,
    extractReferences: getReferencesFromStorage,
    extractTLDRs: getTLDRsFromStorage,
    refreshStorage,
    isLoading: isLoadingStorage,
    paperCount,
  } = useChatPaperStorage(chatId, messages)

  // Refresh storage when dialog opens
  useEffect(() => {
    if (open && chatId) {
      refreshStorage()
    }
  }, [open, chatId, refreshStorage])

  // Extract suggested keywords, authors, references, and TLDRs
  const { suggestedKeywords, suggestedAuthors, suggestedReferences, suggestedTLDRs } = useMemo(() => {
    const keywordsFromStorage = getKeywordsFromStorage()
    const authorsFromStorage = getAuthorsFromStorage()
    const referencesFromStorage = getReferencesFromStorage()
    const tldrsFromStorage = getTLDRsFromStorage()

    // Also extract from messages as fallback
    const keywordsFromMessages: string[] = []
    const authorsFromMessages: string[] = []
    const referencesFromMessages: string[] = []
    const tldrsFromMessages: string[] = []
    const processedPaperIds = new Set<string>()

    const chatMessages = messages || []

    chatMessages.forEach((message) => {
      if (message.papers && message.papers.length > 0) {
        message.papers.forEach((paper) => {
          if (processedPaperIds.has(paper.id)) return
          processedPaperIds.add(paper.id)

          if (paper.fieldsOfStudy && Array.isArray(paper.fieldsOfStudy)) {
            paper.fieldsOfStudy.forEach((field: string) => {
              if (field && !keywordsFromMessages.includes(field)) {
                keywordsFromMessages.push(field)
              }
            })
          }
          if (paper.journalName && !keywordsFromMessages.includes(paper.journalName)) {
            keywordsFromMessages.push(paper.journalName)
          }
          if (paper.publicationType && !keywordsFromMessages.includes(paper.publicationType)) {
            keywordsFromMessages.push(paper.publicationType)
          }

          if (paper.authors) {
            const authorList = paper.authors.split(',').map((a: string) => a.trim()).filter(Boolean)
            authorList.forEach((author: string) => {
              if (author && !authorsFromMessages.includes(author)) {
                authorsFromMessages.push(author)
              }
            })
          }

          if (paper.title && !paper.title.startsWith('corpus:') && !referencesFromMessages.includes(paper.title)) {
            referencesFromMessages.push(paper.title)
          }

          if (paper.tldr && paper.tldr.trim() && !tldrsFromMessages.includes(paper.tldr.trim())) {
            tldrsFromMessages.push(paper.tldr.trim())
          }
        })
      }

      if (message.citationNetwork) {
        const citationNetwork = message.citationNetwork
        
        if (citationNetwork.paper && !processedPaperIds.has(citationNetwork.paper.id)) {
          processedPaperIds.add(citationNetwork.paper.id)
          const paper = citationNetwork.paper

          if (paper.fieldsOfStudy && Array.isArray(paper.fieldsOfStudy)) {
            paper.fieldsOfStudy.forEach((field: string) => {
              if (field && !keywordsFromMessages.includes(field)) {
                keywordsFromMessages.push(field)
              }
            })
          }
          if (paper.journalName && !keywordsFromMessages.includes(paper.journalName)) {
            keywordsFromMessages.push(paper.journalName)
          }
          if (paper.publicationType && !keywordsFromMessages.includes(paper.publicationType)) {
            keywordsFromMessages.push(paper.publicationType)
          }

          if (paper.authors) {
            const authorList = paper.authors.split(',').map((a: string) => a.trim()).filter(Boolean)
            authorList.forEach((author: string) => {
              if (author && !authorsFromMessages.includes(author)) {
                authorsFromMessages.push(author)
              }
            })
          }

          if (paper.title && !referencesFromMessages.includes(paper.title)) {
            referencesFromMessages.push(paper.title)
          }

          if (paper.tldr && paper.tldr.trim() && !tldrsFromMessages.includes(paper.tldr.trim())) {
            tldrsFromMessages.push(paper.tldr.trim())
          }
        }

        if (citationNetwork.similarPapers && Array.isArray(citationNetwork.similarPapers)) {
          citationNetwork.similarPapers.forEach((paper: VeritusPaper) => {
            if (processedPaperIds.has(paper.id)) return
            processedPaperIds.add(paper.id)

            if (paper.fieldsOfStudy && Array.isArray(paper.fieldsOfStudy)) {
              paper.fieldsOfStudy.forEach((field: string) => {
                if (field && !keywordsFromMessages.includes(field)) {
                  keywordsFromMessages.push(field)
                }
              })
            }
            if (paper.journalName && !keywordsFromMessages.includes(paper.journalName)) {
              keywordsFromMessages.push(paper.journalName)
            }
            if (paper.publicationType && !keywordsFromMessages.includes(paper.publicationType)) {
              keywordsFromMessages.push(paper.publicationType)
            }

            if (paper.authors) {
              const authorList = paper.authors.split(',').map((a: string) => a.trim()).filter(Boolean)
              authorList.forEach((author: string) => {
                if (author && !authorsFromMessages.includes(author)) {
                  authorsFromMessages.push(author)
                }
              })
            }

            if (paper.title && !referencesFromMessages.includes(paper.title)) {
              referencesFromMessages.push(paper.title)
            }

            if (paper.tldr && paper.tldr.trim() && !tldrsFromMessages.includes(paper.tldr.trim())) {
              tldrsFromMessages.push(paper.tldr.trim())
            }
          })
        }
      }
    })

    // Combine storage and messages, prioritizing storage
    const allKeywords = [...new Set([...keywordsFromStorage, ...keywordsFromMessages])]
    const allAuthors = [...new Set([...authorsFromStorage, ...authorsFromMessages])]
    const allReferences = [...new Set([...referencesFromStorage, ...referencesFromMessages])]
    const allTLDRs = [...new Set([...tldrsFromStorage, ...tldrsFromMessages])]

    return {
      suggestedKeywords: allKeywords.sort(),
      suggestedAuthors: allAuthors.sort(),
      suggestedReferences: allReferences.sort(),
      suggestedTLDRs: allTLDRs,
    }
  }, [getKeywordsFromStorage, getAuthorsFromStorage, getReferencesFromStorage, getTLDRsFromStorage, messages])

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
      alert('Please select at least keywords or TLDRs')
      return
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

  const handleRefresh = () => {
    if (chatId) {
      refreshStorage()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1f1f1f] border-[#2a2a2a] text-white max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-2xl flex items-center gap-2">
            <Hash className="h-6 w-6 text-[#FF6B35]" />
            Search Similar Papers
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Configure parameters for paper search. Select keywords, TLDRs, authors, and references from previous responses.
          </DialogDescription>
        </DialogHeader>
        
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
            <div className="bg-[#171717] border border-[#FF6B35] rounded-md p-3">
              <p className="text-sm text-gray-300">
                <span className="text-[#FF6B35] font-medium">Job Type:</span> {jobType}
                {jobType === 'combinedSearch' && ' (TLDR + Keywords)'}
                {jobType === 'querySearch' && ' (TLDR only)'}
                {jobType === 'keywordSearch' && ' (Keywords only)'}
              </p>
            </div>
          )}

          {/* Keywords Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-white text-base font-medium flex items-center gap-2">
                <Hash className="h-4 w-4 text-[#FF6B35]" />
                Keywords
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  Storage: {paperCount} papers
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoadingStorage}
                  className="h-7 px-2 text-gray-400 hover:text-white"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingStorage ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              Select keywords from previous responses or add custom ones
            </p>
            
            {/* Selected Keywords */}
            {selectedKeywords.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedKeywords.map((keyword) => (
                  <Badge
                    key={keyword}
                    variant="secondary"
                    className="bg-[#FF6B35] text-white hover:bg-[#FF6B35]/80 cursor-pointer"
                    onClick={() => handleToggleKeyword(keyword)}
                  >
                    {keyword}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Suggested Keywords */}
            {suggestedKeywords.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-2">Suggested from previous papers:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedKeywords.map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="outline"
                      className={`cursor-pointer border-[#2a2a2a] hover:border-[#FF6B35] ${
                        selectedKeywords.includes(keyword)
                          ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
                          : 'text-gray-300 hover:text-white'
                      }`}
                      onClick={() => handleToggleKeyword(keyword)}
                    >
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Add Custom Keyword */}
            <div className="flex gap-2">
              <Input
                placeholder="Type keyword and press Enter..."
                value={customKeyword}
                onChange={(e) => setCustomKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCustomKeyword()
                  }
                }}
                className="bg-[#171717] border-[#2a2a2a] text-white placeholder:text-gray-500"
              />
              <Button
                onClick={handleAddCustomKeyword}
                disabled={!customKeyword.trim()}
                className="bg-[#FF6B35] hover:bg-[#FF6B35]/80"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* TLDR Section */}
          <div>
            <Label className="text-white text-base font-medium flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-[#FF6B35]" />
              TLDR
            </Label>
            <p className="text-sm text-gray-400 mb-3">
              Select TLDR summaries from previous papers
            </p>
            
            {/* Selected TLDRs */}
            {selectedTLDRs.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                {selectedTLDRs.map((tldr) => (
                  <Badge
                    key={tldr}
                    variant="secondary"
                    className="bg-[#FF6B35] text-white hover:bg-[#FF6B35]/80 cursor-pointer justify-start text-left p-2"
                    onClick={() => handleToggleTLDR(tldr)}
                  >
                    <span className="flex-1 truncate">{tldr}</span>
                    <X className="ml-2 h-3 w-3 flex-shrink-0" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Suggested TLDRs */}
            {suggestedTLDRs.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Suggested from previous papers:</p>
                <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                  {suggestedTLDRs.map((tldr) => (
                    <Badge
                      key={tldr}
                      variant="outline"
                      className={`cursor-pointer border-[#2a2a2a] hover:border-[#FF6B35] text-left p-2 ${
                        selectedTLDRs.includes(tldr)
                          ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
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
              <Users className="h-4 w-4 text-[#FF6B35]" />
              Authors
            </Label>
            <p className="text-sm text-gray-400 mb-3">
              Select authors from previous paper results
            </p>
            
            {/* Selected Authors */}
            {selectedAuthors.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedAuthors.map((author) => (
                  <Badge
                    key={author}
                    variant="secondary"
                    className="bg-[#FF6B35] text-white hover:bg-[#FF6B35]/80 cursor-pointer"
                    onClick={() => handleToggleAuthor(author)}
                  >
                    {author}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Suggested Authors */}
            {suggestedAuthors.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Suggested from previous papers:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedAuthors.map((author) => (
                    <Badge
                      key={author}
                      variant="outline"
                      className={`cursor-pointer border-[#2a2a2a] hover:border-[#FF6B35] ${
                        selectedAuthors.includes(author)
                          ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
                          : 'text-gray-300 hover:text-white'
                      }`}
                      onClick={() => handleToggleAuthor(author)}
                    >
                      {author}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* References Section */}
          <div>
            <Label className="text-white text-base font-medium flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-[#FF6B35]" />
              References
            </Label>
            <p className="text-sm text-gray-400 mb-3">
              Select paper titles from previous results
            </p>
            
            {/* Selected References */}
            {selectedReferences.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedReferences.map((ref) => (
                  <Badge
                    key={ref}
                    variant="secondary"
                    className="bg-[#FF6B35] text-white hover:bg-[#FF6B35]/80 cursor-pointer max-w-xs truncate"
                    onClick={() => handleToggleReference(ref)}
                  >
                    {ref}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Suggested References */}
            {suggestedReferences.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Suggested from previous papers:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedReferences.map((ref) => (
                    <Badge
                      key={ref}
                      variant="outline"
                      className={`cursor-pointer border-[#2a2a2a] hover:border-[#FF6B35] max-w-xs truncate ${
                        selectedReferences.includes(ref)
                          ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
                          : 'text-gray-300 hover:text-white'
                      }`}
                      onClick={() => handleToggleReference(ref)}
                    >
                      {ref}
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
                {/* Fields of Study */}
                <div>
                  <Label className="text-white text-sm mb-2 block">Fields of Study</Label>
                  <div className="flex flex-wrap gap-2">
                    {VALID_FIELDS_OF_STUDY.map((field) => (
                      <Badge
                        key={field}
                        variant="outline"
                        className={`cursor-pointer border-[#2a2a2a] hover:border-[#FF6B35] ${
                          selectedFieldsOfStudy.includes(field)
                            ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
                            : 'text-gray-300 hover:text-white'
                        }`}
                        onClick={() => handleToggleFieldOfStudy(field)}
                      >
                        {field}
                      </Badge>
                    ))}
                  </div>
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
                        className={`cursor-pointer border-[#2a2a2a] hover:border-[#FF6B35] ${
                          selectedQuartileRankings.includes(quartile)
                            ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
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
                        className={`cursor-pointer border-[#2a2a2a] hover:border-[#FF6B35] ${
                          selectedPublicationTypes.includes(type)
                            ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
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

        <DialogFooter>
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
            className="bg-[#FF6B35] hover:bg-[#FF6B35]/80 text-white disabled:opacity-50"
          >
            Search Papers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
