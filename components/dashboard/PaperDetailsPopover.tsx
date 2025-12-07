'use client'

import { ReactNode, useState, useEffect } from 'react'
import { VeritusPaper } from '@/types/veritus'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ExternalLink,
  FileText,
  GitBranch,
  ShieldCheck,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  Loader2,
} from 'lucide-react'

interface PaperDetailsPopoverProps {
  paper: VeritusPaper | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const formatDate = (value?: string | null) => {
  if (!value) return 'Not available'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 'Not available'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

const MetaItem = ({ label, value, fullSpan = false }: { label: string; value: ReactNode; fullSpan?: boolean }) => (
  <div
    className={`rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm ${
      fullSpan ? 'md:col-span-2' : ''
    }`}
  >
    <p className="text-[11px] uppercase tracking-[0.1em] text-slate-400">{label}</p>
    <div className="mt-1 text-sm text-slate-50 break-words">{value}</div>
  </div>
)

const ImpactItem = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
    <p className="text-[11px] uppercase tracking-[0.1em] text-slate-400">{label}</p>
    <p className="mt-1 text-base font-semibold text-white">{value}</p>
  </div>
)

const AccessCard = ({
  label,
  href,
  icon,
  buttonLabel,
  available,
}: {
  label: string
  href?: string | null
  icon: ReactNode
  buttonLabel: string
  available: boolean
}) => {
  const isDisabled = !available

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-xs text-slate-400 break-all">{available && href ? href : 'Not available'}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-start gap-2">
        <Button
          asChild={available}
          disabled={!available}
          className={available 
            ? "bg-[#22c55e] hover:bg-[#16a34a] text-black px-4 py-2 w-full" 
            : "bg-gray-600 text-gray-400 cursor-not-allowed px-4 py-2 w-full"
          }
        >
          {available ? (
            <a href={href!} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
              {buttonLabel}
            </a>
          ) : (
            <span className="flex items-center justify-center">{buttonLabel}</span>
          )}
        </Button>
      </div>
    </div>
  )
}

export function PaperDetailsPopover({ paper, open, onOpenChange }: PaperDetailsPopoverProps) {
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isBookmarking, setIsBookmarking] = useState(false)
  const [bookmarks, setBookmarks] = useState<any[]>([])

  useEffect(() => {
    if (open && paper) {
      fetchBookmarks()
    }
  }, [open, paper])

  const fetchBookmarks = async () => {
    try {
      const response = await fetch('/api/bookmarks')
      if (response.ok) {
        const data = await response.json()
        setBookmarks(data.bookmarks || [])
        setIsBookmarked(data.bookmarks?.some((b: any) => b.paperId === paper?.id) || false)
      }
    } catch (error) {
      console.error('Error fetching bookmarks:', error)
    }
  }

  const handleBookmark = async () => {
    if (!paper || isBookmarking) return

    setIsBookmarking(true)
    try {
      if (isBookmarked) {
        // Remove bookmark
        const response = await fetch(`/api/bookmarks?paperId=${paper.id}`, {
          method: 'DELETE',
        })
        if (response.ok) {
          setIsBookmarked(false)
          setBookmarks(bookmarks.filter((b) => b.paperId !== paper.id))
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
          const data = await response.json()
          setIsBookmarked(true)
          setBookmarks([...bookmarks, data.bookmark])
        }
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error)
    } finally {
      setIsBookmarking(false)
    }
  }

  if (!paper) return null

  const pdfAvailable = !!paper.pdfLink
  const pdfHref = pdfAvailable ? paper.pdfLink : undefined
  const originalHref = paper.link || paper.titleLink || undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-[#0c0f14] border-white/10 text-slate-50">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xs uppercase tracking-[0.12em] text-slate-400">Paper</DialogTitle>
              <DialogDescription className="sr-only">Paper details</DialogDescription>
            </div>
            <Button
              onClick={handleBookmark}
              disabled={isBookmarking}
              variant="outline"
              size="sm"
              className="rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              {isBookmarking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isBookmarked ? (
                <>
                  <BookmarkCheck className="h-4 w-4 mr-2" />
                  Bookmarked
                </>
              ) : (
                <>
                  <Bookmark className="h-4 w-4 mr-2" />
                  Bookmark
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-7">
          {/* Title Section */}
          <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Title</p>
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-semibold leading-tight text-white">{paper.title}</h1>
              <p className="text-base text-slate-200">{formatValue(paper.authors)}</p>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                <span>{formatValue(paper.year)}</span>
                <span className="text-slate-600">•</span>
                <span>{paper.journalName || paper.v_journal_name || 'Not available'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-100">
                  ID: {paper.id}
                </Badge>
                <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-100">
                  Engine: {formatValue(paper.engine)}
                </Badge>
                <Badge
                  variant="outline"
                  className={`border ${paper.isOpenAccess ? 'border-emerald-400 text-emerald-300' : 'border-white/20 text-slate-100'}`}
                >
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  {paper.isOpenAccess ? 'Open Access' : 'Closed Access'}
                </Badge>
                <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-100">
                  {paper.isPrePrint ? 'Pre-Print' : 'Published'}
                </Badge>
                <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-100">
                  Downloadable: {paper.downloadable ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </section>

          {/* TLDR Section */}
          <section className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">TLDR</p>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-200">
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>Key Takeaway</span>
              </div>
              <p className="text-base leading-relaxed text-slate-100">
                {paper.tldr || 'Not available'}
              </p>
            </div>
          </section>

          {/* Abstract Section */}
          <section className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Abstract</p>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm">
              <p className="text-base leading-relaxed text-slate-100">
                {paper.abstract || 'Not available'}
              </p>
            </div>
          </section>

          {/* Metadata Box */}
          <section className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Metadata</p>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MetaItem label="Publication Type" value={formatValue(paper.publicationType)} />
                <MetaItem label="Published Year" value={formatValue(paper.year)} />
                <MetaItem label="Published Date" value={formatDate(paper.publishedAt)} />
                <MetaItem label="Journal Name" value={paper.journalName || 'Not available'} />
                <MetaItem label="Verified Journal Name" value={paper.v_journal_name || 'Not available'} />
                <MetaItem label="Publisher" value={paper.v_publisher || 'Not available'} />
                <MetaItem label="Country" value={paper.v_country || 'Not available'} />
                <MetaItem label="Quartile Ranking" value={paper.v_quartile_ranking || 'Not available'} />
                <MetaItem label="DOI" value={paper.doi ? `https://doi.org/${paper.doi}` : 'Not available'} />
                <MetaItem label="Title Link" value={paper.titleLink || 'Not available'} />
                <MetaItem label="Engine" value={formatValue(paper.engine)} />
                <MetaItem label="Corpus ID" value={paper.id} />
                <MetaItem
                  label="Fields of Study"
                  fullSpan
                  value={
                    paper.fieldsOfStudy && paper.fieldsOfStudy.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {paper.fieldsOfStudy.map((field, idx) => (
                          <div key={field} className="flex items-center gap-1">
                            <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-100">
                              {field}
                            </Badge>
                            {idx < paper.fieldsOfStudy.length - 1 && <span className="text-slate-500">,</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      'Not available'
                    )
                  }
                />
              </div>
            </div>
          </section>

          {/* Impact Metrics Box */}
          <section className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Impact Metrics</p>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ImpactItem label="Citation Count" value={formatValue(paper.impactFactor?.citationCount)} />
                <ImpactItem label="Influential Citation Count" value={formatValue(paper.impactFactor?.influentialCitationCount)} />
                <ImpactItem label="Reference Count" value={formatValue(paper.impactFactor?.referenceCount)} />
                <ImpactItem label="Score" value={paper.score ?? 'Not available'} />
              </div>
            </div>
          </section>

          {/* Access & External Links Box */}
          <section className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Access & External Links</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-fr">
              <AccessCard
                label="PDF"
                href={pdfHref}
                icon={<FileText className="h-5 w-5" />}
                buttonLabel="View PDF"
                available={pdfAvailable}
              />
              <AccessCard
                label="Semantic Scholar Page"
                href={paper.semanticLink}
                icon={<GitBranch className="h-5 w-5" />}
                buttonLabel="Semantic Scholar Page"
                available={!!paper.semanticLink}
              />
              <AccessCard
                label="Original Paper Link"
                href={originalHref}
                icon={<ExternalLink className="h-5 w-5" />}
                buttonLabel="Original Paper Link"
                available={!!originalHref}
              />
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

