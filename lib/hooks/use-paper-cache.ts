/**
 * Paper Cache Hook
 * Caches paper details per chat to avoid redundant API calls
 * Persists cache to chat history and restores from chat messages
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { VeritusPaper } from '@/types/veritus'

interface PaperCache {
  [paperId: string]: VeritusPaper
}

interface ChatPaperCache {
  [chatId: string]: PaperCache
}

// Global cache shared across all instances
const globalCache: ChatPaperCache = {}

export function usePaperCache(chatId?: string | null, messages?: any[]) {
  const cacheRef = useRef<PaperCache>({})
  const [initialized, setInitialized] = useState(false)

  // Initialize cache for this chat
  if (chatId && !globalCache[chatId]) {
    globalCache[chatId] = {}
  }
  const chatCache = chatId ? globalCache[chatId] : cacheRef.current

  // Initialize cache from chat messages
  useEffect(() => {
    if (chatId && messages && !initialized) {
      // Extract all papers from messages
      const papersMap = new Map<string, VeritusPaper>()
      for (const message of messages) {
        if (message.papers && Array.isArray(message.papers)) {
          for (const paper of message.papers) {
            if (paper && paper.id) {
              papersMap.set(paper.id, paper)
            }
          }
        }
      }

      // Populate cache
      papersMap.forEach((paper, id) => {
        chatCache[id] = paper
      })

      setInitialized(true)
    }
  }, [chatId, messages, initialized, chatCache])

  // Also load from API on mount if chatId is provided
  useEffect(() => {
    if (chatId && !initialized) {
      fetch(`/api/chats/${chatId}/paper-cache`)
        .then(res => res.json())
        .then(data => {
          if (data.papers) {
            Object.entries(data.papers).forEach(([id, paper]) => {
              chatCache[id] = paper as VeritusPaper
            })
            setInitialized(true)
          }
        })
        .catch(err => {
          console.error('Error loading paper cache from chat:', err)
          setInitialized(true) // Set initialized even on error to prevent retries
        })
    }
  }, [chatId, initialized, chatCache])

  const getCachedPaper = useCallback(
    (paperId: string): VeritusPaper | null => {
      return chatCache[paperId] || null
    },
    [chatCache]
  )

  const setCachedPaper = useCallback(
    (paperId: string, paper: VeritusPaper) => {
      chatCache[paperId] = paper
      
      // Also save to chat if chatId is provided
      if (chatId) {
        fetch(`/api/chats/${chatId}/paper-cache`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paperId,
            paper,
          }),
        }).catch(err => {
          console.error('Error saving paper to chat cache:', err)
        })
      }
    },
    [chatCache, chatId]
  )

  const fetchPaperDetails = useCallback(
    async (paperId: string, useMock: boolean = false): Promise<VeritusPaper | null> => {
      // Check cache first
      const cached = getCachedPaper(paperId)
      if (cached) {
        return cached
      }

      // Fetch from API
      try {
        const response = await fetch('/api/paper/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            corpusId: paperId,
            chatId, // Include chatId so it can be saved to chat
            isMocked: useMock,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          if (data.paper) {
            // Cache and save to chat
            setCachedPaper(paperId, data.paper)
            return data.paper
          }
        }
      } catch (error) {
        console.error('Error fetching paper details:', error)
      }

      return null
    },
    [getCachedPaper, setCachedPaper, chatId]
  )

  const clearCache = useCallback(() => {
    if (chatId && globalCache[chatId]) {
      globalCache[chatId] = {}
    } else {
      cacheRef.current = {}
    }
  }, [chatId])

  return {
    getCachedPaper,
    setCachedPaper,
    fetchPaperDetails,
    clearCache,
    initialized,
  }
}
