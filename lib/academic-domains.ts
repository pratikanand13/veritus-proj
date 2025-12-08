/**
 * Academic / research email classifier using keyword-based fuzzy matching.
 * No hard domain allowlist; any domain can be accepted if it matches keywords.
 */

export interface AcademicEmailClassification {
  isAcademic: boolean
  score: number
  matchedKeywords: string[]
}

const ACADEMIC_KEYWORDS = [
  'iit', 'iiit', 'iiitd', 'iitb', 'iitd', 'iitr', 'iitk', 'iitm',
  'nit', 'nits', 'nitr', 'nitw',
  'iiser', 'iiserm', 'iiserb', 'iiest',
  'nift',
  'mit', 'stanford', 'berkeley', 'harvard', 'oxford', 'cambridge',
  'edu', 'ac', 'ac.in', 'sch', 'uni', 'research', 'lab',
  'institute', 'academy',
  'cs', 'comp', 'engg', 'bio', 'physics',
]

const RESEARCH_COMPANY_TERMS = ['research', 'lab', 'ai', 'ml', 'bio', 'quantum', 'veritus']

const FREE_PROVIDERS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'proton.me',
  'protonmail.com',
  'icloud.com',
]

const containsKeyword = (text: string, keyword: string) =>
  text.toLowerCase().includes(keyword.toLowerCase())

/**
 * Classify an email as academic/research using keyword scoring.
 * - Score +1 for each keyword match (domain/subdomain or allowed local-part for free-mail).
 * - isAcademic when score >= 1.
 * - Never hard-block; caller can choose what to do with non-academic.
 */
export function classifyAcademicEmail(email: string): AcademicEmailClassification {
  const [localRaw, domainRaw] = email.toLowerCase().split('@')
  const local = localRaw || ''
  const domain = domainRaw || ''

  const matchedKeywords: string[] = []
  let score = 0

  const bumpIfMatch = (text: string, keyword: string) => {
    if (containsKeyword(text, keyword)) {
      score += 1
      matchedKeywords.push(keyword)
    }
  }

  // Domain + subdomain keyword scoring
  ACADEMIC_KEYWORDS.forEach((kw) => bumpIfMatch(domain, kw))

  // Company domains: allow if research-oriented terms appear in domain
  RESEARCH_COMPANY_TERMS.forEach((kw) => bumpIfMatch(domain, kw))

  // Free-mail providers: require keywords in local-part
  const isFreeProvider = FREE_PROVIDERS.some((provider) => domain === provider)
  if (isFreeProvider) {
    ACADEMIC_KEYWORDS.forEach((kw) => bumpIfMatch(local, kw))
    RESEARCH_COMPANY_TERMS.forEach((kw) => bumpIfMatch(local, kw))
  }

  return {
    isAcademic: score >= 1,
    score,
    matchedKeywords,
  }
}

/**
 * Legacy boolean helper for existing callers.
 */
export function isAcademicEmail(email: string): boolean {
  return classifyAcademicEmail(email).isAcademic
}

