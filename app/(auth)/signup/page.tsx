'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    areaOfInterest: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validate form data
    if (!formData.email || !formData.password || !formData.name || !formData.areaOfInterest) {
      setError('Please fill in all fields')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      console.log('Submitting signup request...', { email: formData.email, name: formData.name })
      
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      console.log('Signup response:', { status: response.status, data })

      if (!response.ok) {
        setError(data.error || 'Signup failed. Please check your information and try again.')
        setLoading(false)
        return
      }

      // Wait a moment for cookie to be set, then redirect
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 100)
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err.message || 'An error occurred. Please check your connection and try again.')
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

      {/* Glass gradient signup container */}
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
            <CardTitle className="text-lg font-semibold text-center text-white">
            Sign Up
          </CardTitle>
            <CardDescription className="text-center text-white/80">
            Create an account with your academic email
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
                <label htmlFor="name" className="text-sm font-medium text-white/90">
                Name
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Your name"
                value={formData.name}
                onChange={handleChange}
                required
                  className="rounded-md bg-black/20 border-white/20 text-white placeholder:text-white/50"
              />
            </div>

            <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-white/90">
                Academic Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@iiitg.ac.in"
                value={formData.email}
                onChange={handleChange}
                required
                  className="rounded-md bg-black/20 border-white/20 text-white placeholder:text-white/50"
              />
                <p className="text-xs text-white/70">
                Only academic email addresses (IIT, NIT, IIIT) are allowed
              </p>
            </div>

            <div className="space-y-2">
                <label htmlFor="areaOfInterest" className="text-sm font-medium text-white/90">
                Area of Interest
              </label>
              <Input
                id="areaOfInterest"
                name="areaOfInterest"
                type="text"
                placeholder="e.g., Machine Learning, Web Development"
                value={formData.areaOfInterest}
                onChange={handleChange}
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
                name="password"
                type="password"
                placeholder="At least 6 characters"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                  className="rounded-md bg-black/20 border-white/20 text-white placeholder:text-white/50"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>

              <div className="text-center text-sm text-white/80">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Login
              </Link>
            </div>
          </form>
        </CardContent>
        </div>
      </div>
    </div>
  )
}

