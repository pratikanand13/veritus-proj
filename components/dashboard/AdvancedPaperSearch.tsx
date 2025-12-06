'use client'

import { useState } from 'react'
import { Search, Loader2, X, Plus, Sparkles, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { VeritusPaper } from '@/types/veritus'
import { shouldUseMockData } from '@/lib/config/mock-config'
// Using a simple state-based collapsible instead

interface AdvancedPaperSearchProps {
  chatId?: string | null
  onSearchResults: (papers: VeritusPaper[]) => void
  onGenerateCitationNetwork?: (papers: VeritusPaper[]) => void
}

const VALID_FIELDS_OF_STUDY = [
  'Computer Science', 'Medicine', 'Chemistry', 'Biology', 'Materials Science',
  'Physics', 'Geology', 'Psychology', 'Art', 'History', 'Geography',
  'Sociology', 'Business', 'Political Science', 'Economics', 'Philosophy',
  'Mathematics', 'Engineering', 'Environmental Science',
  'Agricultural and Food Sciences', 'Education', 'Law', 'Linguistics'
]

const VALID_QUARTILE_RANKINGS = ['Q1', 'Q2', 'Q3', 'Q4']
const VALID_PUBLICATION_TYPES = ['journal', 'book series', 'conference']

export function AdvancedPaperSearch({ chatId, onSearchResults, onGenerateCitationNetwork }: AdvancedPaperSearchProps) {
  const [phrases, setPhrases] = useState<string[]>([''])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<VeritusPaper[]>([])
  const [showFilters, setShowFilters] = useState(false)
  
  // Filter states
  const [selectedFieldsOfStudy, setSelectedFieldsOfStudy] = useState<string[]>([])
  const [minCitationCount, setMinCitationCount] = useState<number | undefined>()
  const [openAccessPdf, setOpenAccessPdf] = useState<boolean | undefined>()
  const [downloadable, setDownloadable] = useState<boolean | undefined>()
  const [selectedQuartiles, setSelectedQuartiles] = useState<string[]>([])
  const [selectedPublicationTypes, setSelectedPublicationTypes] = useState<string[]>([])
  const [sort, setSort] = useState<string>('')
  const [year, setYear] = useState<string>('')
  const [limit, setLimit] = useState<100 | 200 | 300>(100)

  const useMock = shouldUseMockData()

  const addPhrase = () => {
    if (phrases.length < 10) {
      setPhrases([...phrases, ''])
    }
  }

  const removePhrase = (index: number) => {
    if (phrases.length > 1) {
      setPhrases(phrases.filter((_, i) => i !== index))
    }
  }

  const updatePhrase = (index: number, value: string) => {
    const newPhrases = [...phrases]
    newPhrases[index] = value
    setPhrases(newPhrases)
  }

  const toggleFieldOfStudy = (field: string) => {
    setSelectedFieldsOfStudy(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    )
  }

  const toggleQuartile = (quartile: string) => {
    setSelectedQuartiles(prev =>
      prev.includes(quartile)
        ? prev.filter(q => q !== quartile)
        : [...prev, quartile]
    )
  }

  const togglePublicationType = (type: string) => {
    setSelectedPublicationTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  const handleSearch = async () => {
    // Validate input
    const validPhrases = phrases.filter(p => p.trim().length > 0)
    const hasPhrases = validPhrases.length >= 3 && validPhrases.length <= 10
    const hasQuery = query.trim().length >= 50 && query.trim().length <= 5000

    if (!hasPhrases && !hasQuery) {
      setError('Either provide 3-10 phrases OR a query (50-5000 characters)')
      return
    }

    if (hasPhrases && validPhrases.length < 3) {
      setError('At least 3 phrases are required for keyword search')
      return
    }

    if (hasQuery && query.trim().length < 50) {
      setError('Query must be at least 50 characters long')
      return
    }

    setLoading(true)
    setError(null)
    setResults([])

    try {
      const requestBody: any = {
        limit,
      }

      // Add phrases or query based on what's provided
      if (hasPhrases) {
        requestBody.phrases = validPhrases
      }
      if (hasQuery) {
        requestBody.query = query.trim()
      }

      // Add filters
      if (selectedFieldsOfStudy.length > 0) {
        requestBody.fieldsOfStudy = selectedFieldsOfStudy
      }
      if (minCitationCount !== undefined) {
        requestBody.minCitationCount = minCitationCount
      }
      if (openAccessPdf !== undefined) {
        requestBody.openAccessPdf = openAccessPdf
      }
      if (downloadable !== undefined) {
        requestBody.downloadable = downloadable
      }
      if (selectedQuartiles.length > 0) {
        requestBody.quartileRanking = selectedQuartiles
      }
      if (selectedPublicationTypes.length > 0) {
        requestBody.publicationTypes = selectedPublicationTypes
      }
      if (sort) {
        requestBody.sort = sort
      }
      if (year) {
        requestBody.year = year
      }
      if (chatId) {
        requestBody.chatId = chatId
      }
      if (useMock) {
        requestBody.isMocked = true
      }

      const response = await fetch('/api/v1/papers/search-papers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to search papers')
      }

      const data = await response.json()
      setResults(data.papers || [])
      onSearchResults(data.papers || [])
    } catch (err: any) {
      console.error('Search error:', err)
      setError(err.message || 'Failed to search papers')
    } finally {
      setLoading(false)
    }
  }

  const getJobType = (): string => {
    const validPhrases = phrases.filter(p => p.trim().length > 0)
    const hasPhrases = validPhrases.length >= 3 && validPhrases.length <= 10
    const hasQuery = query.trim().length >= 50 && query.trim().length <= 5000

    if (hasPhrases && hasQuery) return 'combinedSearch'
    if (hasPhrases) return 'keywordSearch'
    if (hasQuery) return 'querySearch'
    return 'none'
  }

  const jobType = getJobType()

  return (
    <Card className="bg-[#1f1f1f] border-[#2a2a2a]">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#FF6B35]" />
          Advanced Paper Search
        </CardTitle>
        <CardDescription className="text-gray-400">
          Search using keywords, queries, and advanced filters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phrases Input */}
        <div>
          <Label className="text-white mb-2 block">
            Keywords/Phrases {phrases.filter(p => p.trim()).length >= 3 && phrases.filter(p => p.trim()).length <= 10 && (
              <Badge variant="outline" className="ml-2 text-green-400 border-green-400">
                {phrases.filter(p => p.trim()).length} phrases
              </Badge>
            )}
          </Label>
          <div className="space-y-2">
            {phrases.map((phrase, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={phrase}
                  onChange={(e) => updatePhrase(index, e.target.value)}
                  placeholder={`Phrase ${index + 1} (3-10 phrases required for keyword search)`}
                  className="bg-[#171717] border-[#2a2a2a] text-white"
                />
                {phrases.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePhrase(index)}
                    className="text-gray-400 hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {phrases.length < 10 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPhrase}
                className="text-gray-400 border-[#2a2a2a] hover:border-[#FF6B35]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Phrase
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Provide 3-10 phrases for keyword search, or use query below
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2 my-4">
          <div className="flex-1 h-px bg-[#2a2a2a]"></div>
          <span className="text-xs text-gray-500">OR</span>
          <div className="flex-1 h-px bg-[#2a2a2a]"></div>
        </div>

        {/* Query Input */}
        <div>
          <Label className="text-white mb-2 block">
            Query String {query.trim().length >= 50 && query.trim().length <= 5000 && (
              <Badge variant="outline" className="ml-2 text-green-400 border-green-400">
                {query.trim().length} chars
              </Badge>
            )}
          </Label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter a detailed query (50-5000 characters) for query search"
            rows={4}
            className="w-full bg-[#171717] border border-[#2a2a2a] rounded-md px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FF6B35] resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            {query.trim().length}/5000 characters (minimum 50)
          </p>
        </div>

        {/* Job Type Indicator */}
        {jobType !== 'none' && (
          <div className="p-3 bg-[#171717] border border-[#2a2a2a] rounded-md">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#FF6B35] text-white">
                {jobType === 'combinedSearch' && 'Combined Search'}
                {jobType === 'keywordSearch' && 'Keyword Search'}
                {jobType === 'querySearch' && 'Query Search'}
              </Badge>
              <span className="text-sm text-gray-400">
                {jobType === 'combinedSearch' && 'Using both phrases and query'}
                {jobType === 'keywordSearch' && 'Using phrases only'}
                {jobType === 'querySearch' && 'Using query only'}
              </span>
            </div>
          </div>
        )}

        {/* Advanced Filters */}
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="w-full justify-between text-gray-400 border-[#2a2a2a] hover:border-[#FF6B35]"
          >
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Advanced Filters
            </span>
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          {showFilters && (
            <div className="space-y-4 mt-4">
            {/* Fields of Study */}
            <div>
              <Label className="text-white mb-2 block">Fields of Study</Label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-[#171717] border border-[#2a2a2a] rounded-md">
                {VALID_FIELDS_OF_STUDY.map(field => (
                  <Badge
                    key={field}
                    variant={selectedFieldsOfStudy.includes(field) ? 'default' : 'outline'}
                    className={`cursor-pointer ${
                      selectedFieldsOfStudy.includes(field)
                        ? 'bg-[#FF6B35] text-white'
                        : 'border-[#2a2a2a] text-gray-400 hover:border-[#FF6B35]'
                    }`}
                    onClick={() => toggleFieldOfStudy(field)}
                  >
                    {field}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Min Citation Count */}
            <div>
              <Label className="text-white mb-2 block">Minimum Citation Count</Label>
              <Input
                type="number"
                value={minCitationCount || ''}
                onChange={(e) => setMinCitationCount(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="e.g., 10"
                className="bg-[#171717] border-[#2a2a2a] text-white"
              />
            </div>

            {/* Boolean Filters */}
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="openAccess"
                  checked={openAccessPdf === true}
                  onChange={(e) => setOpenAccessPdf(e.target.checked ? true : undefined)}
                />
                <Label htmlFor="openAccess" className="text-gray-400 cursor-pointer">
                  Open Access PDF
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="downloadable"
                  checked={downloadable === true}
                  onChange={(e) => setDownloadable(e.target.checked ? true : undefined)}
                />
                <Label htmlFor="downloadable" className="text-gray-400 cursor-pointer">
                  Downloadable
                </Label>
              </div>
            </div>

            {/* Quartile Rankings */}
            <div>
              <Label className="text-white mb-2 block">Quartile Rankings</Label>
              <div className="flex gap-2">
                {VALID_QUARTILE_RANKINGS.map(quartile => (
                  <Badge
                    key={quartile}
                    variant={selectedQuartiles.includes(quartile) ? 'default' : 'outline'}
                    className={`cursor-pointer ${
                      selectedQuartiles.includes(quartile)
                        ? 'bg-[#FF6B35] text-white'
                        : 'border-[#2a2a2a] text-gray-400 hover:border-[#FF6B35]'
                    }`}
                    onClick={() => toggleQuartile(quartile)}
                  >
                    {quartile}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Publication Types */}
            <div>
              <Label className="text-white mb-2 block">Publication Types</Label>
              <div className="flex gap-2">
                {VALID_PUBLICATION_TYPES.map(type => (
                  <Badge
                    key={type}
                    variant={selectedPublicationTypes.includes(type) ? 'default' : 'outline'}
                    className={`cursor-pointer capitalize ${
                      selectedPublicationTypes.includes(type)
                        ? 'bg-[#FF6B35] text-white'
                        : 'border-[#2a2a2a] text-gray-400 hover:border-[#FF6B35]'
                    }`}
                    onClick={() => togglePublicationType(type)}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <Label className="text-white mb-2 block">Sort By</Label>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="bg-[#171717] border-[#2a2a2a] text-white">
                  <SelectValue placeholder="Select sort option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score:desc">Score (High to Low)</SelectItem>
                  <SelectItem value="score:asc">Score (Low to High)</SelectItem>
                  <SelectItem value="citationCount:desc">Citations (High to Low)</SelectItem>
                  <SelectItem value="citationCount:asc">Citations (Low to High)</SelectItem>
                  <SelectItem value="year:desc">Year (Newest)</SelectItem>
                  <SelectItem value="year:asc">Year (Oldest)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Year Filter */}
            <div>
              <Label className="text-white mb-2 block">Year Filter</Label>
              <Input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="YYYY or YYYY:YYYY (e.g., 2020 or 2020:2023)"
                className="bg-[#171717] border-[#2a2a2a] text-white"
              />
            </div>

            {/* Limit */}
            <div>
              <Label className="text-white mb-2 block">Result Limit</Label>
              <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v) as 100 | 200 | 300)}>
                <SelectTrigger className="bg-[#171717] border-[#2a2a2a] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="300">300</SelectItem>
                </SelectContent>
              </Select>
            </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-900/20 border border-red-800 rounded-md text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Search Button */}
        <Button
          onClick={handleSearch}
          disabled={loading || jobType === 'none'}
          className="w-full bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Search Papers
            </>
          )}
        </Button>

        {/* Results */}
        {results.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium">
                Results ({results.length})
              </h3>
              {onGenerateCitationNetwork && (
                <Button
                  onClick={() => onGenerateCitationNetwork(results)}
                  variant="outline"
                  className="border-[#FF6B35] text-[#FF6B35] hover:bg-[#FF6B35] hover:text-white"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Citation Network
                </Button>
              )}
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {results.map((paper, idx) => (
                <Card key={paper.id || idx} className="bg-[#171717] border-[#2a2a2a]">
                  <CardContent className="p-3">
                    <h4 className="text-white text-sm font-medium mb-1 line-clamp-2">
                      {paper.title}
                    </h4>
                    <p className="text-xs text-gray-400 mb-2">{paper.authors}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      {paper.year && <span>{paper.year}</span>}
                      {paper.impactFactor?.citationCount && (
                        <span>• {paper.impactFactor.citationCount} citations</span>
                      )}
                      {paper.score && <span>• Score: {paper.score.toFixed(2)}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

