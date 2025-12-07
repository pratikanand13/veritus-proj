'use client'

import { useState, useEffect } from 'react'
import { VeritusPaper } from '@/types/veritus'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, Users, Calendar, BookOpen, ExternalLink, Sparkles, Tag, Bookmark, BookmarkCheck, Loader2 } from 'lucide-react'
import { toast } from '@/lib/utils/toast'

interface PaperAccordionProps {
  papers: VeritusPaper[]
  onCreateChatFromHeading?: (title: string) => Promise<string | null>
}

export function PaperAccordion({ papers, onCreateChatFromHeading }: PaperAccordionProps) {
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set())
  const [bookmarkingIds, setBookmarkingIds] = useState<Set<string>>(new Set())

  // Fetch bookmarks on mount
  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        const response = await fetch('/api/bookmarks')
        if (response.ok) {
          const data = await response.json()
          const bookmarkIds = new Set<string>(
            (data.bookmarks || [])
              .map((b: any) => String(b.paperId))
              .filter((id: string) => id && id !== 'undefined' && id !== 'null')
          )
          setBookmarks(bookmarkIds)
        }
      } catch (error: any) {
        // Silently fail - bookmarks are optional
      }
    }
    fetchBookmarks()
  }, [])

  const handleBookmark = async (paper: VeritusPaper, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!paper.id || bookmarkingIds.has(paper.id)) return

    const isBookmarked = bookmarks.has(paper.id)
    setBookmarkingIds(prev => new Set(prev).add(paper.id))

    try {
      if (isBookmarked) {
        // Remove bookmark
        const response = await fetch(`/api/bookmarks?paperId=${paper.id}`, {
          method: 'DELETE',
        })
        if (response.ok) {
          setBookmarks(prev => {
            const newSet = new Set(prev)
            newSet.delete(paper.id)
            return newSet
          })
          toast.success('Bookmark removed', 'Paper removed from your bookmarks')
        } else {
          const errorData = await response.json()
          toast.error('Failed to remove bookmark', errorData.error || 'An unexpected error occurred')
        }
      } else {
        // Add bookmark
        const response = await fetch('/api/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paperId: paper.id,
            paper: paper,
          }),
        })
        if (response.ok) {
          setBookmarks(prev => new Set(prev).add(paper.id))
          toast.success('Bookmarked', 'Paper added to your bookmarks for cron email notifications')
        } else {
          const errorData = await response.json()
          if (errorData.error?.includes('already bookmarked')) {
            // Already bookmarked, just update state
            setBookmarks(prev => new Set(prev).add(paper.id))
            toast.info('Already bookmarked', 'This paper is already in your bookmarks')
          } else {
            toast.error('Failed to bookmark', errorData.error || 'An unexpected error occurred')
          }
        }
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error('Failed to bookmark', errorMessage)
    } finally {
      setBookmarkingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(paper.id)
        return newSet
      })
    }
  }
  if (papers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No papers found</p>
      </div>
    )
  }

  return (
    <Accordion type="single" collapsible className="w-full space-y-2">
      {papers.map((paper, index) => (
        <AccordionItem
          key={paper.id || index}
          value={`paper-${index}`}
          className="border border-border rounded-lg bg-card px-4"
        >
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-start justify-between w-full pr-4">
              <div className="flex-1 text-left">
                <h3 
                  className="font-semibold text-foreground mb-1 cursor-pointer hover:text-[#22c55e] transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onCreateChatFromHeading && paper.title) {
                      onCreateChatFromHeading(paper.title)
                    }
                  }}
                  title="Click to create a new chat with this paper title"
                >
                  {paper.title}
                </h3>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {paper.year && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {paper.year}
                    </span>
                  )}
                  {paper.impactFactor?.citationCount !== undefined && (
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {paper.impactFactor.citationCount} citations
                    </span>
                  )}
                  {paper.score !== null && paper.score !== undefined && (
                    <Badge variant="outline" className="text-xs">
                      Score: {(paper.score * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
              </div>
              {/* Bookmark Button */}
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 h-8 w-8 p-0 hover:bg-accent"
                onClick={(e) => handleBookmark(paper, e)}
                disabled={bookmarkingIds.has(paper.id || '')}
                title={bookmarks.has(paper.id || '') ? 'Remove bookmark' : 'Bookmark for cron email notifications'}
              >
                {bookmarkingIds.has(paper.id || '') ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : bookmarks.has(paper.id || '') ? (
                  <BookmarkCheck className="h-4 w-4 text-[#22c55e]" />
                ) : (
                  <Bookmark className="h-4 w-4 text-muted-foreground hover:text-[#22c55e]" />
                )}
              </Button>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2 pb-4">
              {/* Authors */}
              {paper.authors && (
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Authors</p>
                    <p className="text-sm text-foreground">{paper.authors}</p>
                  </div>
                </div>
              )}

              {/* TLDR */}
              {paper.tldr && (
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">TLDR</p>
                    <p className="text-sm text-foreground italic bg-muted p-3 rounded-md border-l-2 border-green-500/50">
                      {paper.tldr}
                    </p>
                  </div>
                </div>
              )}

              {/* Abstract */}
              {paper.abstract && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Abstract</p>
                  <p className="text-sm text-foreground leading-relaxed">{paper.abstract}</p>
                </div>
              )}

              {/* Journal */}
              {paper.journalName && (
                <div className="flex items-start gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Journal</p>
                    <p className="text-sm text-foreground">{paper.journalName}</p>
                  </div>
                </div>
              )}

              {/* Publication Type */}
              {paper.publicationType && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Publication Type</p>
                  <Badge variant="outline" className="text-xs">
                    {paper.publicationType}
                  </Badge>
                </div>
              )}

              {/* Fields of Study */}
              {paper.fieldsOfStudy && paper.fieldsOfStudy.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Fields of Study</p>
                  <div className="flex flex-wrap gap-2">
                    {paper.fieldsOfStudy.map((field, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        <Tag className="h-3 w-3 mr-1" />
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* PDF Link */}
              {paper.pdfLink && (
                <div className="pt-2">
                  <Button
                    asChild
                    className="bg-[#22c55e] hover:bg-[#16a34a] text-black px-4 py-2"
                  >
                    <a href={paper.pdfLink} target="_blank" rel="noopener noreferrer" className="flex items-center">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View PDF
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

