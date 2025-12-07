import { VeritusPaper } from './veritus'

export interface GraphNode {
  id: string
  label: string // Full text
  displayLabel: string // Truncated text for display
  paper?: VeritusPaper
  paperId?: string
  expandable?: boolean
  keywords?: string[]
  children?: GraphNode[]
  depth: number
  x?: number
  y?: number
  parentId?: string
  nodeType?: 'paper' | 'keyword' | 'tldr' | 'author'
}

export interface NodeTransferPayload {
  nodeId?: string
  paperId?: string
  /**
   * Selected fields displayed beside the node (max 4)
   */
  selectedFields?: Record<string, string>
  /**
   * Keywords currently attached to the node (max 4)
   */
  keywords?: string[]
  /**
   * Flattened table data/value map shown in the metadata table
   */
  tableData?: Record<string, string>
  /**
   * Full list of metadata fields shown in the API response table
   */
  metadataFields?: Array<{
    fieldName: string
    displayName: string
    value: any
    displayValue: string
  }>
  /**
   * API field selections / extracted values (alias for selectedFields)
   */
  apiFieldSelections?: Record<string, string>
  /**
   * Any other extracted values shown in the table
   */
  extractedValues?: Record<string, string>
}

