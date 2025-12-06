import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyTokenEdge } from './lib/auth-edge'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // If accessing public route, allow
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Debug logging
  if (pathname === '/dashboard') {
    console.log('Middleware: Checking dashboard access')
    console.log('Middleware: Token exists:', !!token)
    if (token) {
      console.log('Middleware: Token length:', token.length)
    }
  }

  // If no token and trying to access protected route, redirect to login
  if (!token) {
    console.log('Middleware: No token found, redirecting to login')
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Verify token (using Edge-compatible verification)
  const payload = await verifyTokenEdge(token)
  if (!payload) {
    console.log('Middleware: Token verification failed')
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'invalid_token')
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete('token')
    return response
  }

  console.log('Middleware: Token verified successfully for user:', payload.email)

  // If accessing auth pages while logged in, redirect to dashboard
  if (isPublicRoute && payload) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

