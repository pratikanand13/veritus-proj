# Backend API Documentation

## Overview
This document provides a comprehensive overview of all backend APIs in the application, organized by functional area.

---

## 📁 API Structure

```
app/api/
├── auth/                    # Authentication endpoints
├── chats/                   # Chat management endpoints
├── paper/                   # Paper search & citation network (legacy)
├── projects/                # Project management endpoints
├── v1/                      # Version 1 API endpoints (new structure)
└── veritus/                 # Veritus API integration endpoints
```

---

## 🔐 Authentication APIs (`/api/auth`)

### 1. **POST** `/api/auth/login`
- **Purpose**: User login
- **Auth**: None (public)
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Response**: JWT token in cookie + user object
- **Features**: 
  - Password validation
  - 7-day token expiration for academic users
  - HTTP-only cookie

### 2. **POST** `/api/auth/signup`
- **Purpose**: User registration
- **Auth**: None (public)
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe",
    "areaOfInterest": "Computer Science",
    "isAcademic": true
  }
  ```
- **Response**: Created user object

### 3. **POST** `/api/auth/logout`
- **Purpose**: User logout
- **Auth**: Required
- **Response**: Success message

### 4. **GET** `/api/auth/verify`
- **Purpose**: Verify JWT token
- **Auth**: Required (via cookie)
- **Response**: Current user object

---

## 💬 Chat Management APIs (`/api/chats`)

### 1. **GET** `/api/chats`
- **Purpose**: Get all chats for current user
- **Auth**: Required
- **Query Parameters**:
  - `projectId` (optional): Filter chats by project
- **Response**: Array of chat objects
- **Features**:
  - Sorted by `updatedAt` (newest first)
  - Includes `isFavorite` flag
  - Includes `chatMetadata` object

### 2. **POST** `/api/chats`
- **Purpose**: Create a new chat
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "title": "Chat Title",
    "projectId": "project_id_here",
    "messages": [],
    "depth": 100
  }
  ```
- **Response**: Created chat object
- **Features**:
  - Creates analytics directory
  - Initializes `chatMetadata` with empty arrays

### 3. **GET** `/api/chats/[id]`
- **Purpose**: Get a specific chat by ID
- **Auth**: Required
- **Response**: Chat object with populated project
- **Features**: Populates `projectId` field

### 4. **PUT** `/api/chats/[id]`
- **Purpose**: Update a chat
- **Auth**: Required
- **Request Body** (all optional):
  ```json
  {
    "title": "Updated Title",
    "messages": [...],
    "depth": 200,
    "isFavorite": true
  }
  ```
- **Response**: Updated chat object
- **Features**:
  - Updates analytics file
  - Validates depth (1-500)

### 5. **DELETE** `/api/chats/[id]`
- **Purpose**: Delete a chat
- **Auth**: Required
- **Response**: Success message

### 6. **POST** `/api/chats/[id]/paper-cache`
- **Purpose**: Cache paper details in chat messages
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "paperId": "corpus_id",
    "paper": { /* VeritusPaper object */ }
  }
  ```
- **Response**: Success boolean
- **Features**: 
  - Updates existing paper if found
  - Adds to most recent message with papers
  - Creates new cache message if needed

### 7. **GET** `/api/chats/[id]/paper-cache`
- **Purpose**: Get all cached papers from a chat
- **Auth**: Required
- **Response**: Object mapping paper IDs to paper objects

### 8. **POST** `/api/chats/[id]/citation-network`
- **Purpose**: Save citation network to chat
- **Auth**: Required
- **Request Body**:
  ```json
  :
  ```json
  {
    "networkId": "network_id",
    "citationNetwork": { /* CitationNetworkResponse */ }
  }
  ```
- **Response**: Success message
- **Features**: Saves citation network to file system

---

## 📄 Paper Search APIs - V1 (`/api/v1/papers`)

### 1. **GET** `/api/v1/papers/search`
- **Purpose**: Search papers by title
- **Auth**: Required
- **Query Parameters**:
  - `title` (required): Paper title to search
  - `chatId` (optional): Chat ID to store metadata
  - `mock` (optional): Use mock data (`true`/`false`)
- **Response**:
  ```json
  {
    "paper": { /* VeritusPaper */ },
    "message": "Paper found successfully",
    "isMocked": false
  }
  ```
- **Features**:
  - Calls Veritus API `searchPapers`
  - Stores metadata in chat if `chatId` provided
  - Returns first (most relevant) result

### 2. **GET** `/api/v1/papers/[corpusId]`
- **Purpose**: Get paper by corpus ID
- **Auth**: Required
- **Query Parameters**:
  - `chatId` (optional): Chat ID to store metadata
  - `mock` (optional): Use mock data
- **Response**: Paper object
- **Features**:
  - Calls Veritus API `getPaper`
  - Stores metadata in chat if `chatId` provided

### 3. **POST** `/api/v1/papers/search-papers`
- **Purpose**: Advanced paper search with filters (uses Veritus job system)
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "phrases": ["keyword1", "keyword2", "keyword3"],  // 3-10 phrases
    "query": "Natural language query (50-5000 chars)",  // Optional
    "fieldsOfStudy": ["Computer Science", "Medicine"],  // Optional array
    "minCitationCount": 10,  // Optional, positive integer
    "openAccessPdf": true,  // Optional boolean
    "downloadable": true,  // Optional boolean
    "quartileRanking": ["Q1", "Q2"],  // Optional array: Q1-Q4
    "publicationTypes": ["journal", "conference"],  // Optional array
    "sort": "score:desc",  // Optional: "field:direction"
    "year": "2020:2024",  // Optional: YYYY or YYYY:YYYY
    "limit": 100,  // Optional: 100, 200, or 300
    "chatId": "chat_id",  // Optional: Store metadata
    "enrich": true,  // Optional boolean
    "callbackUrl": "https://..."  // Optional HTTPS URL
  }
  ```
- **Response**:
  ```json
  {
    "papers": [ /* Array of VeritusPaper */ ],
    "total": 50,
    "isMocked": false
  }
  ```
- **Features**:
  - **Dynamic Job Type Selection**:
    - `combinedSearch`: If both `phrases` and `query` provided
    - `keywordSearch`: If only `phrases` provided (3-10 phrases)
    - `querySearch`: If only `query` provided (50-5000 chars)
  - Uses Veritus job system (`createJob` → `getJobStatus` polling)
  - Validates all filter parameters
  - Merges metadata from all papers into chat metadata
  - Supports mock mode

---

## 📚 Paper Search APIs - Legacy (`/api/paper`)

### 1. **POST** `/api/paper/corpus`
- **Purpose**: Get paper by corpus ID (legacy endpoint)
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "corpusId": "corpus_id"
  }
  ```
- **Response**: CorpusResponse object
- **Note**: Consider migrating to `/api/v1/papers/[corpusId]`

### 2. **POST** `/api/paper/citation-network`
- **Purpose**: Generate citation network for a paper
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "corpusId": "corpus_id",
    "depth": 2,
    "simple": false
  }
  ```
- **Response**: CitationNetworkResponse object
- **Features**:
  - Builds citation network graph
  - Supports tree structure
  - Stores paper search in chat
  - Supports mock mode

### 3. **POST** `/api/paper/citation-network/filter`
- **Purpose**: Filter citation network results
- **Auth**: Required
- **Request Body**: Filter parameters
- **Response**: Filtered citation network

### 4. **POST** `/api/paper/visualization`
- **Purpose**: Generate visualization data
- **Auth**: Required
- **Response**: Visualization data

---

## 📁 Project Management APIs (`/api/projects`)

### 1. **GET** `/api/projects`
- **Purpose**: Get all projects for current user
- **Auth**: Required
- **Response**: Array of project objects

### 2. **POST** `/api/projects`
- **Purpose**: Create a new project
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "name": "Project Name",
    "description": "Project Description"
  }
  ```
- **Response**: Created project object
- **Features**: Creates analytics directory

### 3. **GET** `/api/projects/[id]`
- **Purpose**: Get a specific project
- **Auth**: Required
- **Response**: Project object

### 4. **PUT** `/api/projects/[id]`
- **Purpose**: Update a project
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "name": "Updated Name",
    "description": "Updated Description"
  }
  ```
- **Response**: Updated project object

### 5. **DELETE** `/api/projects/[id]`
- **Purpose**: Delete a project
- **Auth**: Required
- **Response**: Success message

---

## 🔌 Veritus Integration APIs (`/api/veritus`)

### 1. **POST** `/api/veritus/job/create/[jobType]`
- **Purpose**: Create a Veritus job
- **Auth**: Required (via API key)
- **Job Types**: `keywordSearch`, `querySearch`, `combinedSearch`
- **Query Parameters**:
  - `limit`: 100, 200, or 300
  - `fieldsOfStudy`: Comma-separated list
  - `minCitationCount`: Integer
  - `openAccessPdf`: `true`/`false`
  - `downloadable`: `true`/`false`
  - `quartileRanking`: Comma-separated list
  - `publicationTypes`: Comma-separated list
  - `sort`: Sort string
  - `year`: Year string
- **Request Body**: Job-specific parameters
- **Response**: Job creation result

### 2. **GET** `/api/veritus/job/[jobId]`
- **Purpose**: Get job status
- **Auth**: Required (via API key)
- **Response**: Job status object
- **Features**: Polls Veritus API for job status

### 3. **GET** `/api/veritus/credits`
- **Purpose**: Get Veritus API credits balance
- **Auth**: Required (via API key)
- **Response**: Credits information

### 4. **GET** `/api/veritus/user/settings`
- **Purpose**: Get Veritus user settings
- **Auth**: Required (via API key)
- **Response**: User settings object

---

## 🗄️ Database Models

### Chat Model (`models/Chat.ts`)
- **Fields**:
  - `projectId`: ObjectId (ref: Project)
  - `userId`: ObjectId (ref: User)
  - `title`: String
  - `messages`: Array of Message objects
  - `depth`: Number (default: 100)
  - `isFavorite`: Boolean (default: false, indexed)
  - `chatMetadata`: Mixed (stores paper metadata)
    - `authors`: String[]
    - `keywords`: String[]
    - `abstracts`: String[]
    - `tldrs`: String[]
    - `publicationTypes`: String[]
    - `publishedDates`: Date[]
    - `quartileRankings`: String[]
    - `journalNames`: String[]
    - `citationCounts`: Number[]
  - `createdAt`: Date
  - `updatedAt`: Date (indexed)

### Project Model (`models/Project.ts`)
- **Fields**:
  - `userId`: ObjectId (ref: User)
  - `name`: String
  - `description`: String (optional)
  - `createdAt`: Date

### User Model (`models/User.ts`)
- **Fields**:
  - `email`: String (unique, indexed)
  - `password`: String (hashed)
  - `name`: String
  - `areaOfInterest`: String
  - `isAcademic`: Boolean
  - `createdAt`: Date

---

## 🔑 Authentication Flow

1. User signs up → Creates User document
2. User logs in → Generates JWT token → Sets HTTP-only cookie
3. Subsequent requests → Validates JWT from cookie → Extracts user info
4. Token expires after 7 days (for academic users)

---

## 📊 Chat Metadata System

The `chatMetadata` field in Chat documents stores aggregated paper metadata:

- **Extraction**: Automatically extracted from papers via API calls
- **Storage**: Merged into existing metadata (no duplicates)
- **Sources**:
  - `/api/v1/papers/search` - Single paper search
  - `/api/v1/papers/[corpusId]` - Single paper retrieval
  - `/api/v1/papers/search-papers` - Batch paper search
- **Usage**: Enables chat-specific filtering, recommendations, and analytics

---

## 🎯 Key Features

1. **Mock Mode**: All paper APIs support `mock=true` parameter for testing
2. **Chat Metadata**: Automatic extraction and storage of paper metadata
3. **Job System**: Advanced search uses Veritus async job system
4. **File System Integration**: Analytics data saved to file system
5. **Error Handling**: Comprehensive error handling with appropriate HTTP status codes
6. **Validation**: Input validation using Zod schemas
7. **Security**: JWT-based authentication with HTTP-only cookies

---

## 📝 Notes

- **V1 APIs** (`/api/v1/papers/*`) are the new, recommended endpoints
- **Legacy APIs** (`/api/paper/*`) are maintained for backward compatibility
- All paper search APIs support storing metadata in chat documents
- The Veritus job system is used for advanced searches with filters
- Mock mode is available for all paper-related endpoints for development/testing

