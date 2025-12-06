'use client'

import { useState } from 'react'
import { VeritusPaper } from '@/types/veritus'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FileText, ExternalLink, Download } from 'lucide-react'

interface PaperSearchResultsProps {
  papers: VeritusPaper[]
  selectedPapers: string[]
  onTogglePaper: (paperId: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
}

export function PaperSearchResults({
  papers,
  selectedPapers,
  onTogglePaper,
  onSelectAll,
  onDeselectAll,
}: PaperSearchResultsProps) {
  const [expandedPaper, setExpandedPaper] = useState<string | null>(null)

  if (papers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No papers found. Try a different search.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {selectedPapers.length} of {papers.length} papers selected
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectAll}
            className="border-[#2a2a2a] text-gray-300 text-xs"
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDeselectAll}
            className="border-[#2a2a2a] text-gray-300 text-xs"
          >
            Deselect All
          </Button>
        </div>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {papers.map((paper) => (
          <Card
            key={paper.id}
            className={`bg-[#1f1f1f] border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors ${
              selectedPapers.includes(paper.id) ? 'border-blue-500' : ''
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedPapers.includes(paper.id)}
                  onCheckedChange={() => onTogglePaper(paper.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <CardTitle className="text-white text-base mb-2 line-clamp-2">
                    {paper.title}
                  </CardTitle>
                  <CardDescription className="text-gray-400 text-sm mb-2">
                    {paper.authors}
                  </CardDescription>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    {paper.year && <span>{paper.year}</span>}
                    {paper.journalName && <span>• {paper.journalName}</span>}
                    {paper.impactFactor && (
                      <span>• {paper.impactFactor.citationCount} citations</span>
                    )}
                    {paper.isOpenAccess && (
                      <span className="text-green-400">• Open Access</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  {paper.pdfLink && (
                    <a
                      href={paper.pdfLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-[#2a2a2a] rounded"
                      title="Download PDF"
                    >
                      <Download className="h-4 w-4 text-gray-400" />
                    </a>
                  )}
                  {paper.link && (
                    <a
                      href={paper.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-[#2a2a2a] rounded"
                      title="View paper"
                    >
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </a>
                  )}
                </div>
              </div>
            </CardHeader>
            {(paper.abstract || paper.tldr) && (
              <CardContent className="pt-0">
                <button
                  onClick={() => setExpandedPaper(expandedPaper === paper.id ? null : paper.id)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  {expandedPaper === paper.id ? 'Hide' : 'Show'} {paper.tldr ? 'TLDR' : 'Abstract'}
                </button>
                {expandedPaper === paper.id && (
                  <div className="mt-2 text-sm text-gray-300">
                    {paper.tldr ? (
                      <p className="italic">{paper.tldr}</p>
                    ) : (
                      <p className="line-clamp-4">{paper.abstract}</p>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

