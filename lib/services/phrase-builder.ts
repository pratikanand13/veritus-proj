interface Paper {
  title: string
  fieldsOfStudy?: string[]
  [key: string]: any
}

interface BuildPhrasesOptions {
  paper: Paper
  keywords?: string[]
  authors?: string[]
  references?: string[]
}

interface PhraseBuilderResult {
  phrases: string[]
  query: string
}

/**
 * Builds phrases and query from paper data
 * @param paper Paper object with title and fieldsOfStudy
 * @returns Object with phrases array and query string
 */
export function buildPhrases(paper: Paper): PhraseBuilderResult {
  const fields = paper.fieldsOfStudy || []

  const phrases = [paper.title, ...fields.slice(0, 3)].filter(Boolean)

  const query = `Research related to ${paper.title} in fields: ${fields.join(', ')}`

  return { phrases, query }
}

/**
 * Builds phrases and query from user inputs combined with paper data
 * Veritus requires 3-10 phrases and query of 50-5000 characters
 * @param options Configuration object with paper and user inputs
 * @returns Object with phrases array and query string
 */
export function buildPhrasesFromUserInput(
  options: BuildPhrasesOptions
): PhraseBuilderResult {
  const { paper, keywords = [], authors = [], references = [] } = options
  const fields = paper.fieldsOfStudy || []

  // Build phrases array: combine paper data with user inputs
  // Veritus requires 3-10 phrases
  const phrases = [
    paper.title,
    ...fields.slice(0, 2), // Take first 2 fields to leave room for user inputs
    ...keywords.slice(0, 3), // Max 3 keywords
    ...authors.slice(0, 2), // Max 2 authors
    ...references.slice(0, 2), // Max 2 references
  ]
    .filter(Boolean)
    .slice(0, 10) // Ensure max 10 phrases

  // Ensure minimum 3 phrases (Veritus requirement)
  if (phrases.length < 3) {
    // Fallback: use paper title and fields if user didn't provide enough
    phrases.push(...fields.slice(0, 3 - phrases.length))
  }

  // Build comprehensive query string
  // Veritus requires 50-5000 characters
  const queryParts: string[] = []

  queryParts.push(`Research related to ${paper.title}`)

  if (fields.length > 0) {
    queryParts.push(`in fields: ${fields.join(', ')}`)
  }

  if (keywords.length > 0) {
    queryParts.push(`focusing on keywords: ${keywords.join(', ')}`)
  }

  if (authors.length > 0) {
    queryParts.push(`by authors: ${authors.join(', ')}`)
  }

  if (references.length > 0) {
    queryParts.push(`related to references: ${references.join(', ')}`)
  }

  let query = queryParts.join('. ')

  // Ensure minimum 50 characters
  if (query.length < 50) {
    query += `. This research explores various aspects and applications in the field.`
  }

  // Ensure maximum 5000 characters
  if (query.length > 5000) {
    query = query.substring(0, 4997) + '...'
  }

  return { phrases, query }
}

