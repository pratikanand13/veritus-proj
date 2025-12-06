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
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg font-semibold text-center">
            Sign Up
          </CardTitle>
          <CardDescription className="text-center">
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
              <label htmlFor="name" className="text-sm font-medium text-foreground">
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
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
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
              />
              <p className="text-xs text-muted-foreground">
                Only academic email addresses (IIT, NIT, IIIT) are allowed
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="areaOfInterest" className="text-sm font-medium text-foreground">
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
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
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
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

