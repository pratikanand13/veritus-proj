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
 */
export async function updateChatMetadata(chat: any, paper: VeritusPaper): Promise<void> {
  const newMetadata = extractMetadata(paper)
  
  // Get existing metadata or initialize empty
  const existingMetadata = chat.chatMetadata || {}
  
  // Merge metadata
  const updatedMetadata = mergeMetadata(existingMetadata as ChatMetadata, newMetadata)
  
  // Update chat document
  chat.chatMetadata = updatedMetadata
  chat.updatedAt = new Date()
}

/**
 * Extract metadata from multiple papers
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
