'use client'

import { VeritusPaper } from '@/types/veritus'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, Users, Calendar, BookOpen, ExternalLink, Sparkles, Tag } from 'lucide-react'

interface PaperAccordionProps {
  papers: VeritusPaper[]
}

export function PaperAccordion({ papers }: PaperAccordionProps) {
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
                <h3 className="font-semibold text-foreground mb-1">{paper.title}</h3>
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
                    variant="outline"
                    size="sm"
                    asChild
                    className="border-green-500 text-green-500 hover:bg-green-500 hover:text-white"
                  >
                    <a href={paper.pdfLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-3 w-3" />
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

