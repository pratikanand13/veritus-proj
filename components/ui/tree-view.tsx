"use client"

import * as React from "react"
import { ChevronRight, ChevronDown, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

export interface TreeDataItem {
  id: string
  name: string
  icon?: React.ComponentType<{ className?: string }>
  selectedIcon?: React.ComponentType<{ className?: string }>
  openIcon?: React.ComponentType<{ className?: string }>
  children?: TreeDataItem[]
  actions?: React.ReactNode
  onClick?: () => void
  draggable?: boolean
  droppable?: boolean
  disabled?: boolean
  className?: string
}

export interface TreeRenderItemParams {
  item: TreeDataItem
  depth: number
  isSelected: boolean
  isOpen: boolean
  onSelect: () => void
  onToggle: () => void
}

type TreeProps = React.HTMLAttributes<HTMLDivElement> & {
  data: TreeDataItem[] | TreeDataItem
  initialSelectedItemId?: string
  onSelectChange?: (item: TreeDataItem | undefined) => void
  renderItem?: (params: TreeRenderItemParams) => React.ReactNode
  expandAll?: boolean
  defaultNodeIcon?: React.ComponentType<{ className?: string }>
  defaultLeafIcon?: React.ComponentType<{ className?: string }>
}

const Tree = React.forwardRef<HTMLDivElement, TreeProps>(
  (
    {
      data,
      initialSelectedItemId,
      onSelectChange,
      renderItem,
      expandAll = false,
      defaultNodeIcon: DefaultNodeIcon,
      defaultLeafIcon: DefaultLeafIcon,
      className,
      ...props
    },
    ref
  ) => {
    const [selectedItemId, setSelectedItemId] = React.useState<string | undefined>(
      initialSelectedItemId
    )
    const [openItems, setOpenItems] = React.useState<Set<string>>(
      new Set(expandAll ? getAllItemIds(data) : [])
    )

    const handleSelect = React.useCallback(
      (item: TreeDataItem) => {
        setSelectedItemId(item.id)
        onSelectChange?.(item)
        item.onClick?.()
      },
      [onSelectChange]
    )

    const handleToggle = React.useCallback((itemId: string) => {
      setOpenItems((prev) => {
        const next = new Set(prev)
        if (next.has(itemId)) {
          next.delete(itemId)
        } else {
          next.add(itemId)
        }
        return next
      })
    }, [])

    const renderTreeItem = React.useCallback(
      (item: TreeDataItem, depth: number = 0): React.ReactNode => {
        const isSelected = selectedItemId === item.id
        const isOpen = openItems.has(item.id)
        const hasChildren = item.children && item.children.length > 0

        if (renderItem) {
          // When using custom renderItem, wrap it in Collapsible for proper structure
          return (
            <CollapsiblePrimitive.Root
              key={item.id}
              open={isOpen}
              onOpenChange={() => handleToggle(item.id)}
              disabled={item.disabled}
            >
              {renderItem({
                item,
                depth,
                isSelected,
                isOpen,
                onSelect: () => handleSelect(item),
                onToggle: () => handleToggle(item.id),
              })}
              {hasChildren && (
                <CollapsiblePrimitive.Content className="ml-4 mt-1">
                  {item.children?.map((child) => renderTreeItem(child, depth + 1))}
                </CollapsiblePrimitive.Content>
              )}
            </CollapsiblePrimitive.Root>
          )
        }

        const IconComponent =
          item.icon ||
          (hasChildren ? DefaultNodeIcon : DefaultLeafIcon) ||
          (hasChildren ? ChevronRight : FileText)

        const SelectedIconComponent = item.selectedIcon || IconComponent
        const OpenIconComponent = item.openIcon || IconComponent

        return (
          <CollapsiblePrimitive.Root
            key={item.id}
            open={isOpen}
            onOpenChange={() => handleToggle(item.id)}
            disabled={item.disabled}
          >
            <div
              className={cn(
                "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                isSelected && "bg-accent text-accent-foreground",
                item.disabled && "opacity-50 cursor-not-allowed",
                item.className
              )}
              onClick={() => !item.disabled && handleSelect(item)}
            >
              {hasChildren ? (
                <CollapsiblePrimitive.Trigger asChild>
                  <button
                    className="flex items-center justify-center w-4 h-4"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggle(item.id)
                    }}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                </CollapsiblePrimitive.Trigger>
              ) : (
                <div className="w-4 h-4" />
              )}

              {isSelected && SelectedIconComponent ? (
                <SelectedIconComponent className="h-4 w-4 shrink-0" />
              ) : isOpen && hasChildren && OpenIconComponent ? (
                <OpenIconComponent className="h-4 w-4 shrink-0" />
              ) : IconComponent ? (
                <IconComponent className="h-4 w-4 shrink-0" />
              ) : null}

              <span className="flex-1 truncate">{item.name}</span>

              {item.actions && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.actions}
                </div>
              )}
            </div>

            {hasChildren && (
              <CollapsiblePrimitive.Content className="ml-4 mt-1">
                {item.children?.map((child) => renderTreeItem(child, depth + 1))}
              </CollapsiblePrimitive.Content>
            )}
          </CollapsiblePrimitive.Root>
        )
      },
      [selectedItemId, openItems, handleSelect, handleToggle, renderItem, DefaultNodeIcon, DefaultLeafIcon]
    )

    const items = Array.isArray(data) ? data : [data]

    return (
      <div ref={ref} className={cn("space-y-1", className)} {...props}>
        {items.map((item) => renderTreeItem(item))}
      </div>
    )
  }
)

Tree.displayName = "Tree"

function getAllItemIds(data: TreeDataItem[] | TreeDataItem): string[] {
  const ids: string[] = []
  const items = Array.isArray(data) ? data : [data]

  const traverse = (item: TreeDataItem) => {
    ids.push(item.id)
    if (item.children) {
      item.children.forEach(traverse)
    }
  }

  items.forEach(traverse)
  return ids
}

// Re-export as TreeView for consistency with shadcn naming
export const TreeView = Tree
export type { TreeProps }

