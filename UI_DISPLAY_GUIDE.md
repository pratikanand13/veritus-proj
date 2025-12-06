# Citation Network Visualization - UI Display Guide

This guide explains how to display citation network visualizations in your frontend application.

## API Endpoints Overview

### 1. **Semantic Similarity Visualization** (`/api/paper/visualization`)
- Shows papers semantically similar to the main paper
- Based on semantic search results
- **Use case**: Find related papers by topic/semantics

### 2. **Citation Network Visualization** (`/api/paper/citation-network`) ⭐ **NEW**
- Shows actual citation relationships
- Papers that **cite** the main paper (forward citations)
- Papers that the main paper **cites** (references/backward citations)
- **Use case**: Understand citation flow and academic influence

## Response Structure

### Citation Network Endpoint Response:
```json
{
  "paper": {
    "id": "corpus:12345678",
    "title": "Machine Learning Applications in Healthcare...",
    "impactFactor": {
      "citationCount": 245,
      "referenceCount": 67
    },
    ...
  },
  "citationNetwork": {
    "nodes": [
      {
        "id": "corpus:12345678",
        "label": "Main Paper Title",
        "citations": 245,
        "references": 67,
        "isRoot": true,
        "type": "root",
        "year": 2023,
        "authors": "Author1, Author2"
      },
      {
        "id": "corpus:23456789",
        "label": "Paper that cites main paper",
        "citations": 189,
        "type": "citing",
        "year": 2023
      },
      {
        "id": "corpus:11111111",
        "label": "Paper cited by main paper",
        "citations": 312,
        "type": "referenced",
        "year": 2020
      }
    ],
    "edges": [
      {
        "source": "corpus:23456789",
        "target": "corpus:12345678",
        "type": "cites",
        "weight": 1.0
      },
      {
        "source": "corpus:12345678",
        "target": "corpus:11111111",
        "type": "references",
        "weight": 1.0
      }
    ],
    "stats": {
      "totalNodes": 8,
      "totalEdges": 8,
      "citingCount": 3,
      "referencedCount": 4
    }
  }
}
```

## Recommended UI Libraries

### Option 1: **D3.js** (Most Flexible)
```bash
npm install d3
```

**Pros:**
- Highly customizable
- Industry standard
- Great for complex visualizations
- Force-directed layouts

**Cons:**
- Steeper learning curve
- More code required

**Example Implementation:**
```javascript
import * as d3 from 'd3';

function renderCitationNetwork(data) {
  const { nodes, edges } = data.citationNetwork;
  
  // Create force simulation
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(edges).id(d => d.id))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2));

  // Draw links
  const link = svg.append("g")
    .selectAll("line")
    .data(edges)
    .enter().append("line")
    .attr("stroke", d => d.type === "cites" ? "#ff6b6b" : "#4ecdc4")
    .attr("stroke-width", 2);

  // Draw nodes
  const node = svg.append("g")
    .selectAll("circle")
    .data(nodes)
    .enter().append("circle")
    .attr("r", d => d.isRoot ? 10 : 6)
    .attr("fill", d => {
      if (d.isRoot) return "#ffd93d";
      if (d.type === "citing") return "#ff6b6b";
      if (d.type === "referenced") return "#4ecdc4";
      return "#95a5a6";
    });

  // Add labels
  const label = svg.append("g")
    .selectAll("text")
    .data(nodes)
    .enter().append("text")
    .text(d => d.label)
    .attr("font-size", "10px");
}
```

### Option 2: **vis-network** (Easiest to Use)
```bash
npm install vis-network
```

**Pros:**
- Easy to implement
- Built-in interactions (zoom, pan, drag)
- Good performance
- Great documentation

**Cons:**
- Less customizable than D3
- Larger bundle size

**Example Implementation:**
```javascript
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';

function renderCitationNetwork(data) {
  const { nodes, edges } = data.citationNetwork;
  
  // Prepare data
  const nodesData = new DataSet(
    nodes.map(node => ({
      id: node.id,
      label: node.label.substring(0, 50) + '...',
      title: `${node.label}\nCitations: ${node.citations}\nYear: ${node.year}`,
      color: {
        background: node.isRoot ? '#ffd93d' : 
                   node.type === 'citing' ? '#ff6b6b' : 
                   node.type === 'referenced' ? '#4ecdc4' : '#95a5a6',
        border: '#2c3e50'
      },
      size: node.isRoot ? 25 : node.citations / 10,
      font: { size: 12 }
    }))
  );

  const edgesData = new DataSet(
    edges.map(edge => ({
      from: edge.source,
      to: edge.target,
      color: { color: edge.type === 'cites' ? '#ff6b6b' : '#4ecdc4' },
      arrows: { to: { enabled: true, scaleFactor: 1.2 } },
      width: 2
    }))
  );

  const data = { nodes: nodesData, edges: edgesData };
  
  const options = {
    nodes: {
      shape: 'dot',
      font: { size: 12 }
    },
    edges: {
      arrows: { to: true },
      smooth: { type: 'continuous' }
    },
    physics: {
      enabled: true,
      stabilization: { iterations: 200 }
    },
    interaction: {
      hover: true,
      tooltipDelay: 200,
      zoomView: true,
      dragView: true
    }
  };

  const container = document.getElementById('citation-network');
  const network = new Network(container, data, options);
  
  // Add click handler
  network.on("click", function (params) {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0];
      // Handle node click - maybe show paper details
      console.log('Clicked node:', nodeId);
    }
  });
}
```

### Option 3: **Cytoscape.js** (Good Balance)
```bash
npm install cytoscape
```

**Pros:**
- Good balance of features and ease
- Graph theory algorithms built-in
- Good for complex networks
- Active development

**Example Implementation:**
```javascript
import cytoscape from 'cytoscape';

function renderCitationNetwork(data) {
  const { nodes, edges } = data.citationNetwork;
  
  const elements = [
    ...nodes.map(node => ({
      data: {
        id: node.id,
        label: node.label,
        citations: node.citations,
        type: node.type,
        isRoot: node.isRoot
      }
    })),
    ...edges.map(edge => ({
      data: {
        source: edge.source,
        target: edge.target,
        type: edge.type
      }
    }))
  ];

  const cy = cytoscape({
    container: document.getElementById('citation-network'),
    elements: elements,
    style: [
      {
        selector: 'node[isRoot = true]',
        style: {
          'background-color': '#ffd93d',
          'width': 30,
          'height': 30,
          'label': 'data(label)'
        }
      },
      {
        selector: 'node[type = "citing"]',
        style: {
          'background-color': '#ff6b6b',
          'width': 20,
          'height': 20
        }
      },
      {
        selector: 'node[type = "referenced"]',
        style: {
          'background-color': '#4ecdc4',
          'width': 20,
          'height': 20
        }
      },
      {
        selector: 'edge[type = "cites"]',
        style: {
          'line-color': '#ff6b6b',
          'target-arrow-color': '#ff6b6b',
          'target-arrow-shape': 'triangle'
        }
      },
      {
        selector: 'edge[type = "references"]',
        style: {
          'line-color': '#4ecdc4',
          'target-arrow-color': '#4ecdc4',
          'target-arrow-shape': 'triangle'
        }
      }
    ],
    layout: {
      name: 'cose',
      idealEdgeLength: 100,
      nodeOverlap: 20,
      refresh: 20,
      fit: true,
      padding: 30
    }
  });
}
```

## Visual Design Recommendations

### Color Coding:
- **Root Paper (Main Paper)**: Yellow/Gold (`#ffd93d`)
- **Citing Papers** (papers that cite the main paper): Red (`#ff6b6b`)
- **Referenced Papers** (papers cited by main paper): Teal/Cyan (`#4ecdc4`)
- **Both** (papers that both cite and are cited): Purple (`#9b59b6`)

### Edge Types:
- **"cites" edges**: Red arrows pointing TO the main paper
- **"references" edges**: Teal arrows pointing FROM the main paper

### Node Sizing:
- Size nodes by citation count (more citations = larger node)
- Root paper should be visually distinct (larger, different color)

### Layout:
- Use force-directed layout for organic appearance
- Consider hierarchical layout for citation flow
- Allow user to switch between layouts

## React Component Example

```jsx
import React, { useEffect, useRef } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';

function CitationNetworkVisualization({ corpusId, depth = 50 }) {
  const networkRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    async function fetchCitationNetwork() {
      try {
        const response = await fetch('/api/paper/citation-network', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ corpusId, depth, mock: true })
        });
        
        const data = await response.json();
        renderNetwork(data.citationNetwork);
      } catch (error) {
        console.error('Error fetching citation network:', error);
      }
    }

    function renderNetwork(citationNetwork) {
      const { nodes, edges } = citationNetwork;
      
      const nodesData = new DataSet(
        nodes.map(node => ({
          id: node.id,
          label: node.label.substring(0, 40) + '...',
          title: `${node.label}\nCitations: ${node.citations}\nYear: ${node.year}`,
          color: {
            background: node.isRoot ? '#ffd93d' : 
                       node.type === 'citing' ? '#ff6b6b' : 
                       node.type === 'referenced' ? '#4ecdc4' : '#95a5a6'
          },
          size: node.isRoot ? 25 : Math.min(node.citations / 10, 20),
          font: { size: 12 }
        }))
      );

      const edgesData = new DataSet(
        edges.map(edge => ({
          from: edge.source,
          to: edge.target,
          color: { color: edge.type === 'cites' ? '#ff6b6b' : '#4ecdc4' },
          arrows: { to: { enabled: true } },
          width: 2
        }))
      );

      const data = { nodes: nodesData, edges: edgesData };
      
      const options = {
        nodes: { font: { size: 12 } },
        edges: { arrows: { to: true }, smooth: true },
        physics: { enabled: true },
        interaction: { hover: true, zoomView: true, dragView: true }
      };

      networkRef.current = new Network(containerRef.current, data, options);
      
      networkRef.current.on("click", (params) => {
        if (params.nodes.length > 0) {
          // Handle node click
          console.log('Clicked:', params.nodes[0]);
        }
      });
    }

    fetchCitationNetwork();
  }, [corpusId, depth]);

  return (
    <div>
      <div 
        ref={containerRef} 
        style={{ width: '100%', height: '600px', border: '1px solid #ccc' }} 
      />
    </div>
  );
}

export default CitationNetworkVisualization;
```

## Features to Implement

1. **Interactive Features:**
   - Click nodes to show paper details
   - Hover to show tooltip with paper info
   - Zoom and pan controls
   - Filter by node type (citing/referenced)
   - Search/filter nodes

2. **Visual Enhancements:**
   - Legend explaining colors
   - Statistics panel (total nodes, edges, etc.)
   - Timeline slider (filter by year)
   - Node size based on citation count
   - Edge thickness based on relationship strength

3. **Performance:**
   - Limit nodes for large networks (use depth parameter)
   - Lazy loading for additional papers
   - Virtual scrolling for node lists

## Testing with Mock Data

Use `mock: true` in your API calls during development:

```javascript
const response = await fetch('/api/paper/citation-network', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    corpusId: 'corpus:12345678',
    depth: 50,
    mock: true  // Use mock data
  })
});
```

## Next Steps

1. Choose a visualization library (recommend **vis-network** for quick start)
2. Implement basic network rendering
3. Add interactivity (click, hover)
4. Style according to design system
5. Add filtering and search features
6. Optimize for performance with large networks

