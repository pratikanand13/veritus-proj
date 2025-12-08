'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Force dynamic rendering to prevent prerendering errors with useSearchParams
export const dynamic = 'force-dynamic'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam === 'invalid_token') {
      setError('Your session has expired. Please login again.')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Ensure cookies are sent
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }

      // Success - wait a moment for cookie to be processed by browser
      // Then redirect to dashboard
      setTimeout(() => {
        // Force a full page reload to ensure middleware sees the cookie
        window.location.href = '/dashboard'
      }, 200)
    } catch (err) {
      console.error('Login error:', err)
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-10">
      {/* Base black to grey gradient - pure grey tones, no blue */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-neutral-950 to-zinc-950" />

      {/* Subtle grey/white gradient overlay */}
      <div 
        className="absolute inset-0 opacity-25"
        style={{
          background: `
            radial-gradient(ellipse at 20% 30%, rgba(115, 115, 115, 0.2) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 70%, rgba(82, 82, 82, 0.18) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(163, 163, 163, 0.15) 0%, transparent 60%)
          `,
        }}
      />

      {/* Very light white shadows at random places */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[15%] left-[10%] w-64 h-64 rounded-full bg-white/5 blur-[80px]" />
        <div className="absolute top-[60%] right-[15%] w-72 h-72 rounded-full bg-white/4 blur-[100px]" />
        <div className="absolute bottom-[20%] left-[25%] w-56 h-56 rounded-full bg-white/6 blur-[70px]" />
        <div className="absolute top-[35%] right-[40%] w-48 h-48 rounded-full bg-white/5 blur-[60px]" />
        <div className="absolute bottom-[45%] right-[20%] w-80 h-80 rounded-full bg-white/4 blur-[90px]" />
        <div className="absolute top-[75%] left-[50%] w-52 h-52 rounded-full bg-white/5 blur-[65px]" />
        <div className="absolute top-[10%] right-[60%] w-60 h-60 rounded-full bg-white/4 blur-[75px]" />
      </div>

      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Blurred background overlay */}
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[8px]" />

      {/* Glass gradient login container */}
      <div className="relative z-10 w-full max-w-md">
        <div
          className="relative rounded-lg border border-white/30 p-8 shadow-2xl"
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)",
          }}
        >
          <CardHeader className="space-y-1">
            {/* Logo/Branding */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-xl font-semibold text-white">
                  Research Hub
                </CardTitle>
                <CardDescription className="text-xs text-white/80">
                  Academic Papers Platform
                </CardDescription>
              </div>
            </div>
            <CardTitle className="text-lg font-semibold text-center text-white">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-center text-white/80">
              Enter your academic email to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive-foreground bg-destructive/20 border border-destructive rounded-sm">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-white/90">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@iiitg.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-md bg-black/20 border-white/20 text-white placeholder:text-white/50"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-white/90">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="rounded-md bg-black/20 border-white/20 text-white placeholder:text-white/50"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Logging in...' : 'Login'}
              </Button>

              <div className="text-center text-sm text-white/80">
                Don't have an account?{' '}
                <Link href="/signup" className="text-primary hover:underline font-medium">
                  Sign up
                </Link>
              </div>
            </form>
          </CardContent>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-10">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-neutral-950 to-zinc-950" />
        <div className="absolute inset-0 bg-black/10 backdrop-blur-[8px]" />
        <div className="relative z-10 w-full max-w-md">
          <div
            className="relative rounded-lg border border-white/30 p-8 shadow-2xl"
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)",
            }}
          >
            <CardContent className="pt-6">
              <div className="text-center text-white/80">Loading...</div>
            </CardContent>
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

