import { NextResponse } from 'next/server'
import { clearAuthCookie } from '@/lib/auth'

export async function POST() {
  await clearAuthCookie()
  return NextResponse.json({ message: 'Logged out successfully' }, { status: 200 })
}

