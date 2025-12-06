# Frontend Integration Guide

Complete guide for integrating your frontend application with the Veritus Backend API.

## Table of Contents

- [Base URL](#base-url)
- [API Endpoints Overview](#api-endpoints-overview)
- [Authentication](#authentication)
- [Request/Response Format](#requestresponse-format)
- [Endpoint Details](#endpoint-details)
- [Error Handling](#error-handling)
- [Code Examples](#code-examples)
- [Integration Patterns](#integration-patterns)
- [Best Practices](#best-practices)
- [Common Use Cases](#common-use-cases)

---

## Base URL

```
Development: http://localhost:3001
Production: [Your production URL]
```

All endpoints are prefixed with `/api/paper/`

---

## API Endpoints Overview

| Endpoint | Method | Purpose | Mock Support |
|----------|--------|---------|--------------|
| `/api/paper/search` | POST | Search paper by title or corpusId | ✅ |
| `/api/paper/corpus` | POST | Get semantically similar papers | ✅ |
| `/api/paper/visualization` | POST | Get semantic similarity graph | ✅ |
| `/api/paper/citation-network` | POST | Get citation network visualization | ✅ |
| `/api/paper/context` | POST | Legacy step-based endpoint | ✅ |

---

## Authentication

Currently, the API does not require authentication for frontend requests. However, the backend uses `VERITUS_API_KEY` internally to communicate with Veritus API.

**Note:** For production, consider adding API key authentication or CORS restrictions.

---

## Request/Response Format

### Request Format
All endpoints accept `POST` requests with `Content-Type: application/json`

### Response Format
All successful responses return JSON with status `200 OK`

### Common Response Structure
```typescript
// Success Response
{
  paper?: Paper,
  similarPapers?: Paper[],
  citationNetwork?: CitationNetwork,
  graph?: Graph,
  meta?: Meta,
  message?: string
}

// Error Response
{
  error: string
}
```

---

## Endpoint Details

### 1. Search Paper

**Endpoint:** `POST /api/paper/search`

**Purpose:** Find a paper by title or corpusId

**Request Body:**
```typescript
{
  title?: string;        // Paper title (required if corpusId not provided)
  corpusId?: string;     // Corpus ID (required if title not provided)
  mock?: boolean;        // Set to true for mock data
}
```

**Response:**
```typescript
{
  paper: {
    id: string;
    title: string;
    abstract: string | null;
    authors: string;
    doi: string | null;
    year: number | null;
    fieldsOfStudy: string[];
    impactFactor: {
      citationCount: number;
      influentialCitationCount: number;
      referenceCount: number;
    };
    pdfLink: string | null;
    link: string | null;
    semanticLink: string | null;
    // ... more fields
  };
  message: string;
}
```

**Example Request:**
```javascript
const response = await fetch('http://localhost:3001/api/paper/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'Machine Learning in Healthcare',
    mock: true  // Use mock data for testing
  })
});

const data = await response.json();
console.log(data.paper);
```

---

### 2. Get Similar Papers (Corpus Search)

**Endpoint:** `POST /api/paper/corpus`

**Purpose:** Get semantically similar papers based on corpus search

**Request Body:**
```typescript
{
  corpusId: string;     // Required: Corpus ID of the paper
  depth?: number;        // Optional: Number of papers to return (default: 50)
  mock?: boolean;        // Set to true for mock data
}
```

**Response:**
```typescript
{
  paper: Paper;
  similarPapers: Paper[];
  meta: {
    phrases: string[];
    query: string;
    depth: number;
  };
}
```

**Example Request:**
```javascript
const response = await fetch('http://localhost:3001/api/paper/corpus', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    corpusId: 'corpus:12345678',
    depth: 50,
    mock: true
  })
});

const data = await response.json();
console.log(data.similarPapers); // Array of similar papers
```

---

### 3. Semantic Similarity Visualization

**Endpoint:** `POST /api/paper/visualization`

**Purpose:** Get semantic similarity graph for visualization

**Request Body:**
```typescript
{
  corpusId: string;     // Required: Corpus ID of the paper
  depth?: number;        // Optional: Number of papers (default: 50)
  mock?: boolean;        // Set to true for mock data
}
```

**Response:**
```typescript
{
  paper: Paper;
  similarPapers: Paper[];
  graph: {
    nodes: Array<{
      id: string;
      label: string;
      citations: number;
      isRoot?: boolean;
    }>;
    edges: Array<{
      source: string;
      target: string;
      weight: number;
    }>;
  };
  meta: {
    phrases: string[];
    query: string;
    depth: number;
  };
}
```

**Example Request:**
```javascript
const response = await fetch('http://localhost:3001/api/paper/visualization', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    corpusId: 'corpus:12345678',
    depth: 50,
    mock: true
  })
});

const data = await response.json();
// Use data.graph.nodes and data.graph.edges for visualization
```

---

### 4. Citation Network Visualization

**Endpoint:** `POST /api/paper/citation-network`

**Purpose:** Get citation network showing papers that cite and are cited by the main paper

**Request Body:**
```typescript
{
  corpusId: string;     // Required: Corpus ID of the paper
  depth?: number;        // Optional: Max papers to include (default: 50)
  mock?: boolean;        // Set to true for mock data
}
```

**Response:**
```typescript
{
  paper: Paper;
  citationNetwork: {
    nodes: Array<{
      id: string;
      label: string;
      citations: number;
      references: number;
      isRoot?: boolean;
      type: 'root' | 'citing' | 'referenced' | 'both';
      year: number | null;
      authors: string | null;
    }>;
    edges: Array<{
      source: string;
      target: string;
      type: 'cites' | 'references';
      weight: number;
    }>;
    stats: {
      totalNodes: number;
      totalEdges: number;
      citingCount: number;
      referencedCount: number;
    };
  };
  meta: {
    networkType: string;
    depth: number;
  };
}
```

**Example Request:**
```javascript
const response = await fetch('http://localhost:3001/api/paper/citation-network', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    corpusId: 'corpus:12345678',
    depth: 50,
    mock: true
  })
});

const data = await response.json();
// Use data.citationNetwork for network visualization
```

---

## Error Handling

### HTTP Status Codes

- `200 OK` - Success
- `400 Bad Request` - Invalid request parameters
- `404 Not Found` - Paper not found
- `500 Internal Server Error` - Server error

### Error Response Format

```typescript
{
  error: string;  // Error message
}
```

### Error Handling Example

```javascript
async function fetchPaper(corpusId) {
  try {
    const response = await fetch('http://localhost:3001/api/paper/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ corpusId, mock: true })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching paper:', error);
    // Handle error (show toast, update UI, etc.)
    throw error;
  }
}
```

---

## Code Examples

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

interface Paper {
  id: string;
  title: string;
  abstract: string | null;
  authors: string;
  year: number | null;
  impactFactor: {
    citationCount: number;
    influentialCitationCount: number;
    referenceCount: number;
  };
}

interface UsePaperSearchResult {
  paper: Paper | null;
  loading: boolean;
  error: string | null;
  searchPaper: (title?: string, corpusId?: string) => Promise<void>;
}

export function usePaperSearch(): UsePaperSearchResult {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchPaper = async (title?: string, corpusId?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/paper/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          corpusId,
          mock: process.env.NODE_ENV === 'development' // Use mock in dev
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }

      const data = await response.json();
      setPaper(data.paper);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setPaper(null);
    } finally {
      setLoading(false);
    }
  };

  return { paper, loading, error, searchPaper };
}

// Usage in component
function PaperSearchComponent() {
  const { paper, loading, error, searchPaper } = usePaperSearch();

  const handleSearch = () => {
    searchPaper('Machine Learning in Healthcare');
  };

  return (
    <div>
      <button onClick={handleSearch} disabled={loading}>
        {loading ? 'Searching...' : 'Search Paper'}
      </button>
      {error && <div className="error">{error}</div>}
      {paper && (
        <div>
          <h2>{paper.title}</h2>
          <p>{paper.authors}</p>
          <p>Citations: {paper.impactFactor.citationCount}</p>
        </div>
      )}
    </div>
  );
}
```

---

### React Component for Visualization

```typescript
import React, { useState, useEffect } from 'react';

interface VisualizationProps {
  corpusId: string;
  depth?: number;
}

export function SemanticVisualization({ corpusId, depth = 50 }: VisualizationProps) {
  const [graphData, setGraphData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVisualization() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('http://localhost:3001/api/paper/visualization', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            corpusId,
            depth,
            mock: true
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error);
        }

        const data = await response.json();
        setGraphData(data.graph);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load visualization');
      } finally {
        setLoading(false);
      }
    }

    if (corpusId) {
      fetchVisualization();
    }
  }, [corpusId, depth]);

  if (loading) return <div>Loading visualization...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!graphData) return null;

  // Render your graph visualization here
  // See UI_DISPLAY_GUIDE.md for visualization library examples
  return (
    <div>
      <h3>Semantic Similarity Graph</h3>
      <p>Nodes: {graphData.nodes.length}</p>
      <p>Edges: {graphData.edges.length}</p>
      {/* Add your graph visualization component */}
    </div>
  );
}
```

---

### TypeScript Type Definitions

Create a `types.ts` file:

```typescript
// types.ts

export interface Paper {
  id: string;
  title: string;
  abstract: string | null;
  authors: string;
  doi: string | null;
  year: number | null;
  fieldsOfStudy: string[];
  impactFactor: {
    citationCount: number;
    influentialCitationCount: number;
    referenceCount: number;
  };
  pdfLink: string | null;
  link: string | null;
  semanticLink: string | null;
  journalName: string | null;
  publicationType: string | null;
  publishedAt: string | null;
  score?: number;
  tldr?: string | null;
  downloadable?: boolean;
  isOpenAccess?: boolean;
  isPrePrint?: boolean;
  v_country?: string | null;
  v_journal_name?: string | null;
  v_publisher?: string | null;
  v_quartile_ranking?: string | null;
}

export interface GraphNode {
  id: string;
  label: string;
  citations: number;
  isRoot?: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface CitationNetworkNode extends GraphNode {
  references: number;
  type: 'root' | 'citing' | 'referenced' | 'both';
  year: number | null;
  authors: string | null;
}

export interface CitationNetworkEdge {
  source: string;
  target: string;
  type: 'cites' | 'references';
  weight: number;
}

export interface CitationNetwork {
  nodes: CitationNetworkNode[];
  edges: CitationNetworkEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    citingCount: number;
    referencedCount: number;
  };
}

export interface SearchResponse {
  paper: Paper;
  message?: string;
}

export interface CorpusResponse {
  paper: Paper;
  similarPapers: Paper[];
  meta: {
    phrases: string[];
    query: string;
    depth: number;
  };
}

export interface VisualizationResponse {
  paper: Paper;
  similarPapers: Paper[];
  graph: Graph;
  meta: {
    phrases: string[];
    query: string;
    depth: number;
  };
}

export interface CitationNetworkResponse {
  paper: Paper;
  citationNetwork: CitationNetwork;
  meta: {
    networkType: string;
    depth: number;
  };
}
```

---

## Integration Patterns

### 1. API Client Class

Create a centralized API client:

```typescript
// apiClient.ts

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async searchPaper(params: {
    title?: string;
    corpusId?: string;
    mock?: boolean;
  }): Promise<SearchResponse> {
    return this.request<SearchResponse>('/api/paper/search', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getCorpus(params: {
    corpusId: string;
    depth?: number;
    mock?: boolean;
  }): Promise<CorpusResponse> {
    return this.request<CorpusResponse>('/api/paper/corpus', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getVisualization(params: {
    corpusId: string;
    depth?: number;
    mock?: boolean;
  }): Promise<VisualizationResponse> {
    return this.request<VisualizationResponse>('/api/paper/visualization', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getCitationNetwork(params: {
    corpusId: string;
    depth?: number;
    mock?: boolean;
  }): Promise<CitationNetworkResponse> {
    return this.request<CitationNetworkResponse>('/api/paper/citation-network', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }
}

export const apiClient = new ApiClient();
```

**Usage:**
```typescript
import { apiClient } from './apiClient';

// Search paper
const result = await apiClient.searchPaper({
  title: 'Machine Learning',
  mock: true
});

// Get similar papers
const corpus = await apiClient.getCorpus({
  corpusId: 'corpus:12345678',
  depth: 50,
  mock: true
});
```

---

### 2. React Query Integration

Using React Query for caching and state management:

```typescript
// hooks/usePaperQueries.ts

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';

export function usePaperSearch(title?: string, corpusId?: string, enabled = true) {
  return useQuery({
    queryKey: ['paper', 'search', title, corpusId],
    queryFn: () => apiClient.searchPaper({
      title,
      corpusId,
      mock: process.env.NODE_ENV === 'development'
    }),
    enabled: enabled && (!!title || !!corpusId),
  });
}

export function useCorpusSearch(corpusId: string, depth = 50, enabled = true) {
  return useQuery({
    queryKey: ['paper', 'corpus', corpusId, depth],
    queryFn: () => apiClient.getCorpus({
      corpusId,
      depth,
      mock: process.env.NODE_ENV === 'development'
    }),
    enabled: enabled && !!corpusId,
  });
}

export function useVisualization(corpusId: string, depth = 50, enabled = true) {
  return useQuery({
    queryKey: ['paper', 'visualization', corpusId, depth],
    queryFn: () => apiClient.getVisualization({
      corpusId,
      depth,
      mock: process.env.NODE_ENV === 'development'
    }),
    enabled: enabled && !!corpusId,
  });
}

export function useCitationNetwork(corpusId: string, depth = 50, enabled = true) {
  return useQuery({
    queryKey: ['paper', 'citation-network', corpusId, depth],
    queryFn: () => apiClient.getCitationNetwork({
      corpusId,
      depth,
      mock: process.env.NODE_ENV === 'development'
    }),
    enabled: enabled && !!corpusId,
  });
}
```

**Usage:**
```typescript
function PaperDetails({ corpusId }: { corpusId: string }) {
  const { data: paper, isLoading } = usePaperSearch(undefined, corpusId);
  const { data: visualization } = useVisualization(corpusId);
  const { data: citationNetwork } = useCitationNetwork(corpusId);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>{paper?.paper.title}</h1>
      {/* Render visualizations */}
    </div>
  );
}
```

---

## Best Practices

### 1. Environment Configuration

```typescript
// config.ts

export const config = {
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:3001',
  useMockData: process.env.REACT_APP_USE_MOCK === 'true' || process.env.NODE_ENV === 'development',
  defaultDepth: 50,
};
```

### 2. Error Boundaries

```typescript
// ErrorBoundary.tsx

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div>
          <h2>Something went wrong.</h2>
          <details>
            {this.state.error && this.state.error.toString()}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 3. Loading States

```typescript
// components/LoadingSpinner.tsx

export function LoadingSpinner() {
  return (
    <div className="loading-spinner">
      <div className="spinner" />
      <p>Loading...</p>
    </div>
  );
}

// Usage
{loading && <LoadingSpinner />}
```

### 4. Debouncing Search

```typescript
import { useDebouncedCallback } from 'use-debounce';

function PaperSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedCallback(
    (value: string) => {
      // Perform search
    },
    500
  );

  return (
    <input
      value={searchTerm}
      onChange={(e) => {
        setSearchTerm(e.target.value);
        debouncedSearch(e.target.value);
      }}
    />
  );
}
```

---

## Common Use Cases

### Use Case 1: Search → View Paper → Get Similar Papers

```typescript
function PaperExplorer() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCorpusId, setSelectedCorpusId] = useState<string | null>(null);
  
  const { data: searchResult, isLoading: searching } = usePaperSearch(searchTerm);
  const { data: corpusData } = useCorpusSearch(selectedCorpusId || '', 50, !!selectedCorpusId);

  const handleSearch = () => {
    if (searchResult?.paper) {
      setSelectedCorpusId(searchResult.paper.id);
    }
  };

  return (
    <div>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search paper title..."
      />
      <button onClick={handleSearch} disabled={searching}>
        Search
      </button>

      {searchResult && (
        <PaperCard paper={searchResult.paper} />
      )}

      {corpusData && (
        <SimilarPapersList papers={corpusData.similarPapers} />
      )}
    </div>
  );
}
```

### Use Case 2: Paper Details with Visualizations

```typescript
function PaperDetailsPage({ corpusId }: { corpusId: string }) {
  const { data: paper } = usePaperSearch(undefined, corpusId);
  const { data: visualization } = useVisualization(corpusId);
  const { data: citationNetwork } = useCitationNetwork(corpusId);

  return (
    <div>
      {paper && (
        <>
          <PaperHeader paper={paper.paper} />
          <PaperMetadata paper={paper.paper} />
        </>
      )}

      <Tabs>
        <Tab label="Semantic Similarity">
          {visualization && (
            <GraphVisualization graph={visualization.graph} />
          )}
        </Tab>
        <Tab label="Citation Network">
          {citationNetwork && (
            <CitationNetworkVisualization 
              network={citationNetwork.citationNetwork} 
            />
          )}
        </Tab>
      </Tabs>
    </div>
  );
}
```

### Use Case 3: Progressive Loading

```typescript
function ProgressivePaperView({ corpusId }: { corpusId: string }) {
  // Step 1: Load paper details
  const { data: paperData } = usePaperSearch(undefined, corpusId);
  
  // Step 2: Load similar papers (only after paper is loaded)
  const { data: corpusData } = useCorpusSearch(
    corpusId, 
    50, 
    !!paperData
  );
  
  // Step 3: Load visualization (only after corpus is loaded)
  const { data: visualization } = useVisualization(
    corpusId, 
    50, 
    !!corpusData
  );

  return (
    <div>
      {paperData && <PaperCard paper={paperData.paper} />}
      {corpusData && <SimilarPapers papers={corpusData.similarPapers} />}
      {visualization && <GraphView graph={visualization.graph} />}
    </div>
  );
}
```

---

## Testing

### Mock Data Usage

Always use `mock: true` during development and testing:

```typescript
const useMockData = process.env.NODE_ENV === 'development' || 
                    process.env.REACT_APP_USE_MOCK === 'true';

// In your API calls
await apiClient.searchPaper({
  title: 'Test Paper',
  mock: useMockData
});
```

### Example Test

```typescript
// __tests__/apiClient.test.ts

import { apiClient } from '../apiClient';

describe('ApiClient', () => {
  it('should search for a paper', async () => {
    const result = await apiClient.searchPaper({
      title: 'Machine Learning',
      mock: true
    });

    expect(result.paper).toBeDefined();
    expect(result.paper.title).toBeTruthy();
  });

  it('should handle errors', async () => {
    await expect(
      apiClient.searchPaper({
        title: '',
        corpusId: '',
        mock: true
      })
    ).rejects.toThrow();
  });
});
```

---

## Troubleshooting

### CORS Issues

If you encounter CORS errors, ensure your backend has CORS enabled:

```javascript
// Backend (if needed)
const cors = require('cors');
app.use(cors());
```

### Network Errors

```typescript
try {
  const response = await fetch(url, options);
  // ...
} catch (error) {
  if (error instanceof TypeError) {
    // Network error (no internet, server down, etc.)
    console.error('Network error:', error.message);
  } else {
    // Other errors
    console.error('Error:', error);
  }
}
```

### Response Parsing

Always check response status before parsing:

```typescript
const response = await fetch(url, options);

if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`HTTP ${response.status}: ${errorText}`);
}

const data = await response.json();
```

---

## Quick Start Checklist

- [ ] Set up API base URL in environment variables
- [ ] Create API client class or use fetch directly
- [ ] Define TypeScript types for API responses
- [ ] Implement error handling
- [ ] Add loading states
- [ ] Integrate with your state management (Redux/Context/React Query)
- [ ] Test with mock data (`mock: true`)
- [ ] Implement visualization components (see `UI_DISPLAY_GUIDE.md`)
- [ ] Add error boundaries
- [ ] Handle edge cases (empty results, network errors)

---

## Additional Resources

- **UI Display Guide**: See `UI_DISPLAY_GUIDE.md` for visualization library examples
- **Testing Guide**: See `TESTING_GUIDE.md` for API testing instructions
- **Swagger Documentation**: Visit `http://localhost:3001/docs` for interactive API docs

---

## Support

For issues or questions:
- Check Swagger docs at `/docs` endpoint
- Review error messages in browser console
- Test endpoints directly in Swagger UI
- Verify backend server is running

---

**Happy Coding! 🚀**

