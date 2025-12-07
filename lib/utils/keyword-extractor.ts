import { VeritusPaper } from '@/types/veritus'

/**
 * Extract keywords from paper TLDR and metadata
 * Returns an array of keywords for searching related papers
 */
export function extractKeywords(paper: VeritusPaper): string[] {
  const keywords: Set<string> = new Set()

  // Extract from TLDR
  if (paper.tldr) {
    const tldrKeywords = extractKeywordsFromText(paper.tldr)
    tldrKeywords.forEach((kw) => keywords.add(kw.toLowerCase()))
  }

  // Extract from title (n-grams)
  if (paper.title) {
    const titleKeywords = extractTitleNgrams(paper.title)
    titleKeywords.forEach((kw) => keywords.add(kw.toLowerCase()))
  }

  // Extract from authors (first and last names)
  if (paper.authors) {
    const authorKeywords = extractAuthorKeywords(paper.authors)
    authorKeywords.forEach((kw) => keywords.add(kw.toLowerCase()))
  }

  // Extract from fields of study
  if (paper.fieldsOfStudy && Array.isArray(paper.fieldsOfStudy)) {
    paper.fieldsOfStudy.forEach((field) => {
      const fieldKeywords = extractKeywordsFromText(field)
      fieldKeywords.forEach((kw) => keywords.add(kw.toLowerCase()))
    })
  }

  // Extract from abstract (if available, use first few sentences)
  if (paper.abstract) {
    const abstractKeywords = extractKeywordsFromText(
      paper.abstract.substring(0, 500)
    )
    abstractKeywords.forEach((kw) => keywords.add(kw.toLowerCase()))
  }

  // Filter out common stop words and short keywords
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'as',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'should',
    'could',
    'may',
    'might',
    'must',
    'can',
    'this',
    'that',
    'these',
    'those',
    'it',
    'its',
    'they',
    'them',
    'their',
    'we',
    'our',
    'us',
    'i',
    'my',
    'me',
    'you',
    'your',
    'he',
    'she',
    'his',
    'her',
    'him',
  ])

  return Array.from(keywords).filter(
    (kw) => kw.length >= 3 && !stopWords.has(kw)
  )
}

/**
 * Extract keywords from text using simple word extraction
 */
function extractKeywordsFromText(text: string): string[] {
  if (!text) return []

  // Remove special characters and split into words
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3)

  // Extract meaningful phrases (2-3 word combinations)
  const phrases: string[] = []
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`
    if (bigram.length >= 6) {
      phrases.push(bigram)
    }
    if (i < words.length - 2) {
      const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`
      if (trigram.length >= 9) {
        phrases.push(trigram)
      }
    }
  }

  return [...words, ...phrases]
}

/**
 * Extract n-grams from title
 */
function extractTitleNgrams(title: string): string[] {
  if (!title) return []

  const words = title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 2)

  const ngrams: string[] = []

  // Add individual words
  ngrams.push(...words)

  // Add bigrams
  for (let i = 0; i < words.length - 1; i++) {
    ngrams.push(`${words[i]} ${words[i + 1]}`)
  }

  // Add trigrams
  for (let i = 0; i < words.length - 2; i++) {
    ngrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
  }

  return ngrams
}

/**
 * Extract keywords from author names
 */
function extractAuthorKeywords(authors: string): string[] {
  if (!authors) return []

  const keywords: string[] = []

  // Split by common delimiters
  const authorList = authors
    .split(/[,;|&]/)
    .map((author) => author.trim())
    .filter((author) => author.length > 0)

  authorList.forEach((author) => {
    const parts = author.split(/\s+/).filter((part) => part.length > 0)

    // Add full name
    if (parts.length > 0) {
      keywords.push(parts.join(' '))
    }

    // Add first name
    if (parts.length > 0) {
      keywords.push(parts[0])
    }

    // Add last name
    if (parts.length > 1) {
      keywords.push(parts[parts.length - 1])
    }
  })

  return keywords
}

