'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Plus, RefreshCw, Hash, Users, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
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
  onSearch: (params: {
    corpusId: string
    keywords: string[]
    authors: string[]
    references: string[]
  }) => void
}

export function KeywordSelectionPanel({
  open,
  onOpenChange,
  corpusId,
  messages,
  chatId,
  onSearch,
}: KeywordSelectionPanelProps) {
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([])
  const [selectedReferences, setSelectedReferences] = useState<string[]>([])
  const [customKeyword, setCustomKeyword] = useState('')

  // Use robust chat paper storage hook
  const {
    extractKeywords: getKeywordsFromStorage,
    extractAuthors: getAuthorsFromStorage,
    extractReferences: getReferencesFromStorage,
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

  // Extract suggested keywords, authors, and references
  const { suggestedKeywords, suggestedAuthors, suggestedReferences } = useMemo(() => {
    const keywordsFromStorage = getKeywordsFromStorage()
    const authorsFromStorage = getAuthorsFromStorage()
    const referencesFromStorage = getReferencesFromStorage()

    // Also extract from messages as fallback
    const keywordsFromMessages: string[] = []
    const authorsFromMessages: string[] = []
    const referencesFromMessages: string[] = []
    const processedPaperIds = new Set<string>()

    const chatMessages = messages || []

    chatMessages.forEach((message) => {
      if (message.papers && message.papers.length > 0) {
        message.papers.forEach((paper) => {
          if (processedPaperIds.has(paper.id)) return
          processedPaperIds.add(paper.id)

          if (paper.fieldsOfStudy && Array.isArray(paper.fieldsOfStudy)) {
            paper.fieldsOfStudy.forEach(field => {
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
            const authorList = paper.authors.split(',').map(a => a.trim()).filter(Boolean)
            authorList.forEach(author => {
              if (author && !authorsFromMessages.includes(author)) {
                authorsFromMessages.push(author)
              }
            })
          }

          if (paper.title && !paper.title.startsWith('corpus:') && !referencesFromMessages.includes(paper.title)) {
            referencesFromMessages.push(paper.title)
          }
        })
      }

      if (message.citationNetwork) {
        const citationNetwork = message.citationNetwork
        
        if (citationNetwork.paper && !processedPaperIds.has(citationNetwork.paper.id)) {
          processedPaperIds.add(citationNetwork.paper.id)
          const paper = citationNetwork.paper

          if (paper.fieldsOfStudy && Array.isArray(paper.fieldsOfStudy)) {
            paper.fieldsOfStudy.forEach(field => {
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
            const authorList = paper.authors.split(',').map(a => a.trim()).filter(Boolean)
            authorList.forEach(author => {
              if (author && !authorsFromMessages.includes(author)) {
                authorsFromMessages.push(author)
              }
            })
          }

          if (paper.title && !referencesFromMessages.includes(paper.title)) {
            referencesFromMessages.push(paper.title)
          }
        }

        if (citationNetwork.similarPapers && Array.isArray(citationNetwork.similarPapers)) {
          citationNetwork.similarPapers.forEach((paper: VeritusPaper) => {
            if (processedPaperIds.has(paper.id)) return
            processedPaperIds.add(paper.id)

            if (paper.fieldsOfStudy && Array.isArray(paper.fieldsOfStudy)) {
              paper.fieldsOfStudy.forEach(field => {
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
              const authorList = paper.authors.split(',').map(a => a.trim()).filter(Boolean)
              authorList.forEach(author => {
                if (author && !authorsFromMessages.includes(author)) {
                  authorsFromMessages.push(author)
                }
              })
            }

            if (paper.title && !referencesFromMessages.includes(paper.title)) {
              referencesFromMessages.push(paper.title)
            }
          })
        }
      }
    })

    // Combine storage and messages, prioritizing storage
    const allKeywords = [...new Set([...keywordsFromStorage, ...keywordsFromMessages])]
    const allAuthors = [...new Set([...authorsFromStorage, ...authorsFromMessages])]
    const allReferences = [...new Set([...referencesFromStorage, ...referencesFromMessages])]

    return {
      suggestedKeywords: allKeywords.sort(),
      suggestedAuthors: allAuthors.sort(),
      suggestedReferences: allReferences.sort(),
    }
  }, [getKeywordsFromStorage, getAuthorsFromStorage, getReferencesFromStorage, messages])

  const handleToggleKeyword = (keyword: string) => {
    if (selectedKeywords.includes(keyword)) {
      setSelectedKeywords(selectedKeywords.filter(k => k !== keyword))
    } else {
      setSelectedKeywords([...selectedKeywords, keyword])
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

  const handleSearch = () => {
    onSearch({
      corpusId,
      keywords: selectedKeywords,
      authors: selectedAuthors,
      references: selectedReferences,
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
      <DialogContent className="bg-[#1f1f1f] border-[#2a2a2a] text-white max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-2xl flex items-center gap-2">
            <Hash className="h-6 w-6 text-[#FF6B35]" />
            Search Similar Papers
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Configure parameters for paper search. Select keywords, authors, and references from previous responses.
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
            className="bg-[#FF6B35] hover:bg-[#FF6B35]/80 text-white"
          >
            Search Papers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

