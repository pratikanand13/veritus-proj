'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Plus, Trash2, Sparkles, Users, BookOpen, Hash, Network, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VeritusPaper } from '@/types/veritus'
import { CorpusResponse } from '@/types/paper-api'
import { useChatPaperStorage } from '@/lib/hooks/use-chat-paper-storage'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  papers?: VeritusPaper[]
  citationNetwork?: any
}

interface CitationNetworkSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  corpusId: string
  depth: number
  messages: Message[]
  chatId?: string | null // Add chatId to ensure chat isolation
  onGenerate: (params: {
    corpusId: string
    depth: number
    simple: boolean
    keywords: string[]
    authors: string[]
    references: string[]
  }) => void
}

export function CitationNetworkSelector({
  open,
  onOpenChange,
  corpusId,
  depth,
  messages,
  chatId,
  onGenerate,
}: CitationNetworkSelectorProps) {
  const [simple, setSimple] = useState(false)
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

  // Extract suggested keywords, authors, and references from robust storage
  // This ensures we only get data from the current chat
  const { suggestedKeywords, suggestedAuthors, suggestedReferences } = useMemo(() => {
    // Use the robust storage extraction methods (primary source)
    const keywordsFromStorage = getKeywordsFromStorage()
    const authorsFromStorage = getAuthorsFromStorage()
    const referencesFromStorage = getReferencesFromStorage()

    // Also extract from messages as fallback (for backward compatibility)
    const keywordsFromMessages: string[] = []
    const authorsFromMessages: string[] = []
    const referencesFromMessages: string[] = []
    const processedPaperIds = new Set<string>()

    const chatMessages = messages || []

    // Process messages to extract papers from API responses
    chatMessages.forEach((message) => {
      // Extract papers from message.papers (from search, corpus, citation network responses)
      if (message.papers && message.papers.length > 0) {
        message.papers.forEach((paper) => {
          // Skip if already processed
          if (processedPaperIds.has(paper.id)) return
          processedPaperIds.add(paper.id)

          // Extract keywords from multiple fields
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

          // Extract authors from papers
          if (paper.authors) {
            const authorList = paper.authors.split(',').map((a: string) => a.trim()).filter(Boolean)
            authorList.forEach((author: string) => {
              if (author && !authorsFromMessages.includes(author)) {
                authorsFromMessages.push(author)
              }
            })
          }

          // Extract paper titles as references
          if (paper.title && !paper.title.startsWith('corpus:') && !referencesFromMessages.includes(paper.title)) {
            referencesFromMessages.push(paper.title)
          }
        })
      }

      // Extract papers from citationNetwork response (if present)
      if (message.citationNetwork) {
        const citationNetwork = message.citationNetwork
        
        // Extract main paper
        if (citationNetwork.paper && !processedPaperIds.has(citationNetwork.paper.id)) {
          processedPaperIds.add(citationNetwork.paper.id)
          const paper = citationNetwork.paper

          // Extract keywords
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

          // Extract authors
          if (paper.authors) {
            const authorList = paper.authors.split(',').map((a: string) => a.trim()).filter(Boolean)
            authorList.forEach((author: string) => {
              if (author && !authorsFromMessages.includes(author)) {
                authorsFromMessages.push(author)
              }
            })
          }

          // Extract title as reference
          if (paper.title && !paper.title.startsWith('corpus:') && !referencesFromMessages.includes(paper.title)) {
            referencesFromMessages.push(paper.title)
          }
        }

        // Extract similar papers from citation network
        if (citationNetwork.similarPapers && Array.isArray(citationNetwork.similarPapers)) {
          citationNetwork.similarPapers.forEach((paper: VeritusPaper) => {
            if (processedPaperIds.has(paper.id)) return
            processedPaperIds.add(paper.id)

            // Extract keywords
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

            // Extract authors
            if (paper.authors) {
              const authorList = paper.authors.split(',').map((a: string) => a.trim()).filter(Boolean)
              authorList.forEach((author: string) => {
                if (author && !authorsFromMessages.includes(author)) {
                  authorsFromMessages.push(author)
                }
              })
            }

            // Extract title as reference
            if (paper.title && !paper.title.startsWith('corpus:') && !referencesFromMessages.includes(paper.title)) {
              referencesFromMessages.push(paper.title)
            }
          })
        }

        // Extract papers from citationNetwork.nodes if available
        if (citationNetwork.citationNetwork && citationNetwork.citationNetwork.nodes) {
          citationNetwork.citationNetwork.nodes.forEach((node: any) => {
            if (node.data && !processedPaperIds.has(node.data.id)) {
              processedPaperIds.add(node.data.id)
              const paper = node.data as VeritusPaper

              // Extract keywords
              if (paper.fieldsOfStudy && Array.isArray(paper.fieldsOfStudy)) {
                (paper.fieldsOfStudy as string[]).forEach((field: string) => {
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

              // Extract authors
              if (paper.authors) {
                const authorList = paper.authors.split(',').map((a: string) => a.trim()).filter(Boolean)
                authorList.forEach((author: string) => {
                  if (author && !authorsFromMessages.includes(author)) {
                    authorsFromMessages.push(author)
                  }
                })
              }

              // Extract title as reference
              if (paper.title && !paper.title.startsWith('corpus:') && !referencesFromMessages.includes(paper.title)) {
                referencesFromMessages.push(paper.title)
              }
            }
          })
        }
      }
    })

    // Merge storage results with message results (storage takes priority, then messages)
    const allKeywords = [...new Set([...keywordsFromStorage, ...keywordsFromMessages])]
    const allAuthors = [...new Set([...authorsFromStorage, ...authorsFromMessages])]
    const allReferences = [...new Set([...referencesFromStorage, ...referencesFromMessages])]

    return {
      suggestedKeywords: allKeywords.sort(),
      suggestedAuthors: allAuthors.sort(),
      suggestedReferences: allReferences.sort(),
    }
  }, [messages, chatId, getKeywordsFromStorage, getAuthorsFromStorage, getReferencesFromStorage]) // Include storage methods in dependencies

  const handleAddKeyword = (keyword?: string) => {
    const keywordToAdd = keyword || customKeyword.trim()
    if (keywordToAdd && !selectedKeywords.includes(keywordToAdd)) {
      setSelectedKeywords([...selectedKeywords, keywordToAdd])
      setCustomKeyword('')
    }
  }

  const handleToggleKeyword = (keyword: string) => {
    if (selectedKeywords.includes(keyword)) {
      setSelectedKeywords(selectedKeywords.filter(k => k !== keyword))
    } else {
      setSelectedKeywords([...selectedKeywords, keyword])
    }
  }

  const handleRemoveKeyword = (keyword: string) => {
    setSelectedKeywords(selectedKeywords.filter(k => k !== keyword))
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

  const handleRemoveAuthor = (author: string) => {
    setSelectedAuthors(selectedAuthors.filter(a => a !== author))
  }

  const handleRemoveReference = (ref: string) => {
    setSelectedReferences(selectedReferences.filter(r => r !== ref))
  }

  const handleGenerate = () => {
    onGenerate({
      corpusId,
      depth,
      simple,
      keywords: selectedKeywords,
      authors: selectedAuthors,
      references: selectedReferences,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1f1f1f] border-[#2a2a2a] text-white max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-2xl flex items-center gap-2">
            <Network className="h-6 w-6 text-blue-500" />
            Generate Citation Network
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Configure parameters for citation network visualization. Select keywords, authors, and references from previous responses.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Corpus ID and Mode in Cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-[#171717] border-[#2a2a2a]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Corpus ID
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  value={corpusId}
                  disabled
                  className="bg-[#0f0f0f] border-[#2a2a2a] text-gray-400 text-xs font-mono"
                />
              </CardContent>
            </Card>

            <Card className="bg-[#171717] border-[#2a2a2a]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-300">Mode</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      checked={simple}
                      onChange={() => setSimple(true)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-300 group-hover:text-white transition-colors text-sm">Simple (Semantic Similarity)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      checked={!simple}
                      onChange={() => setSimple(false)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-300 group-hover:text-white transition-colors text-sm">Full (Citation Network)</span>
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Keywords Section */}
          {!simple && (
            <>
              <Card className="bg-[#171717] border-[#2a2a2a]">
                <CardHeader>
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                    Keywords
                  </CardTitle>
                  <CardDescription className="text-gray-400 text-xs">
                    Select keywords from previous responses or add custom ones
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Refresh Button */}
                  {chatId && (
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#2a2a2a]">
                      <span className="text-xs text-gray-400">Storage: {paperCount} papers</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => refreshStorage()}
                        disabled={isLoadingStorage}
                        className="h-7 text-xs"
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${isLoadingStorage ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>
                  )}

                  {/* Suggested Keywords from fieldsOfStudy */}
                  {suggestedKeywords.length > 0 && (
                    <div>
                      <Label className="text-xs font-medium text-gray-400 mb-2 block">Suggested from previous papers:</Label>
                      <div className="flex flex-wrap gap-2">
                        {suggestedKeywords.map((keyword) => (
                          <button
                            key={keyword}
                            onClick={() => handleToggleKeyword(keyword)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-all ${
                              selectedKeywords.includes(keyword)
                                ? 'bg-blue-600 text-white border-2 border-blue-400'
                                : 'bg-[#2a2a2a] text-gray-300 border-2 border-transparent hover:border-blue-500/50 hover:bg-[#2a2a2a]/80'
                            }`}
                          >
                            {keyword}
                            {selectedKeywords.includes(keyword) && (
                              <X className="h-3 w-3" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Keyword Input */}
                  <div>
                    <Label className="text-xs font-medium text-gray-400 mb-2 block">Add custom keyword:</Label>
                    <div className="flex gap-2">
                      <Input
                        value={customKeyword}
                        onChange={(e) => setCustomKeyword(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
                        placeholder="Type keyword and press Enter..."
                        className="bg-[#0f0f0f] border-[#2a2a2a] text-white placeholder:text-gray-500"
                      />
                      <Button
                        onClick={() => handleAddKeyword()}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Selected Keywords Display */}
                  {selectedKeywords.length > 0 && (
                    <div>
                      <Label className="text-xs font-medium text-gray-400 mb-2 block">Selected ({selectedKeywords.length}):</Label>
                      <div className="flex flex-wrap gap-2">
                        {selectedKeywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 border border-blue-500/50 text-blue-300 rounded-md text-sm"
                          >
                            {keyword}
                            <button
                              onClick={() => handleRemoveKeyword(keyword)}
                              className="hover:text-red-400 transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Authors Section */}
              {suggestedAuthors.length > 0 && (
                <Card className="bg-[#171717] border-[#2a2a2a]">
                  <CardHeader>
                    <CardTitle className="text-base text-white flex items-center gap-2">
                      <Users className="h-5 w-5 text-green-500" />
                      Authors
                    </CardTitle>
                    <CardDescription className="text-gray-400 text-xs">
                      Select authors from previous paper results
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Suggested Authors */}
                    <div>
                      <Label className="text-xs font-medium text-gray-400 mb-2 block">Suggested from previous papers:</Label>
                      <div className="flex flex-wrap gap-2">
                        {suggestedAuthors.map((author) => (
                          <button
                            key={author}
                            onClick={() => handleToggleAuthor(author)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-all ${
                              selectedAuthors.includes(author)
                                ? 'bg-green-600 text-white border-2 border-green-400'
                                : 'bg-[#2a2a2a] text-gray-300 border-2 border-transparent hover:border-green-500/50 hover:bg-[#2a2a2a]/80'
                            }`}
                          >
                            {author}
                            {selectedAuthors.includes(author) && (
                              <X className="h-3 w-3" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Selected Authors Display */}
                    {selectedAuthors.length > 0 && (
                      <div>
                        <Label className="text-xs font-medium text-gray-400 mb-2 block">Selected ({selectedAuthors.length}):</Label>
                        <div className="flex flex-wrap gap-2">
                          {selectedAuthors.map((author) => (
                            <span
                              key={author}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600/20 border border-green-500/50 text-green-300 rounded-md text-sm"
                            >
                              {author}
                              <button
                                onClick={() => handleRemoveAuthor(author)}
                                className="hover:text-red-400 transition-colors"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* References Section */}
              {suggestedReferences.length > 0 && (
                <Card className="bg-[#171717] border-[#2a2a2a]">
                  <CardHeader>
                    <CardTitle className="text-base text-white flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-purple-500" />
                      References
                    </CardTitle>
                    <CardDescription className="text-gray-400 text-xs">
                      Select paper titles from previous results
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Suggested References */}
                    <div>
                      <Label className="text-xs font-medium text-gray-400 mb-2 block">Suggested from previous papers:</Label>
                      <div className="flex flex-wrap gap-2">
                        {suggestedReferences.slice(0, 20).map((ref) => {
                          const displayRef = ref.length > 50 ? ref.substring(0, 50) + '...' : ref
                          return (
                            <button
                              key={ref}
                              onClick={() => handleToggleReference(ref)}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-all ${
                                selectedReferences.includes(ref)
                                  ? 'bg-purple-600 text-white border-2 border-purple-400'
                                  : 'bg-[#2a2a2a] text-gray-300 border-2 border-transparent hover:border-purple-500/50 hover:bg-[#2a2a2a]/80'
                              }`}
                              title={ref}
                            >
                              {displayRef}
                              {selectedReferences.includes(ref) && (
                                <X className="h-3 w-3" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Selected References Display */}
                    {selectedReferences.length > 0 && (
                      <div>
                        <Label className="text-xs font-medium text-gray-400 mb-2 block">Selected ({selectedReferences.length}):</Label>
                        <div className="flex flex-wrap gap-2">
                          {selectedReferences.map((ref) => {
                            const displayRef = ref.length > 50 ? ref.substring(0, 50) + '...' : ref
                            return (
                              <span
                                key={ref}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600/20 border border-purple-500/50 text-purple-300 rounded-md text-sm"
                                title={ref}
                              >
                                {displayRef}
                                <button
                                  onClick={() => handleRemoveReference(ref)}
                                  className="hover:text-red-400 transition-colors"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Depth Display */}
          <Card className="bg-[#171717] border-[#2a2a2a]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-300">Depth</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={depth}
                disabled
                className="bg-[#0f0f0f] border-[#2a2a2a] text-gray-400 font-mono"
              />
              <p className="text-xs text-gray-500 mt-2">Using chat depth setting</p>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#2a2a2a] text-gray-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Generate Network
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

