'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp'

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    areaOfInterest: '',
  })
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingOTP, setSendingOTP] = useState(false)
  const [otpExpiresIn, setOtpExpiresIn] = useState<number | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
    setError('')
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSendingOTP(true)

    // Validate form data
    if (!formData.email || !formData.password || !formData.name || !formData.areaOfInterest) {
      setError('Please fill in all fields')
      setSendingOTP(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      setSendingOTP(false)
      return
    }

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: formData.email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to send OTP. Please try again.')
        setSendingOTP(false)
        return
      }

      // Move to OTP step
      setStep('otp')
      
      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      
      const expiresInMinutes = data.expiresIn || 10
      setOtpExpiresIn(expiresInMinutes)
      
      // Start countdown timer
      let timeLeft = expiresInMinutes * 60 // Convert to seconds
      timerRef.current = setInterval(() => {
        timeLeft--
        const minutesLeft = Math.ceil(timeLeft / 60) // Use Math.ceil to show remaining minutes correctly
        setOtpExpiresIn(minutesLeft)
        if (timeLeft <= 0) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          setOtpExpiresIn(null)
        }
      }, 1000)
    } catch (err: any) {
      console.error('Send OTP error:', err)
      setError(err.message || 'An error occurred. Please check your connection and try again.')
      setSendingOTP(false)
    } finally {
      setSendingOTP(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          otp,
          password: formData.password,
          name: formData.name,
          areaOfInterest: formData.areaOfInterest,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Invalid OTP. Please try again.')
        setLoading(false)
        return
      }

      // Wait a moment for cookie to be set, then redirect
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 100)
    } catch (err: any) {
      console.error('Verify OTP error:', err)
      setError(err.message || 'An error occurred. Please check your connection and try again.')
      setLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setError('')
    setSendingOTP(true)
    setOtp('')

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: formData.email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to resend OTP. Please try again.')
        setSendingOTP(false)
        return
      }

      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      
      const expiresInMinutes = data.expiresIn || 10
      setOtpExpiresIn(expiresInMinutes)
      
      // Restart countdown timer
      let timeLeft = expiresInMinutes * 60 // Convert to seconds
      timerRef.current = setInterval(() => {
        timeLeft--
        const minutesLeft = Math.ceil(timeLeft / 60) // Use Math.ceil to show remaining minutes correctly
        setOtpExpiresIn(minutesLeft)
        if (timeLeft <= 0) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          setOtpExpiresIn(null)
        }
      }, 1000)
      
      setSendingOTP(false)
    } catch (err: any) {
      console.error('Resend OTP error:', err)
      setError(err.message || 'An error occurred. Please try again.')
      setSendingOTP(false)
    }
  }

  if (step === 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-semibold text-center">
              Verify Your Email
            </CardTitle>
            <CardDescription className="text-center">
              We've sent a 6-digit code to <strong>{formData.email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive-foreground bg-destructive/20 border border-destructive rounded-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-center" onClick={() => {
                // Focus the OTP input when clicking anywhere in this area
                const input = document.querySelector('[data-otp-container] input') as HTMLInputElement
                input?.focus()
              }}>
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(value) => {
                    setOtp(value)
                    setError('') // Clear error when user types
                  }}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {otpExpiresIn !== null && (
                <p className="text-center text-sm text-muted-foreground">
                  Code expires in {otpExpiresIn} minute{otpExpiresIn !== 1 ? 's' : ''}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full"
              >
                {loading ? 'Verifying...' : 'Verify & Sign Up'}
              </Button>

              <div className="text-center space-y-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResendOTP}
                  disabled={sendingOTP}
                  className="text-sm"
                >
                  {sendingOTP ? 'Sending...' : "Didn't receive code? Resend"}
                </Button>
                <div>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      setStep('form')
                      setOtp('')
                      setError('')
                    }}
                    className="text-sm"
                  >
                    ← Back to form
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
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
            Create an account with your email
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendOTP} className="space-y-4">
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
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
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
              disabled={sendingOTP}
              className="w-full"
            >
              {sendingOTP ? 'Sending OTP...' : 'Send Verification Code'}
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
