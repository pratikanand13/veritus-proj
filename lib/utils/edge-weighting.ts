import { Paper } from '@/types/paper-api'

export type WeightingMode = 'balanced' | 'citations' | 'recency' | 'keywords'

interface WeightContext {
  keywords?: string[]
  authors?: string[]
  references?: string[]
  weighting?: WeightingMode
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const jaccard = (a: string[] = [], b: string[] = []) => {
  const setA = new Set(a.map((s) => s.toLowerCase()))
  const setB = new Set(b.map((s) => s.toLowerCase()))
  const intersection = [...setA].filter((x) => setB.has(x))
  const union = new Set([...setA, ...setB])
  if (union.size === 0) return 0
  return intersection.length / union.size
}

export function calculateEdgeWeight(
  paper1: Paper,
  paper2: Paper,
  ctx: WeightContext = {}
): { weight: number; metadata: { sharedKeywords: string[]; sharedAuthors: string[]; similarityScore: number; chatHistoryBoost: number } } {
  const weighting = ctx.weighting || 'balanced'

  const citations1 = paper1.impactFactor?.citationCount || 0
  const citations2 = paper2.impactFactor?.citationCount || 0
  const score1 = paper1.score || 0
  const score2 = paper2.score || 0
  const year1 = paper1.year || 0
  const year2 = paper2.year || 0

  const fields1 = (paper1.fieldsOfStudy || []).map((f: string) => f.toLowerCase())
  const fields2 = (paper2.fieldsOfStudy || []).map((f: string) => f.toLowerCase())
  const sharedKeywords = [...new Set(fields1.filter((f) => fields2.includes(f)))]

  const authors1 = (paper1.authors || '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => a.toLowerCase())
  const authors2 = (paper2.authors || '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => a.toLowerCase())
  const sharedAuthors = [...new Set(authors1.filter((a) => authors2.includes(a)))]

  // Base components
  let weight = 1.0

  // Citations component
  const minCite = Math.min(citations1, citations2)
  const maxCite = Math.max(citations1, citations2, 1)
  const citationStrength = minCite / maxCite // 0..1

  // Relevance component
  const relevance = (score1 + score2) / 2 // 0..1 range expected

  // Recency component
  const yearDiff = Math.abs(year1 - year2)
  const recency = year1 && year2 ? clamp(1 - yearDiff / 15, 0, 1) : 0

  // Keyword similarity
  const keywordSim = jaccard(fields1, fields2)

  // Author overlap
  const authorSim = jaccard(authors1, authors2)

  // Chat history boost (keywords/authors/references overlap)
  let chatHistoryBoost = 0
  if (ctx.keywords && ctx.keywords.length > 0) {
    chatHistoryBoost += jaccard(ctx.keywords, fields1) * 0.5
    chatHistoryBoost += jaccard(ctx.keywords, fields2) * 0.5
  }
  if (ctx.authors && ctx.authors.length > 0) {
    chatHistoryBoost += jaccard(
      ctx.authors.map((a) => a.toLowerCase()),
      authors1
    ) * 0.5
    chatHistoryBoost += jaccard(
      ctx.authors.map((a) => a.toLowerCase()),
      authors2
    ) * 0.5
  }

  // Combine with weighting modes
  switch (weighting) {
    case 'citations':
      weight += citationStrength * 1.5 + relevance * 0.5 + keywordSim * 0.3
      break;
    case 'recency':
      weight += recency * 1.2 + relevance * 0.8 + citationStrength * 0.4
      break;
    case 'keywords':
      weight += keywordSim * 1.5 + authorSim * 0.8 + relevance * 0.5
      break;
    case 'balanced':
    default:
      weight +=
        citationStrength * 0.8 +
        relevance * 0.8 +
        recency * 0.6 +
        keywordSim * 0.6 +
        authorSim * 0.4
      break;
  }

  // Apply chat history boost
  weight += chatHistoryBoost

  // Normalize to reasonable range
  const normalized = clamp(weight, 0.1, 3.0)

  const similarityScore = clamp(
    (citationStrength + relevance + keywordSim + authorSim + recency) / 5,
    0,
    1
  )

  return {
    weight: normalized,
    metadata: {
      sharedKeywords,
      sharedAuthors,
      similarityScore,
      chatHistoryBoost,
    },
  }
}

