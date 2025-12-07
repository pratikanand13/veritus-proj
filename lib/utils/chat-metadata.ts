import { VeritusPaper } from '@/types/veritus'
import Chat from '@/models/Chat'
import { ChatMetadata } from '@/models/Chat'

/**
 * Extract metadata from a paper
 */
export function extractMetadata(paper: VeritusPaper): Partial<ChatMetadata> {
  const metadata: Partial<ChatMetadata> = {
    authors: paper.authors?.split(',').map(a => a.trim()).filter(Boolean) || [],
    keywords: paper.fieldsOfStudy || [],
    abstracts: paper.abstract ? [paper.abstract] : [],
    tldrs: paper.tldr ? [paper.tldr] : [],
    publicationTypes: paper.publicationType ? [paper.publicationType] : [],
    publishedDates: paper.publishedAt 
      ? [new Date(paper.publishedAt)] 
      : paper.year 
        ? [new Date(paper.year, 0, 1)] 
        : [null],
    quartileRankings: paper.v_quartile_ranking ? [paper.v_quartile_ranking] : [],
    journalNames: paper.journalName ? [paper.journalName] : [],
    citationCounts: paper.impactFactor?.citationCount ? [paper.impactFactor.citationCount] : [],
  }

  return metadata
}

/**
 * Merge new metadata into existing chat metadata
 * IMPORTANT: This function merges metadata within a SINGLE chat's context.
 * Each chat maintains its own isolated chatMetadata field.
 */
export function mergeMetadata(
  existing: ChatMetadata | undefined,
  newData: Partial<ChatMetadata>
): ChatMetadata {
  const base: ChatMetadata = existing || {
    authors: [],
    keywords: [],
    abstracts: [],
    tldrs: [],
    publicationTypes: [],
    publishedDates: [],
    quartileRankings: [],
    journalNames: [],
    citationCounts: [],
  }

  return {
    authors: [...new Set([...(base.authors || []), ...(newData.authors || [])])],
    keywords: [...new Set([...(base.keywords || []), ...(newData.keywords || [])])],
    abstracts: [...(base.abstracts || []), ...(newData.abstracts || [])].filter(Boolean),
    tldrs: [...(base.tldrs || []), ...(newData.tldrs || [])].filter(Boolean),
    publicationTypes: [...new Set([...(base.publicationTypes || []), ...(newData.publicationTypes || [])])],
    publishedDates: [...(base.publishedDates || []), ...(newData.publishedDates || [])],
    quartileRankings: [...new Set([...(base.quartileRankings || []), ...(newData.quartileRankings || [])])],
    journalNames: [...new Set([...(base.journalNames || []), ...(newData.journalNames || [])])],
    citationCounts: [...(base.citationCounts || []), ...(newData.citationCounts || [])],
    // Spread additional metadata
    ...base,
    ...newData,
  }
}

/**
 * Update chat metadata with paper data
 * 
 * IMPORTANT: This function updates metadata for a SPECIFIC chat instance.
 * The chat object must be fetched with the correct chatId and userId to ensure
 * metadata isolation between different chat sessions.
 * 
 * Each chat has its own chatMetadata field that is completely isolated from other chats.
 * When updating metadata, we:
 * 1. Fetch the specific chat by chatId AND userId (security + isolation)
 * 2. Merge new metadata into that chat's existing metadata only
 * 3. Save the chat document, ensuring metadata stays scoped to that chat
 * 
 * @param chat - The chat document instance (must be fetched with chatId and userId)
 * @param paper - The paper data to extract metadata from
 * @throws Error if chat instance is invalid
 */
export async function updateChatMetadata(chat: any, paper: VeritusPaper): Promise<void> {
  if (!chat || !chat._id) {
    throw new Error('Chat instance is required and must have an _id. Ensure chat is fetched with chatId and userId.')
  }
  
  const newMetadata = extractMetadata(paper)
  
  // Get existing metadata or initialize empty
  // This ensures each chat maintains its own isolated metadata
  const existingMetadata = chat.chatMetadata || {}
  
  // Merge metadata - this merges into the existing chat's metadata only
  // The mergeMetadata function operates on a single chat's metadata context
  const updatedMetadata = mergeMetadata(existingMetadata as ChatMetadata, newMetadata)
  
  // Update chat document - scoped to this specific chat instance
  // This ensures metadata is stored per chatId, maintaining isolation
  chat.chatMetadata = updatedMetadata
  chat.updatedAt = new Date()
}

/**
 * Extract metadata from multiple papers
 * This is used for batch operations where multiple papers are processed together.
 * The extracted metadata will then be merged into a specific chat's metadata.
 */
export function extractMetadataFromPapers(papers: VeritusPaper[]): Partial<ChatMetadata> {
  const combined: Partial<ChatMetadata> = {
    authors: [],
    keywords: [],
    abstracts: [],
    tldrs: [],
    publicationTypes: [],
    publishedDates: [],
    quartileRankings: [],
    journalNames: [],
    citationCounts: [],
  }

  papers.forEach(paper => {
    const metadata = extractMetadata(paper)
    combined.authors = [...new Set([...combined.authors!, ...(metadata.authors || [])])]
    combined.keywords = [...new Set([...combined.keywords!, ...(metadata.keywords || [])])]
    combined.abstracts = [...combined.abstracts!, ...(metadata.abstracts || [])].filter(Boolean)
    combined.tldrs = [...combined.tldrs!, ...(metadata.tldrs || [])].filter(Boolean)
    combined.publicationTypes = [...new Set([...combined.publicationTypes!, ...(metadata.publicationTypes || [])])]
    combined.publishedDates = [...combined.publishedDates!, ...(metadata.publishedDates || [])]
    combined.quartileRankings = [...new Set([...combined.quartileRankings!, ...(metadata.quartileRankings || [])])]
    combined.journalNames = [...new Set([...combined.journalNames!, ...(metadata.journalNames || [])])]
    combined.citationCounts = [...combined.citationCounts!, ...(metadata.citationCounts || [])]
  })

  return combined
}
