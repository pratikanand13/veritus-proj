import { jwtVerify } from 'jose'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface JWTPayload {
  userId: string
  email: string
  isAcademic: boolean
}

/**
 * Verify JWT token in Edge Runtime (for middleware)
 * Uses jose library which is compatible with Edge Runtime
 */
export async function verifyTokenEdge(token: string): Promise<JWTPayload | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      isAcademic: payload.isAcademic as boolean,
    }
  } catch (error: any) {
    if (error.code === 'ERR_JWT_EXPIRED') {
      console.error('Token expired:', error.message)
      return null
    }
    if (error.code === 'ERR_JWT_INVALID') {
      console.error('Invalid token:', error.message)
      return null
    }
    console.error('Token verification error:', error)
    return null
  }
}

