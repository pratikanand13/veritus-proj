# Label Data Flow in CitationNetwork.tsx

## Overview
The paper title labels in `CitationNetwork.tsx` come from three possible data sources, depending on how the component is called.

---

## Data Sources

### 1. **Full Mode** - `citationNetworkResponse.citationNetwork.nodes[]`

**Source:** `CitationNetworkResponse` prop with `citationNetwork` property

**Location in Code:** Lines 34-70

```typescript
if (citationNetworkResponse.citationNetwork) {
  network = {
    nodes: citationNetworkResponse.citationNetwork.nodes.map(node => ({
      id: node.id,
      paper: (node.data as VeritusPaper) || {
        id: node.id,
        title: node.label,  // ← LABEL COMES FROM HERE
        // ... other fields
      }
    }))
  }
}
```

**Data Path:**
- `CitationNetworkResponse.citationNetwork.nodes[].label` 
- → Mapped to `network.nodes[].paper.title`
- → Used by `getNodeTitle()` → `truncateTitle()` → Displayed

**Fallback:** If `node.data` exists, it's used directly as `VeritusPaper` (which has `title` property)

---

### 2. **Simple Mode** - `citationNetworkResponse.graph.nodes[]`

**Source:** `CitationNetworkResponse` prop with `graph` property (but no `citationNetwork`)

**Location in Code:** Lines 71-108

```typescript
else if (citationNetworkResponse.graph) {
  network = {
    nodes: citationNetworkResponse.graph.nodes.map(node => ({
      id: node.id,
      paper: {
        id: node.id,
        title: node.label,  // ← LABEL COMES FROM HERE
        // ... other fields
      }
    }))
  }
}
```

**Data Path:**
- `CitationNetworkResponse.graph.nodes[].label`
- → Mapped to `network.nodes[].paper.title`
- → Used by `getNodeTitle()` → `truncateTitle()` → Displayed

---

### 3. **Legacy Mode** - `papers[]` array

**Source:** `papers` prop (array of `VeritusPaper`)

**Location in Code:** Lines 112-115

```typescript
else if (papers && papers.length > 0) {
  network = buildCitationNetwork(papers)
}
```

**Data Path:**
- `papers[].title` (from `VeritusPaper` objects)
- → Processed by `buildCitationNetwork()` from `lib/citation-network.ts`
- → Creates `network.nodes[].paper.title`
- → Used by `getNodeTitle()` → `truncateTitle()` → Displayed

---

## Label Extraction Function

**Location:** Lines 139-144

```typescript
const getNodeTitle = (node: CitationNetworkNode): string => {
  if (node.paper?.title) return node.paper.title        // Primary source
  if ((node as any).label) return (node as any).label   // Fallback 1
  if ((node as any).data?.title) return (node as any).data.title  // Fallback 2
  return 'Unknown'
}
```

**Priority Order:**
1. `node.paper.title` (most common - set during network creation)
2. `node.label` (direct fallback if paper.title is missing)
3. `node.data.title` (if data object has title)
4. `'Unknown'` (default)

---

## Label Display

**Location:** Lines 357-361

```typescript
.text((d) => {
  const title = getNodeTitle(d)      // Extract title from node
  return truncateTitle(title)        // Truncate to 30 chars + "..."
})
```

**Truncation Function:** Lines 146-152
- Truncates to 30 characters
- Adds "..." if longer
- Handles null/undefined values

---

## Data Structure Reference

### CitationNetworkNode (from API)
```typescript
interface CitationNetworkNode {
  id: string
  label: string              // ← Primary source for labels
  citations: number
  data?: Paper               // ← May contain full paper data with title
  // ... other fields
}
```

### VeritusPaper (internal structure)
```typescript
interface VeritusPaper {
  id: string
  title: string              // ← Used when paper object exists
  // ... other fields
}
```

---

## Summary

**Label Data Flow:**
```
API Response / Props
  ↓
citationNetworkResponse.citationNetwork.nodes[].label
  OR
citationNetworkResponse.graph.nodes[].label  
  OR
papers[].title
  ↓
Mapped to network.nodes[].paper.title
  ↓
getNodeTitle() extracts title
  ↓
truncateTitle() truncates to 30 chars
  ↓
Displayed in SVG <text> element
```

**Key Points:**
- Labels primarily come from `node.label` in API responses
- Labels are mapped to `paper.title` during network creation
- `getNodeTitle()` provides fallback logic if mapping fails
- All labels are truncated to 30 characters + "..." for display
