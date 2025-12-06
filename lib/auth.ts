import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const JWT_EXPIRY_DAYS = 7 // 7 days for academic users

export interface JWTPayload {
  userId: string
  email: string
  isAcademic: boolean
}

/**
 * Generate JWT token for user
 * Academic users get 7 days, others get 1 day
 */
export function generateToken(payload: JWTPayload): string {
  // Always use 7 days for academic users, ensure isAcademic is true
  const expiresIn = payload.isAcademic ? `${JWT_EXPIRY_DAYS}d` : '1d'
  
  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    algorithm: 'HS256', // Explicitly set algorithm for compatibility with jose
  })
  
  // Log token generation for debugging
  console.log(`Token generated for ${payload.email}, isAcademic: ${payload.isAcademic}, expiresIn: ${expiresIn}`)
  
  return token
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    return decoded
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      console.error('Token expired:', error.expiredAt)
      return null
    }
    if (error.name === 'JsonWebTokenError') {
      console.error('Invalid token:', error.message)
      return null
    }
    console.error('Token verification error:', error)
    return null
  }
}

/**
 * Get current user from token
 */
export async function getCurrentUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value

  if (!token) {
    return null
  }

  return verifyToken(token)
}

/**
 * Set auth cookie
 */
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

/**
 * Clear auth cookie
 */
export async function clearAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete('token')
}

