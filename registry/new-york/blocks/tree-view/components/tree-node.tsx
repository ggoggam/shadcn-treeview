"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import { cn } from "@/lib/utils";
import { useTreeViewContext } from "../lib/tree-context";
import { TreeDropIndicator } from "./tree-drop-indicator";
import type { TreeNodeData, FlatTreeNode } from "../lib/tree-types";

interface TreeNodeRowProps<T extends TreeNodeData = TreeNodeData> {
  node: FlatTreeNode<T>;
  sortableIndex: number;
}

export function TreeNodeRow<T extends TreeNodeData = TreeNodeData>({
  node,
  sortableIndex,
}: TreeNodeRowProps<T>) {
  const ctx = useTreeViewContext<T>();
  const {
    treeId,
    dndGroup,
    flatNodes,
    expandedIds,
    selectedIds,
    focusedId,
    loadingIds,
    activeId,
    overId,
    dropPosition,
    projectedDepth,
    indentationWidth,
    draggable: isDraggableTree,
    canDrag,
    toggleExpand,
    select,
    renderNode,
  } = ctx;

  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedIds.has(node.id);
  const isFocused = focusedId === node.id;
  const isLoading = loadingIds.has(node.id);
  const isDragging = activeId === node.id;
  const isDropTargetNode = overId === node.id;
  const currentDropPosition = isDropTargetNode ? dropPosition : null;

  const hasChildren =
    node.isGroup &&
    (node.childrenLoaded
      ? flatNodes.some((n) => n.parentId === node.id)
      : true);

  const isDragDisabled =
    !isDraggableTree || (canDrag ? !canDrag(node) : false);

  // Count siblings for aria-setsize
  const siblingCount = flatNodes.filter(
    (n) => n.parentId === node.parentId
  ).length;

  const {
    ref,
    isDragSource,
  } = useSortable({
    id: node.id,
    index: sortableIndex,
    group: dndGroup,
    disabled: isDragDisabled,
    data: { node, treeId },
    // Disable the default OptimisticSortingPlugin — we handle reordering
    // manually in handleDragEnd via buildTree. The plugin would otherwise
    // reorder DOM elements and mutate sortable indices during the drag,
    // causing the target in onDragEnd to be stale/incorrect.
    plugins: [],
    transition: null,
  });

  const indicatorDepth = projectedDepth ?? node.depth;

  return (
    <div
      ref={ref}
      role="treeitem"
      id={`${treeId}-node-${node.id}`}
      aria-expanded={node.isGroup ? isExpanded : undefined}
      aria-selected={isSelected}
      aria-level={node.depth + 1}
      aria-setsize={siblingCount}
      aria-posinset={node.index + 1}
      data-slot="tree-node"
      data-node-id={node.id}
      data-depth={node.depth}
      data-dragging={isDragSource || undefined}
      data-drop-target={isDropTargetNode || undefined}
      data-drop-position={currentDropPosition}
      className={cn(
        "relative outline-none",
        isDragSource && "opacity-50",
        isDropTargetNode && currentDropPosition === "inside" && "bg-accent/50 rounded-md",
      )}
    >
      {renderNode({
        node,
        isExpanded,
        isSelected,
        isFocused,
        isLoading,
        isDragging: isDragSource,
        isDropTarget: isDropTargetNode,
        dropPosition: currentDropPosition,
        depth: node.depth,
        hasChildren,
        toggle: () => toggleExpand(node.id),
        select: () => select(node.id),
      })}
      {isDropTargetNode && currentDropPosition === "after" && (
        <TreeDropIndicator
          depth={indicatorDepth}
          indentationWidth={indentationWidth}
        />
      )}
    </div>
  );
}
