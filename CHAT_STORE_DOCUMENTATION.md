# Chat Store Documentation

## Overview
The chat store is a MongoDB document that stores all conversation data, paper search results, citation networks, and aggregated metadata for each chat session.

---

## Chat Document Structure

### Top-Level Chat Fields

```typescript
interface IChat {
  _id: mongoose.Types.ObjectId          // Unique chat ID
  projectId: mongoose.Types.ObjectId    // Reference to Project
  userId: mongoose.Types.ObjectId       // Reference to User
  title: string                         // Chat title
  messages: IMessage[]                  // Array of conversation messages
  depth?: number                        // Citation network depth (default: 100)
  isFavorite?: boolean                  // Favorite flag (default: false)
  chatMetadata?: ChatMetadata           // Aggregated paper metadata
  createdAt: Date                       // Creation timestamp
  updatedAt: Date                       // Last update timestamp (indexed)
}
```

---

## Messages Array

Each message in the `messages` array contains:

```typescript
interface IMessage {
  role: 'user' | 'assistant'            // Message sender
  content: string                        // Message text content
  timestamp: Date                       // When message was created
  papers?: VeritusPaper[]               // Optional: Papers associated with this message
  citationNetwork?: any                  // Optional: Citation network data
}
```

### Message Types

1. **User Messages**
   - `role: 'user'`
   - `content`: User's query/question
   - `papers`: Usually undefined
   - `citationNetwork`: Usually undefined

2. **Assistant Messages with Papers**
   - `role: 'assistant'`
   - `content`: Response text (e.g., "Found paper: ...")
   - `papers`: Array of `VeritusPaper` objects from search results
   - `citationNetwork`: Usually undefined

3. **Assistant Messages with Citation Network**
   - `role: 'assistant'`
   - `content`: Network generation status/description
   - `papers`: May contain papers from the network
   - `citationNetwork`: Full citation network response object

---

## VeritusPaper Structure

Papers stored in `message.papers` array:

```typescript
interface VeritusPaper {
  id: string                            // Corpus ID (e.g., "corpus:12345678")
  title: string                         // Paper title
  authors: string                       // Comma-separated author names
  abstract: string | null               // Paper abstract
  tldr: string | null                   // TLDR summary
  year: number | null                   // Publication year
  publishedAt: string | null            // Full publication date (ISO string)
  
  // Citation Information
  impactFactor: {
    citationCount: number               // Total citations
    influentialCitationCount: number    // Influential citations
    referenceCount: number              // References count
  }
  
  // Publication Details
  journalName: string | null            // Journal name
  publicationType: string | null        // e.g., "journal", "conference", "book series"
  v_quartile_ranking?: string | null   // Q1, Q2, Q3, Q4
  v_journal_name?: string | null       // Alternative journal name field
  v_publisher?: string | null          // Publisher name
  v_country?: string | null            // Publication country
  
  // Research Fields
  fieldsOfStudy: string[]               // Array of research fields
                                        // e.g., ["Computer Science", "Machine Learning"]
  
  // Access Information
  isOpenAccess?: boolean                // Open access flag
  isPrePrint?: boolean                  // Preprint flag
  downloadable: boolean                 // PDF downloadable
  
  // Links
  doi: string | null                    // DOI identifier
  link?: string                         // Paper URL
  pdfLink?: string | null               // Direct PDF link
  titleLink?: string                    // Title link
  semanticLink?: string                  // Semantic Scholar link
  
  // Search Metadata
  score?: number | null                 // Relevance score
  engine?: string                       // Search engine used
}
```

---

## ChatMetadata Structure

Aggregated metadata extracted from all papers in the chat:

```typescript
interface ChatMetadata {
  authors?: string[]                    // All unique authors from all papers
  keywords?: string[]                   // All unique keywords/fieldsOfStudy
  abstracts?: string[]                  // All abstracts (may have duplicates)
  tldrs?: string[]                     // All TLDR summaries
  publicationTypes?: string[]           // All unique publication types
  publishedDates?: (Date | null)[]      // All publication dates
  quartileRankings?: string[]           // All unique quartile rankings (Q1-Q4)
  journalNames?: string[]               // All unique journal names
  citationCounts?: number[]             // All citation counts
  [key: string]: any                    // Additional metadata fields
}
```

### How ChatMetadata is Populated

1. **Automatic Extraction**: When papers are retrieved via API calls:
   - `/api/v1/papers/search` - Extracts metadata from single paper
   - `/api/v1/papers/[corpusId]` - Extracts metadata from single paper
   - `/api/v1/papers/search-papers` - Extracts metadata from all papers in batch

2. **Metadata Merging**: New metadata is merged with existing metadata:
   - Arrays are combined (no duplicates for sets like authors, keywords)
   - New values are appended to arrays (abstracts, tldrs, dates)
   - Existing values are preserved

3. **Storage Location**: Stored in `chat.chatMetadata` field

---

## Citation Network Structure

When `message.citationNetwork` is present, it contains:

```typescript
{
  paper: VeritusPaper                    // Root paper
  similarPapers?: VeritusPaper[]         // Similar papers (simple mode)
  citationNetwork?: {
    nodes: Array<{
      id: string
      label: string
      citations: number
      isRoot: boolean
      data?: VeritusPaper
    }>
    edges: Array<{
      source: string
      target: string
      weight?: number
    }>
    stats?: {
      totalNodes: number
      totalEdges: number
    }
  }
  meta?: {
    mode: 'simple' | 'full'
    depth: number
    createdAt: Date
  }
  isMocked?: boolean
}
```

---

## Data Sources in Chat Store

### 1. From Message Papers (`message.papers`)
- Papers from search results (`/api/v1/papers/search`)
- Papers from corpus search (`/api/paper/corpus`)
- Papers from advanced search (`/api/v1/papers/search-papers`)
- Papers cached in chat (`/api/chats/[id]/paper-cache`)

### 2. From Citation Networks (`message.citationNetwork`)
- Root paper (`citationNetwork.paper`)
- Similar papers (`citationNetwork.similarPapers`)
- Network nodes (`citationNetwork.citationNetwork.nodes[].data`)

### 3. From Chat Metadata (`chat.chatMetadata`)
- Aggregated authors, keywords, abstracts, etc.
- Automatically updated when papers are added via API calls

---

## How KeywordSelectionPanel Uses Chat Store

The `KeywordSelectionPanel` extracts data from the chat store in the following order:

1. **Primary Source**: `useChatPaperStorage` hook
   - Extracts papers from `message.papers` arrays
   - Extracts papers from `message.citationNetwork` objects
   - Creates a deduplicated map of all papers by ID

2. **Fallback Source**: Direct message parsing
   - Iterates through all messages
   - Extracts papers from `message.papers`
   - Extracts papers from `message.citationNetwork.paper`
   - Extracts papers from `message.citationNetwork.similarPapers`
   - Extracts papers from `message.citationNetwork.citationNetwork.nodes`

3. **Extracted Data**:
   - **Keywords**: From `paper.fieldsOfStudy`, `paper.journalName`, `paper.publicationType`
   - **Authors**: From `paper.authors` (comma-separated string, split into array)
   - **References**: From `paper.title` (paper titles used as references)

---

## Example Chat Store Document

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "projectId": "507f191e810c19729de860ea",
  "userId": "507f191e810c19729de860eb",
  "title": "Deep Learning Research",
  "depth": 100,
  "isFavorite": false,
  "chatMetadata": {
    "authors": ["Sarah Chen", "John Doe", "Jane Smith"],
    "keywords": ["Computer Science", "Machine Learning", "Deep Learning"],
    "abstracts": ["Abstract 1...", "Abstract 2..."],
    "tldrs": ["TLDR 1...", "TLDR 2..."],
    "publicationTypes": ["journal", "conference"],
    "publishedDates": [new Date("2024-01-01"), new Date("2023-06-15")],
    "quartileRankings": ["Q1", "Q2"],
    "journalNames": ["Nature", "ICML"],
    "citationCounts": [320, 150]
  },
  "messages": [
    {
      "role": "user",
      "content": "Find papers on deep learning",
      "timestamp": "2024-01-15T10:00:00Z"
    },
    {
      "role": "assistant",
      "content": "Found paper: Deep Learning Architectures...",
      "timestamp": "2024-01-15T10:00:05Z",
      "papers": [
        {
          "id": "corpus:12345678",
          "title": "Deep Learning Architectures for NLP",
          "authors": "Sarah Chen, John Doe",
          "fieldsOfStudy": ["Computer Science", "Machine Learning"],
          "year": 2024,
          "impactFactor": {
            "citationCount": 320
          },
          // ... other VeritusPaper fields
        }
      ]
    },
    {
      "role": "assistant",
      "content": "Citation network generated...",
      "timestamp": "2024-01-15T10:05:00Z",
      "citationNetwork": {
        "paper": { /* VeritusPaper */ },
        "citationNetwork": {
          "nodes": [ /* ... */ ],
          "edges": [ /* ... */ ]
        }
      }
    }
  ],
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:05:00Z"
}
```

---

## Key Points

1. **Chat Isolation**: Each chat has its own isolated store of papers and metadata
2. **Automatic Metadata**: Metadata is automatically extracted and merged when papers are added
3. **Multiple Sources**: Papers can come from search results, citation networks, or cached data
4. **Deduplication**: The `useChatPaperStorage` hook ensures papers are deduplicated by ID
5. **Rich Data**: Each paper contains comprehensive metadata for filtering and searching
6. **Citation Networks**: Full network structures are stored in messages for visualization

---

## Usage in Components

- **KeywordSelectionPanel**: Extracts keywords, authors, and references from chat store
- **CitationNetworkSelector**: Uses chat store to suggest filters
- **ChatInterface**: Displays messages and their associated papers/networks
- **PaperSearchPage**: Can access chat store via messages prop

