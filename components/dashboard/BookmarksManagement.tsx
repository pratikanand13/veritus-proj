'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Bookmark, BookmarkCheck, Trash2, Mail, MailCheck, MailX, Loader2, Search, X } from 'lucide-react'
// Table component - using simple div-based layout
// Using simple confirm dialog instead of AlertDialog

interface Bookmark {
  paperId: string
  title: string
  tldr?: string
  authors?: string
  keywords: string[]
  bookmarkedAt: string
}

interface EmailNotificationStatus {
  lastSent?: string
  totalSent: number
  enabled: boolean
}

interface BookmarksManagementProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BookmarksManagement({ open, onOpenChange }: BookmarksManagementProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [emailStatus, setEmailStatus] = useState<EmailNotificationStatus>({
    totalSent: 0,
    enabled: true,
  })
  const [updatingEmailSettings, setUpdatingEmailSettings] = useState(false)

  useEffect(() => {
    if (open) {
      fetchBookmarks()
      fetchEmailStatus()
    }
  }, [open])

  const fetchBookmarks = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/bookmarks')
      if (response.ok) {
        const data = await response.json()
        setBookmarks(data.bookmarks || [])
      }
    } catch (error) {
      console.error('Error fetching bookmarks:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEmailStatus = async () => {
    try {
      const response = await fetch('/api/user/email-notifications')
      if (response.ok) {
        const data = await response.json()
        setEmailStatus({
          lastSent: data.lastSent,
          totalSent: data.totalSent || 0,
          enabled: data.enabled !== false,
        })
      }
    } catch (error) {
      console.error('Error fetching email status:', error)
    }
  }

  const handleDelete = async (bookmark: Bookmark) => {
    if (!confirm(`Are you sure you want to delete the bookmark for "${bookmark.title}"?`)) {
      return
    }

    setDeletingId(bookmark.paperId)
    try {
      const response = await fetch(`/api/bookmarks?paperId=${bookmark.paperId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setBookmarks(bookmarks.filter((b) => b.paperId !== bookmark.paperId))
      }
    } catch (error) {
      console.error('Error deleting bookmark:', error)
    } finally {
      setDeletingId(null)
    }
  }

  const toggleEmailNotifications = async () => {
    setUpdatingEmailSettings(true)
    try {
      const response = await fetch('/api/user/email-notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !emailStatus.enabled }),
      })
      if (response.ok) {
        setEmailStatus({ ...emailStatus, enabled: !emailStatus.enabled })
      }
    } catch (error) {
      console.error('Error updating email settings:', error)
    } finally {
      setUpdatingEmailSettings(false)
    }
  }

  const filteredBookmarks = bookmarks.filter((bookmark) =>
    bookmark.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bookmark.authors?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bookmark.keywords.some((kw) => kw.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-muted-foreground" />
              <DialogTitle className="text-card-foreground">Bookmarks Management</DialogTitle>
            </div>
            <DialogDescription className="text-muted-foreground">
              Manage your bookmarked papers and email notification preferences
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Email Notification Status */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {emailStatus.enabled ? (
                    <MailCheck className="h-5 w-5 text-primary" />
                  ) : (
                    <MailX className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <div className="font-medium text-card-foreground">
                      Email Notifications: {emailStatus.enabled ? 'Enabled' : 'Disabled'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {emailStatus.lastSent
                        ? `Last sent: ${formatDate(emailStatus.lastSent)}`
                        : 'No emails sent yet'}
                      {' • '}
                      Total sent: {emailStatus.totalSent}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={toggleEmailNotifications}
                  disabled={updatingEmailSettings}
                  variant={emailStatus.enabled ? 'outline' : 'default'}
                  size="sm"
                  className={emailStatus.enabled ? 'border-border hover:bg-accent' : ''}
                >
                  {updatingEmailSettings ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : emailStatus.enabled ? (
                    <MailX className="h-4 w-4 mr-2" />
                  ) : (
                    <MailCheck className="h-4 w-4 mr-2" />
                  )}
                  {emailStatus.enabled ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bookmarks by title, authors, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card border-border text-card-foreground placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-accent"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </div>

            {/* Bookmarks Table */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredBookmarks.length === 0 ? (
              <div className="text-center py-12">
                <Bookmark className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-card-foreground">
                  {searchQuery ? 'No bookmarks match your search' : 'No bookmarks yet'}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {searchQuery
                    ? 'Try adjusting your search terms'
                    : 'Bookmark papers to receive daily email recommendations'}
                </p>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 p-4 bg-muted/50 border-b border-border font-medium text-sm text-card-foreground">
                  <div className="col-span-5">Title</div>
                  <div className="col-span-2">Authors</div>
                  <div className="col-span-2">Keywords</div>
                  <div className="col-span-2">Bookmarked</div>
                  <div className="col-span-1">Actions</div>
                </div>
                {/* Table Body */}
                <div className="divide-y divide-border">
                  {filteredBookmarks.map((bookmark) => (
                    <div key={bookmark.paperId} className="grid grid-cols-12 gap-4 p-4 hover:bg-accent/50 transition-colors">
                      <div className="col-span-5">
                        <div className="font-medium text-card-foreground">{bookmark.title}</div>
                        {bookmark.tldr && (
                          <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {bookmark.tldr}
                          </div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <div className="text-sm text-muted-foreground">
                          {bookmark.authors || 'N/A'}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="flex flex-wrap gap-1">
                          {bookmark.keywords.slice(0, 3).map((keyword, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs border-border bg-card/50 text-card-foreground">
                              {keyword.length > 15 ? `${keyword.substring(0, 15)}...` : keyword}
                            </Badge>
                          ))}
                          {bookmark.keywords.length > 3 && (
                            <Badge variant="outline" className="text-xs border-border bg-card/50 text-card-foreground">
                              +{bookmark.keywords.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-sm text-muted-foreground">
                          {formatDate(bookmark.bookmarkedAt)}
                        </div>
                      </div>
                      <div className="col-span-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(bookmark)}
                          disabled={deletingId === bookmark.paperId}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          {deletingId === bookmark.paperId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            {bookmarks.length > 0 && (
              <div className="text-sm text-muted-foreground text-center">
                Showing {filteredBookmarks.length} of {bookmarks.length} bookmark
                {bookmarks.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

