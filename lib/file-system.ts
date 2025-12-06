import { promises as fs } from 'fs'
import path from 'path'
import { CitationNetwork } from '@/types/veritus'

const ANALYTICS_BASE_DIR = path.join(process.cwd(), 'analytics')

/**
 * Get analytics path for a user/project/chat
 */
export function getAnalyticsPath(username: string, projectName?: string, chatId?: string): string {
  let analyticsPath = path.join(ANALYTICS_BASE_DIR, username)
  
  if (projectName) {
    analyticsPath = path.join(analyticsPath, projectName)
  }
  
  if (chatId) {
    analyticsPath = path.join(analyticsPath, chatId)
  }
  
  return analyticsPath
}

/**
 * Create directory structure for analytics
 */
export async function createAnalyticsDirectory(username: string, projectName?: string, chatId?: string): Promise<string> {
  const analyticsPath = getAnalyticsPath(username, projectName, chatId)
  
  try {
    await fs.mkdir(analyticsPath, { recursive: true })
    return analyticsPath
  } catch (error) {
    console.error('Error creating analytics directory:', error)
    throw new Error('Failed to create analytics directory')
  }
}

/**
 * Save chat data to file
 */
export async function saveChatData(
  username: string,
  projectName: string,
  chatId: string,
  data: any
): Promise<void> {
  const analyticsPath = await createAnalyticsDirectory(username, projectName, chatId)
  const filePath = path.join(analyticsPath, 'data.json')
  
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error saving chat data:', error)
    throw new Error('Failed to save chat data')
  }
}

/**
 * Read chat data from file
 */
export async function readChatData(
  username: string,
  projectName: string,
  chatId: string
): Promise<any | null> {
  const analyticsPath = getAnalyticsPath(username, projectName, chatId)
  const filePath = path.join(analyticsPath, 'data.json')
  
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return null
  }
}

/**
 * List projects for a user
 */
export async function listUserProjects(username: string): Promise<string[]> {
  const userPath = getAnalyticsPath(username)
  
  try {
    const entries = await fs.readdir(userPath, { withFileTypes: true })
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
  } catch (error) {
    return []
  }
}

/**
 * List chats for a project
 */
export async function listProjectChats(username: string, projectName: string): Promise<string[]> {
  const projectPath = getAnalyticsPath(username, projectName)
  
  try {
    const entries = await fs.readdir(projectPath, { withFileTypes: true })
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
  } catch (error) {
    return []
  }
}

/**
 * Save citation network to file system
 */
export async function saveCitationNetwork(
  username: string,
  projectName: string,
  chatId: string,
  networkId: string,
  network: CitationNetwork
): Promise<void> {
  const chatPath = getAnalyticsPath(username, projectName, chatId)
  const networksPath = path.join(chatPath, 'citation-networks')
  
  try {
    await fs.mkdir(networksPath, { recursive: true })
  } catch (error) {
    console.error('Error creating citation networks directory:', error)
    throw new Error('Failed to create citation networks directory')
  }
  
  const filePath = path.join(networksPath, `${networkId}.json`)
  try {
    await fs.writeFile(filePath, JSON.stringify(network, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error saving citation network:', error)
    throw new Error('Failed to save citation network')
  }
}

/**
 * Get citation networks for a chat
 */
export async function getCitationNetworks(
  username: string,
  projectName: string,
  chatId: string
): Promise<CitationNetwork[]> {
  const chatPath = getAnalyticsPath(username, projectName, chatId)
  const networksPath = path.join(chatPath, 'citation-networks')
  
  try {
    const files = await fs.readdir(networksPath)
    const networks: CitationNetwork[] = []
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(networksPath, file)
        const content = await fs.readFile(filePath, 'utf-8')
        networks.push(JSON.parse(content))
      }
    }
    
    return networks
  } catch (error) {
    // Directory doesn't exist yet, return empty array
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    console.error('Error reading citation networks:', error)
    throw new Error('Failed to read citation networks')
  }
}

