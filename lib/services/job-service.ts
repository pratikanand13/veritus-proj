import { veritusClient } from './veritus-client'
import delay from './utils/delay'

/**
 * Run combined search with job polling
 * Creates a job, polls every 2 seconds until completion (max 30 attempts = 60 seconds)
 * @param phrases Array of search phrases
 * @param query Search query string
 * @param limit Maximum number of results
 * @returns Array of papers from search results
 */
export async function runCombinedSearch(
  phrases: string[],
  query: string,
  limit: number = 50
): Promise<any[]> {
  const jobId = await veritusClient.createCombinedSearchJob(phrases, query, limit)

  // Poll job status every 2 seconds, max 30 attempts (60 seconds total)
  for (let i = 0; i < 30; i++) {
    const status = await veritusClient.getJobStatus(jobId)

    if (status.status === 'success') {
      return status.results || []
    }
    if (status.status === 'error') {
      throw new Error(status.error || 'Veritus job failed')
    }

    // Wait 2 seconds before next poll
    await delay(2000)
  }

  throw new Error('Job polling timed out after 60 seconds')
}

