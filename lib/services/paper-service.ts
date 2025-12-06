import { veritusClient } from './veritus-client'

/**
 * Resolve paper by title or corpusId
 * @param title Paper title (optional if corpusId provided)
 * @param corpusId Corpus ID (optional if title provided)
 * @returns Paper object
 */
export async function resolvePaper(
  title: string | null,
  corpusId: string | null
): Promise<any> {
  if (corpusId) {
    return await veritusClient.getPaperById(corpusId)
  }

  if (!title) {
    throw new Error('Title or corpusId required')
  }

  const results = await veritusClient.searchByTitle(title)

  if (!results.length) {
    throw new Error('Paper not found')
  }

  return results[0]
}

