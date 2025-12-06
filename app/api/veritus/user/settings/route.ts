import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import connectDB from '@/lib/db'
import UserSettings from '@/models/UserSettings'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await connectDB()
    const settings = await UserSettings.findOne({ userId: user.userId })

    return NextResponse.json({
      settings: settings ? {
        hasApiKey: !!settings.veritusApiKey,
        searchPreferences: settings.searchPreferences,
      } : {
        hasApiKey: false,
        searchPreferences: null,
      },
    })
  } catch (error) {
    console.error('Error fetching user settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await connectDB()
    const body = await request.json()
    const { veritusApiKey, searchPreferences } = body

    let settings = await UserSettings.findOne({ userId: user.userId })

    if (!settings) {
      settings = new UserSettings({
        userId: user.userId,
        veritusApiKey,
        searchPreferences,
      })
    } else {
      if (veritusApiKey !== undefined) {
        settings.veritusApiKey = veritusApiKey || undefined
      }
      if (searchPreferences !== undefined) {
        settings.searchPreferences = searchPreferences
      }
    }

    await settings.save()

    return NextResponse.json({
      message: 'Settings updated successfully',
      settings: {
        hasApiKey: !!settings.veritusApiKey,
        searchPreferences: settings.searchPreferences,
      },
    })
  } catch (error) {
    console.error('Error updating user settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

