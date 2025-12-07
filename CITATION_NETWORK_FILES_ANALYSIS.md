# Citation Network Files Analysis

## 📊 Summary
This document categorizes all citation network related files as **RELEVANT** (actively used), **REDUNDANT** (duplicate/unused), or **LEGACY** (old code that should be removed).

---

## ✅ RELEVANT FILES (Keep These)

### Core Visualization Components
1. **`components/dashboard/CitationNetworkEnhanced.tsx`** ⭐ **PRIMARY**
   - **Status**: ✅ Actively used
   - **Usage**: Imported as `CitationNetwork` in `ChatInterface.tsx` (line 10)
   - **Purpose**: Main D3.js force-directed graph visualization with advanced features
   - **Features**: Filters, controls, multiple layouts, dynamic spacing (recently improved)
   - **Keep**: YES - This is the main visualization component

2. **`components/dashboard/CitationNetwork.tsx`**
   - **Status**: ✅ Used (but secondary)
   - **Usage**: Used in `ChatInterface.tsx` line 589 for simple paper visualization
   - **Purpose**: Simpler visualization component for basic paper networks
   - **Keep**: YES - Used for legacy/fallback scenarios

3. **`components/dashboard/CitationNetworkSelector.tsx`**
   - **Status**: ✅ Actively used
   - **Purpose**: Dialog component for configuring citation network generation
   - **Keep**: YES - Required for user interaction

4. **`components/dashboard/CitationNetworkFilters.tsx`**
   - **Status**: ✅ Actively used
   - **Usage**: Used by `CitationNetworkEnhanced.tsx`
   - **Purpose**: Filter UI for citation networks
   - **Keep**: YES - Required feature

5. **`components/dashboard/CitationNetworkControls.tsx`**
   - **Status**: ✅ Actively used
   - **Usage**: Used by `CitationNetworkEnhanced.tsx`
   - **Purpose**: Layout and display controls
   - **Keep**: YES - Required feature

### Core Graph Builder (Primary)
6. **`lib/utils/citation-graph-builder.ts`** ⭐ **PRIMARY**
   - **Status**: ✅ Actively used
   - **Usage**: 
     - `app/api/citation-network/route.ts` (line 203)
     - `app/api/paper/citation-network/route.ts` (line 133)
   - **Purpose**: Main graph builder that creates citation networks from papers
   - **Functions**: `buildCitationGraphFromPapers()`, `buildSimpleCitationGraph()`
   - **Keep**: YES - This is the primary graph builder

### API Routes
7. **`app/api/citation-network/route.ts`**
   - **Status**: ✅ Actively used
   - **Usage**: Called from `ChatInterface.tsx` (line 294)
   - **Purpose**: API endpoint for generating citation networks
   - **Keep**: YES - Required API endpoint

8. **`app/api/paper/citation-network/route.ts`**
   - **Status**: ✅ Actively used
   - **Usage**: Called from multiple components for paper-specific networks
   - **Purpose**: API endpoint for paper citation networks
   - **Keep**: YES - Required API endpoint

9. **`app/api/paper/citation-network/filter/route.ts`**
   - **Status**: ✅ Used
   - **Purpose**: Filter citation networks
   - **Keep**: YES - Required feature

### Utility Files
10. **`lib/utils/citation-tree-transform.ts`**
    - **Status**: ✅ Used
    - **Purpose**: Transforms citation networks to tree format
    - **Keep**: YES - Required for tree visualization

11. **`lib/utils/path-finding.ts`**
    - **Status**: ✅ Used
    - **Usage**: Used by `CitationNetworkEnhanced.tsx` for path highlighting
    - **Purpose**: Find shortest paths between nodes
    - **Keep**: YES - Required feature

12. **`lib/utils/clustering.ts`**
    - **Status**: ✅ Used
    - **Purpose**: Cluster nodes in citation networks
    - **Keep**: YES - May be used for advanced features

---

## ⚠️ REDUNDANT/UNUSED FILES (Consider Removing)

### Duplicate Graph Builder
1. **`lib/services/citation-network-builder.ts`** ❌ **REDUNDANT**
   - **Status**: ⚠️ NOT USED
   - **Problem**: Has `buildCitationNetwork()` function but it's NEVER called
   - **Actual Usage**: Only `sortPapers()` is imported in `app/api/paper/citation-network/filter/route.ts`
   - **Recommendation**: 
     - Extract `sortPapers()` to a utility file
     - **DELETE** this file - it's a duplicate of functionality in `citation-graph-builder.ts`
   - **Why Redundant**: 
     - Different interface (takes mainPaper, citingPapers, referencedPapers)
     - Not compatible with current API structure
     - Current system uses `buildCitationGraphFromPapers()` instead

### Legacy Graph Builder
2. **`lib/citation-network.ts`** ❌ **LEGACY**
   - **Status**: ⚠️ Used but LEGACY
   - **Usage**: Only used in `CitationNetwork.tsx` line 115 as fallback
   - **Problem**: Very basic implementation - just connects papers in sequence
   - **Code Quality**: Placeholder code with comment "This is a placeholder that can be enhanced"
   - **Recommendation**: 
     - **DELETE** or **REFACTOR** - Replace usage in `CitationNetwork.tsx` with `buildCitationGraphFromPapers()`
     - The function `calculateLayout()` is empty (just returns network)
   - **Why Legacy**: 
     - Doesn't use actual citation relationships
     - Creates fake edges (just connects papers sequentially)
     - Should use proper graph builder instead

---

## 📁 Type Definitions (All Relevant)

All type definition files are relevant:
- `types/paper-api.ts` - CitationNetwork, CitationNetworkNode, CitationNetworkEdge types
- `types/veritus.ts` - Legacy CitationNetwork types (may need consolidation)

---

## 🔄 Migration Recommendations

### High Priority
1. **Remove `lib/services/citation-network-builder.ts`**
   - Extract `sortPapers()` to `lib/utils/sorting.ts` or similar
   - Update import in `app/api/paper/citation-network/filter/route.ts`

2. **Refactor `lib/citation-network.ts`**
   - Replace `buildCitationNetwork()` usage in `CitationNetwork.tsx` with `buildCitationGraphFromPapers()`
   - Remove the legacy file or mark it as deprecated

### Medium Priority
3. **Consolidate Type Definitions**
   - Review if both `types/paper-api.ts` and `types/veritus.ts` CitationNetwork types are needed
   - Consider consolidating to avoid confusion

---

## 📈 File Usage Summary

| File | Status | Usage Count | Action |
|------|--------|-------------|--------|
| `CitationNetworkEnhanced.tsx` | ✅ Active | High | **KEEP** |
| `CitationNetwork.tsx` | ✅ Active | Medium | **KEEP** (but consider refactoring) |
| `citation-graph-builder.ts` | ✅ Active | High | **KEEP** |
| `citation-network-builder.ts` | ❌ Unused | 0 (except sortPapers) | **DELETE** |
| `citation-network.ts` | ⚠️ Legacy | 1 (fallback) | **REFACTOR/DELETE** |

---

## 🎯 Quick Action Items

1. ✅ **Keep**: All `CitationNetwork*.tsx` components (they're all used)
2. ✅ **Keep**: `lib/utils/citation-graph-builder.ts` (primary builder)
3. ❌ **Delete**: `lib/services/citation-network-builder.ts` (unused duplicate)
4. ⚠️ **Refactor**: `lib/citation-network.ts` (replace with proper builder)

---

## 📝 Notes

- The codebase has evolved to use `buildCitationGraphFromPapers()` as the primary graph builder
- Old builders (`citation-network.ts`, `citation-network-builder.ts`) are either unused or legacy
- `CitationNetworkEnhanced.tsx` is the main visualization (imported as `CitationNetwork` in ChatInterface)
- `CitationNetwork.tsx` is a simpler fallback component

