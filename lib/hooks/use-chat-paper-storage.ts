/**
 * Chat Paper Storage Hook
 * Robust system to track all API responses per chat
 * Stores papers in a map for fast lookup and keyword extraction
 * Enhanced to store papers by heading/abstract with full API response
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { VeritusPaper } from '@/types/veritus'

interface ChatPaperStorage {
  [paperId: string]: VeritusPaper
}

/**
 * Chat Store Entry - stores paper with heading as key and full API response
 */
export interface ChatStoreEntry {
  heading: string // abstract or title
  paper: VeritusPaper // Full API response
  similarPapers?: VeritusPaper[] // 5 papers for graph expansion
  apiResponse?: any // Full API response object
}

interface ChatStore {
  [heading: string]: ChatStoreEntry
}

interface ChatStorage {
  [chatId: string]: {
    papers: ChatPaperStorage // Backward compatibility - papers by ID
    chatStore?: ChatStore // New structure - papers by heading/abstract
    lastUpdated: Date
  }
}

// Global storage shared across all instances
const globalStorage: ChatStorage = {}

export function useChatPaperStorage(chatId?: string | null, messages?: any[]) {
  const [storage, setStorage] = useState<ChatPaperStorage>({})
  const [isLoading, setIsLoading] = useState(false)
  const initializedRef = useRef(false)

  // Initialize storage for this chat
  const chatStorage = chatId && globalStorage[chatId] 
    ? globalStorage[chatId].papers 
    : {}

  // Load papers from messages
  useEffect(() => {
    if (!chatId) {
      setStorage({})
      initializedRef.current = false
      return
    }

    // Initialize storage for this chat if not exists
    if (!globalStorage[chatId]) {
      globalStorage[chatId] = {
        papers: {},
        chatStore: {},
        lastUpdated: new Date(),
      }
    }

    // Extract all papers from messages
    const papersMap: ChatPaperStorage = {}
    const chatStoreMap: ChatStore = {}
    
    if (messages && Array.isArray(messages)) {
      messages.forEach((message) => {
        // Extract from message.papers
        if (message.papers && Array.isArray(message.papers)) {
          message.papers.forEach((paper: VeritusPaper) => {
            if (paper && paper.id) {
              papersMap[paper.id] = paper
              
              // Create chat store entry with heading as key
              const heading = paper.abstract || paper.title
              if (heading && !chatStoreMap[heading]) {
                chatStoreMap[heading] = {
                  heading,
                  paper,
                  similarPapers: [],
                  apiResponse: message.papers.length === 1 ? { paper } : undefined,
                }
              }
              
              // If this is a similar paper, add to similarPapers array
              if (heading && chatStoreMap[heading] && chatStoreMap[heading].paper.id !== paper.id) {
                if (!chatStoreMap[heading].similarPapers) {
                  chatStoreMap[heading].similarPapers = []
                }
                // Limit to 5 similar papers
                if (chatStoreMap[heading].similarPapers!.length < 5) {
                  chatStoreMap[heading].similarPapers!.push(paper)
                }
              }
            }
          })
        }

        // Extract from citationNetwork.paper
        if (message.citationNetwork?.paper) {
          const paper = message.citationNetwork.paper
          if (paper && paper.id) {
            papersMap[paper.id] = paper
            
            const heading = paper.abstract || paper.title
            if (heading && !chatStoreMap[heading]) {
              chatStoreMap[heading] = {
                heading,
                paper,
                similarPapers: message.citationNetwork.similarPapers || [],
                apiResponse: message.citationNetwork,
              }
            }
          }
        }

        // Extract from citationNetwork.similarPapers
        if (message.citationNetwork?.similarPapers && Array.isArray(message.citationNetwork.similarPapers)) {
          message.citationNetwork.similarPapers.forEach((paper: VeritusPaper) => {
            if (paper && paper.id) {
              papersMap[paper.id] = paper
            }
          })
        }

        // Extract from citationNetwork.citationNetwork.nodes
        if (message.citationNetwork?.citationNetwork?.nodes && Array.isArray(message.citationNetwork.citationNetwork.nodes)) {
          message.citationNetwork.citationNetwork.nodes.forEach((node: any) => {
            if (node.data && node.data.id) {
              papersMap[node.data.id] = node.data
            }
            // Also check if node itself has paper data
            if (node.id && !papersMap[node.id] && node.data) {
              papersMap[node.id] = node.data
            }
          })
        }
      })
    }

    // Update global storage
    globalStorage[chatId] = {
      papers: { ...globalStorage[chatId].papers, ...papersMap },
      chatStore: { ...globalStorage[chatId].chatStore, ...chatStoreMap },
      lastUpdated: new Date(),
    }

    // Update local state
    setStorage(globalStorage[chatId].papers)
    initializedRef.current = true
  }, [chatId, messages])

  // Refresh storage from API
  const refreshStorage = useCallback(async () => {
    if (!chatId) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/chats/${chatId}`)
      if (response.ok) {
        const data = await response.json()
        const chat = data.chat

        if (chat && chat.messages) {
          const papersMap: ChatPaperStorage = {}
          const chatStoreMap: ChatStore = {}
          
          chat.messages.forEach((message: any) => {
            if (message.papers && Array.isArray(message.papers)) {
              message.papers.forEach((paper: VeritusPaper) => {
                if (paper && paper.id) {
                  papersMap[paper.id] = paper
                  
                  const heading = paper.abstract || paper.title
                  if (heading && !chatStoreMap[heading]) {
                    chatStoreMap[heading] = {
                      heading,
                      paper,
                      similarPapers: [],
                      apiResponse: message.papers.length === 1 ? { paper } : undefined,
                    }
                  }
                  
                  if (heading && chatStoreMap[heading] && chatStoreMap[heading].paper.id !== paper.id) {
                    if (!chatStoreMap[heading].similarPapers) {
                      chatStoreMap[heading].similarPapers = []
                    }
                    if (chatStoreMap[heading].similarPapers!.length < 5) {
                      chatStoreMap[heading].similarPapers!.push(paper)
                    }
                  }
                }
              })
            }

            if (message.citationNetwork?.paper) {
              const paper = message.citationNetwork.paper
              if (paper && paper.id) {
                papersMap[paper.id] = paper
                
                const heading = paper.abstract || paper.title
                if (heading && !chatStoreMap[heading]) {
                  chatStoreMap[heading] = {
                    heading,
                    paper,
                    similarPapers: message.citationNetwork.similarPapers || [],
                    apiResponse: message.citationNetwork,
                  }
                }
              }
            }

            if (message.citationNetwork?.similarPapers && Array.isArray(message.citationNetwork.similarPapers)) {
              message.citationNetwork.similarPapers.forEach((paper: VeritusPaper) => {
                if (paper && paper.id) {
                  papersMap[paper.id] = paper
                }
              })
            }

            if (message.citationNetwork?.citationNetwork?.nodes && Array.isArray(message.citationNetwork.citationNetwork.nodes)) {
              message.citationNetwork.citationNetwork.nodes.forEach((node: any) => {
                if (node.data && node.data.id) {
                  papersMap[node.data.id] = node.data
                }
              })
            }
          })

          // Update global storage
          globalStorage[chatId] = {
            papers: papersMap,
            chatStore: chatStoreMap,
            lastUpdated: new Date(),
          }

          // Update local state
          setStorage(papersMap)
        }
      }
    } catch (error) {
      console.error('Error refreshing chat paper storage:', error)
    } finally {
      setIsLoading(false)
    }
  }, [chatId])

  // Add paper to storage
  const addPaper = useCallback((paper: VeritusPaper, apiResponse?: any) => {
    if (!chatId || !paper || !paper.id) return

    if (!globalStorage[chatId]) {
      globalStorage[chatId] = {
        papers: {},
        chatStore: {},
        lastUpdated: new Date(),
      }
    }

    globalStorage[chatId].papers[paper.id] = paper
    
    // Add to chat store with heading as key
    const heading = paper.abstract || paper.title
    if (heading) {
      if (!globalStorage[chatId].chatStore) {
        globalStorage[chatId].chatStore = {}
      }
      
      if (!globalStorage[chatId].chatStore![heading]) {
        globalStorage[chatId].chatStore![heading] = {
          heading,
          paper,
          similarPapers: [],
          apiResponse,
        }
      }
    }
    
    globalStorage[chatId].lastUpdated = new Date()

    setStorage({ ...globalStorage[chatId].papers })
  }, [chatId])
  
  // Get chat store entry by heading
  const getChatStoreEntry = useCallback((heading: string): ChatStoreEntry | null => {
    if (!chatId || !globalStorage[chatId] || !globalStorage[chatId].chatStore) {
      return null
    }
    return globalStorage[chatId].chatStore![heading] || null
  }, [chatId])
  
  // Get all chat store entries
  const getAllChatStoreEntries = useCallback((): ChatStoreEntry[] => {
    if (!chatId || !globalStorage[chatId] || !globalStorage[chatId].chatStore) {
      return []
    }
    return Object.values(globalStorage[chatId].chatStore!)
  }, [chatId])

  // Get all papers
  const getAllPapers = useCallback((): VeritusPaper[] => {
    return Object.values(storage)
  }, [storage])

  // Get paper by ID
  const getPaper = useCallback((paperId: string): VeritusPaper | null => {
    return storage[paperId] || null
  }, [storage])

  // Extract keywords from all papers in storage
  const extractKeywords = useCallback((): string[] => {
    const keywords = new Set<string>()
    
    Object.values(storage).forEach((paper) => {
      // From fieldsOfStudy
      if (paper.fieldsOfStudy && Array.isArray(paper.fieldsOfStudy)) {
        paper.fieldsOfStudy.forEach(field => {
          if (field) keywords.add(field)
        })
      }

      // From journalName
      if (paper.journalName) {
        keywords.add(paper.journalName)
      }

      // From publicationType
      if (paper.publicationType) {
        keywords.add(paper.publicationType)
      }
    })

    return Array.from(keywords).sort()
  }, [storage])

  // Extract authors from all papers in storage
  const extractAuthors = useCallback((): string[] => {
    const authors = new Set<string>()
    
    Object.values(storage).forEach((paper) => {
      if (paper.authors) {
        const authorList = paper.authors.split(',').map(a => a.trim()).filter(Boolean)
        authorList.forEach(author => {
          if (author) authors.add(author)
        })
      }
    })

    return Array.from(authors).sort()
  }, [storage])

  // Extract references (paper titles) from all papers in storage
  const extractReferences = useCallback((): string[] => {
    const references = new Set<string>()
    
    Object.values(storage).forEach((paper) => {
      if (paper.title && !paper.title.startsWith('corpus:')) {
        references.add(paper.title)
      }
    })

    return Array.from(references).sort()
  }, [storage])

  // Extract TLDRs from all papers in storage
  const extractTLDRs = useCallback((): string[] => {
    const tldrs = new Set<string>()
    
    Object.values(storage).forEach((paper) => {
      if (paper.tldr && paper.tldr.trim()) {
        tldrs.add(paper.tldr.trim())
      }
    })

    return Array.from(tldrs)
  }, [storage])

  // Extract years from all papers in storage
  const extractYears = useCallback((): number[] => {
    const years = new Set<number>()
    
    Object.values(storage).forEach((paper) => {
      if (paper.year && typeof paper.year === 'number') {
        years.add(paper.year)
      }
    })

    return Array.from(years).sort((a, b) => b - a) // Sort descending
  }, [storage])

  return {
    storage,
    isLoading,
    initialized: initializedRef.current,
    refreshStorage,
    addPaper,
    getAllPapers,
    getPaper,
    extractKeywords,
    extractAuthors,
    extractReferences,
    extractTLDRs,
    extractYears,
    getChatStoreEntry,
    getAllChatStoreEntries,
    paperCount: Object.keys(storage).length,
  }
}

