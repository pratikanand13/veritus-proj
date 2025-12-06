'use client'

import { useState, useEffect } from 'react'
import { Key, CheckCircle2, AlertCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VeritusCredits } from '@/types/veritus'

interface ApiKeySettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ApiKeySettings({ open, onOpenChange }: ApiKeySettingsProps) {
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [credits, setCredits] = useState<VeritusCredits | null>(null)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (open) {
      loadSettings()
    }
  }, [open])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/veritus/user/settings')
      if (response.ok) {
        const data = await response.json()
        setHasApiKey(data.settings.hasApiKey)
        if (data.settings.hasApiKey) {
          await loadCredits()
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const loadCredits = async () => {
    try {
      const response = await fetch('/api/veritus/credits')
      if (response.ok) {
        const data = await response.json()
        setCredits(data)
      }
    } catch (error: any) {
      console.error('Error loading credits:', error)
      if (error.message?.includes('API key')) {
        setError('Invalid API key. Please check your key and try again.')
      }
    }
  }

  const handleTestApiKey = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key')
      return
    }

    setTesting(true)
    setError('')

    try {
      // Temporarily save and test
      const response = await fetch('/api/veritus/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ veritusApiKey: apiKey.trim() }),
      })

      if (response.ok) {
        await loadCredits()
        setHasApiKey(true)
        setError('')
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to save API key')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to test API key')
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/veritus/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ veritusApiKey: apiKey.trim() }),
      })

      if (response.ok) {
        await loadCredits()
        setHasApiKey(true)
        onOpenChange(false)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to save API key')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save API key')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove your API key?')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/veritus/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ veritusApiKey: '' }),
      })

      if (response.ok) {
        setApiKey('')
        setHasApiKey(false)
        setCredits(null)
      }
    } catch (err) {
      setError('Failed to remove API key')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-gray-400" />
            <DialogTitle>Veritus API Settings</DialogTitle>
          </div>
          <DialogDescription>
            Manage your Veritus API key for paper search and citation network visualization
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-0 space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {hasApiKey && credits && (
            <div className="p-4 bg-green-900/20 border border-green-800 rounded-md">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <span className="text-green-400 font-medium">API Key Configured</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-400">Free Tier Credits</div>
                  <div className="text-white font-medium">
                    {credits.freeTierCreditsBalance} / {credits.freeTierCreditsTotal}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Pro Tier Credits</div>
                  <div className="text-white font-medium">
                    {credits.proTierCreditsBalance} / {credits.proTierCreditsTotal}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-gray-400">Plan</div>
                  <div className="text-white font-medium capitalize">{credits.plan}</div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="api-key" className="text-sm font-medium text-gray-300">
              Veritus API Key {hasApiKey && '(hidden)'}
            </label>
            <div className="flex gap-2">
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your Veritus API key"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setError('')
                }}
                className="bg-[#171717] border-[#2a2a2a] text-white placeholder:text-gray-500"
              />
              <Button
                onClick={handleTestApiKey}
                disabled={testing || !apiKey.trim()}
                variant="outline"
                className="border-[#2a2a2a] text-gray-300"
              >
                {testing ? 'Testing...' : 'Test'}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Get your API key from{' '}
              <a href="https://www.veritus.ai" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                veritus.ai
              </a>
            </p>
          </div>
        </div>

        <DialogFooter>
          {hasApiKey && (
            <Button
              onClick={handleRemove}
              variant="outline"
              className="border-red-800 text-red-400 hover:bg-red-900/20"
            >
              Remove API Key
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={loading || !apiKey.trim()}
            className="bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white"
          >
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

