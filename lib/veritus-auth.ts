import { getCurrentUser } from './auth'
import connectDB from './db'
import UserSettings from '@/models/UserSettings'

/**
 * Get Veritus API key for current user
 * Returns user's API key if set, otherwise falls back to environment variable
 */
export async function getVeritusApiKey(): Promise<string> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  await connectDB()

  // Try to get user's API key
  const userSettings = await UserSettings.findOne({ userId: user.userId })
  if (userSettings?.veritusApiKey) {
    return userSettings.veritusApiKey
  }

  // Fallback to environment variable
  const envApiKey = process.env.VERITUS_API_KEY
  if (!envApiKey) {
    throw new Error('Veritus API key not configured. Please set your API key in settings or configure VERITUS_API_KEY environment variable.')
  }

  return envApiKey
}

