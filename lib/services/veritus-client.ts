import axios, { AxiosInstance } from 'axios'

const VERITUS_API_BASE_URL = 'https://discover.veritus.ai/api'

interface VeritusPaper {
  id: string
  title: string
  abstract?: string
  authors?: string
  year?: number
  impactFactor?: {
    citationCount?: number
    referenceCount?: number
    influentialCitationCount?: number
  }
  fieldsOfStudy?: string[]
  journalName?: string
  publicationType?: string
  score?: number
  [key: string]: any
}

interface JobStatus {
  status: 'queued' | 'success' | 'error'
  results?: VeritusPaper[]
  error?: string
}

class VeritusClient {
  private client: AxiosInstance

  constructor() {
    const apiKey = process.env.VERITUS_API_KEY
    if (!apiKey) {
      console.warn('VERITUS_API_KEY not found in environment variables. API calls will fail.')
    }

    this.client = axios.create({
      baseURL: VERITUS_API_BASE_URL,
      headers: {
        Authorization: `Bearer ${apiKey || ''}`,
        'Content-Type': 'application/json',
      },
    })
  }

  /**
   * Search for papers by title
   */
  async searchByTitle(title: string): Promise<VeritusPaper[]> {
    const response = await this.client.get('/v1/papers/search', {
      params: { title },
    })
    return response.data
  }

  /**
   * Get paper by corpus ID
   */
  async getPaperById(id: string): Promise<VeritusPaper> {
    const response = await this.client.get(`/v1/papers/${id}`)
    return response.data
  }

  /**
   * Create a combined search job
   * @param phrases Array of search phrases (3-10 items)
   * @param query Search query string (50-5000 characters)
   * @param limit Maximum number of results
   * @returns Job ID for polling
   */
  async createCombinedSearchJob(
    phrases: string[],
    query: string,
    limit: number = 50
  ): Promise<string> {
    const response = await this.client.post(
      '/v1/job/combinedSearch',
      { phrases, query, enrich: false },
      { params: { limit } }
    )
    return response.data.jobId
  }

  /**
   * Get job status
   * @param jobId Job ID from createCombinedSearchJob
   * @returns Job status with results if completed
   */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    const response = await this.client.get(`/v1/job/${jobId}`)
    return response.data
  }
}

// Export singleton instance
export const veritusClient = new VeritusClient()

// Export types
export type { VeritusPaper, JobStatus }

