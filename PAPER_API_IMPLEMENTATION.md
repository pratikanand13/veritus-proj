# Paper API Implementation Summary

This document summarizes the paper search API integration that connects your Next.js app with the backend at `localhost:8000`.

## Created Files

### Type Definitions
- **`types/paper-api.ts`** - TypeScript types matching FRONTEND_INTEGRATION_GUIDE.md
  - Request/Response types for all endpoints
  - Graph, CitationNetwork types
  - Paper type (extends VeritusPaper)

### API Client
- **`lib/paper-api-client.ts`** - Client for calling localhost:8000 backend
  - Functions: `searchPaper()`, `getCorpus()`, `getVisualization()`, `getCitationNetwork()`
  - Configurable via `PAPER_API_BASE_URL` env variable (defaults to `http://localhost:8000`)

### Chat Integration
- **`lib/chat-paper-integration.ts`** - Utilities for storing paper searches in chats
  - `storePaperSearchInChat()` - Stores search results in chat messages
  - `getPaperSearchHistory()` - Retrieves paper search history from a chat

### Mock Data Files
- **`lib/mock-data/search-response.json`** - Mock response for paper search
- **`lib/mock-data/corpus-response.json`** - Mock response for corpus search
- **`lib/mock-data/visualization-response.json`** - Mock response for visualization
- **`lib/mock-data/citation-network-response.json`** - Mock response for citation network

### API Routes
All routes are under `/app/api/paper/`:

1. **`app/api/paper/search/route.ts`**
   - POST endpoint: `/api/paper/search`
   - Accepts: `{ title?: string, corpusId?: string, chatId?: string, mock?: boolean }`
   - Returns: `{ paper: Paper, message?: string }`

2. **`app/api/paper/corpus/route.ts`**
   - POST endpoint: `/api/paper/corpus`
   - Accepts: `{ corpusId: string, depth?: number, chatId?: string, mock?: boolean }`
   - Returns: `{ paper: Paper, similarPapers: Paper[], meta: {...} }`

3. **`app/api/paper/visualization/route.ts`**
   - POST endpoint: `/api/paper/visualization`
   - Accepts: `{ corpusId: string, depth?: number, chatId?: string, mock?: boolean }`
   - Returns: `{ paper: Paper, similarPapers: Paper[], graph: Graph, meta: {...} }`

4. **`app/api/paper/citation-network/route.ts`**
   - POST endpoint: `/api/paper/citation-network`
   - Accepts: `{ corpusId: string, depth?: number, chatId?: string, mock?: boolean }`
   - Returns: `{ paper: Paper, citationNetwork: CitationNetwork, meta: {...} }`

## Features

### Authentication
- All endpoints require user authentication via `getCurrentUser()`
- Returns 401 if user is not authenticated

### Mock Mode
- Set `mock: true` in request body to use mock data from JSON files
- Useful for UI development and testing without backend

### Chat Integration
- Optional `chatId` parameter in all requests
- If provided, search results are automatically stored in chat messages
- Results include papers array and citation network (if applicable)

### Error Handling
- Standardized error responses: `{ error: string }`
- Proper HTTP status codes (400, 401, 404, 500)
- Backend errors are caught and returned with appropriate messages

## Usage Examples

### Search Paper (Mock Mode)
```typescript
const response = await fetch('/api/paper/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Machine Learning in Healthcare',
    chatId: 'chat-id-here',
    mock: true
  })
})
const data = await response.json()
```

### Get Corpus (Real API)
```typescript
const response = await fetch('/api/paper/corpus', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    corpusId: 'corpus:12345678',
    depth: 50,
    chatId: 'chat-id-here',
    mock: false
  })
})
const data = await response.json()
```

## Environment Variables

Add to `.env.local`:
```env
PAPER_API_BASE_URL=http://localhost:8000
```

## Next Steps

1. **Test the endpoints** with mock data (`mock: true`)
2. **Verify backend connection** at `localhost:8000` is working
3. **Update UI components** to use these new endpoints
4. **Implement visualization** components using the graph/citation network data

## Notes

- Graph/visualization endpoints are implemented but legacy API integration is deferred
- All routes support both mock and real API modes
- Chat association is optional but recommended for tracking search history
- Mock data files can be customized to match your specific use cases

