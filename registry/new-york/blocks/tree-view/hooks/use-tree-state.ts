"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import type { TreeNodeData, TreeNodeNested, FlatTreeNode, MaybePromise } from "../lib/tree-types";
import {
  flattenTree,
  buildTree,
  getVisibleNodes,
  getDescendantIds,
} from "../lib/tree-utils";

export interface UseTreeStateOptions<T extends TreeNodeData> {
  items: TreeNodeNested<T>[];
  onItemsChange?: (items: TreeNodeNested<T>[]) => MaybePromise<void>;
  selectionMode?: "none" | "single" | "multiple";
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => MaybePromise<void>;
  expandedIds?: string[];
  onExpandedIdsChange?: (ids: string[]) => MaybePromise<void>;
  defaultExpandAll?: boolean;
  defaultExpandedIds?: string[];
}

export interface UseTreeStateReturn<T extends TreeNodeData> {
  flatNodes: FlatTreeNode<T>[];
  visibleNodes: FlatTreeNode<T>[];
  expandedIds: Set<string>;
  selectedIds: Set<string>;
  focusedId: string | null;
  toggleExpand: (id: string) => void;
  expand: (id: string) => void;
  collapse: (id: string) => void;
  select: (id: string) => void;
  toggleSelect: (id: string) => void;
  setFocused: (id: string | null) => void;
  setFlatNodes: (nodes: FlatTreeNode<T>[]) => void;
  insertChildren: (parentId: string, children: TreeNodeNested<T>[]) => void;
}

function collectAllGroupIds<T extends TreeNodeData>(
  nodes: TreeNodeNested<T>[]
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.isGroup || (node.children && node.children.length > 0)) {
      ids.push(node.id);
    }
    if (node.children) {
      ids.push(...collectAllGroupIds(node.children));
    }
  }
  return ids;
}

export function useTreeState<T extends TreeNodeData>(
  options: UseTreeStateOptions<T>
): UseTreeStateReturn<T> {
  const {
    items,
    onItemsChange,
    selectionMode = "none",
    selectedIds: controlledSelectedIds,
    onSelectedIdsChange,
    expandedIds: controlledExpandedIds,
    onExpandedIdsChange,
    defaultExpandAll = false,
    defaultExpandedIds,
  } = options;

  // Flatten input items
  const flatNodes = useMemo(() => flattenTree(items), [items]);

  // Expanded state (controlled or uncontrolled)
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(
    () => {
      if (defaultExpandAll) {
        return new Set(collectAllGroupIds(items));
      }
      if (defaultExpandedIds) {
        return new Set(defaultExpandedIds);
      }
      return new Set<string>();
    }
  );

  const expandedIds = controlledExpandedIds
    ? new Set(controlledExpandedIds)
    : internalExpandedIds;

  const setExpandedIds = useCallback(
    (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      const next = typeof updater === "function" ? updater(expandedIds) : updater;
      if (onExpandedIdsChange) {
        onExpandedIdsChange(Array.from(next));
      }
      if (!controlledExpandedIds) {
        setInternalExpandedIds(next);
      }
    },
    [expandedIds, onExpandedIdsChange, controlledExpandedIds]
  );

  // Selected state (controlled or uncontrolled)
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(
    new Set()
  );

  const selectedIds = controlledSelectedIds
    ? new Set(controlledSelectedIds)
    : internalSelectedIds;

  const setSelectedIds = useCallback(
    (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      const next = typeof updater === "function" ? updater(selectedIds) : updater;
      if (onSelectedIdsChange) {
        onSelectedIdsChange(Array.from(next));
      }
      if (!controlledSelectedIds) {
        setInternalSelectedIds(next);
      }
    },
    [selectedIds, onSelectedIdsChange, controlledSelectedIds]
  );

  // Focused state
  const [focusedId, setFocused] = useState<string | null>(null);

  // Visible nodes (derived)
  const visibleNodes = useMemo(
    () => getVisibleNodes(flatNodes, expandedIds),
    [flatNodes, expandedIds]
  );

  // Actions
  const toggleExpand = useCallback(
    (id: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          // Also collapse descendants
          const descendants = getDescendantIds(flatNodes, id);
          for (const d of descendants) next.delete(d);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [flatNodes, setExpandedIds]
  );

  const expand = useCallback(
    (id: string) => {
      setExpandedIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    },
    [setExpandedIds]
  );

  const collapse = useCallback(
    (id: string) => {
      setExpandedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        const descendants = getDescendantIds(flatNodes, id);
        for (const d of descendants) next.delete(d);
        return next;
      });
    },
    [flatNodes, setExpandedIds]
  );

  const select = useCallback(
    (id: string) => {
      if (selectionMode === "none") return;
      if (selectionMode === "single") {
        setSelectedIds(new Set([id]));
      } else {
        setSelectedIds(new Set([id]));
      }
    },
    [selectionMode, setSelectedIds]
  );

  const toggleSelect = useCallback(
    (id: string) => {
      if (selectionMode === "none") return;
      if (selectionMode === "single") {
        setSelectedIds((prev) =>
          prev.has(id) ? new Set() : new Set([id])
        );
      } else {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return next;
        });
      }
    },
    [selectionMode, setSelectedIds]
  );

  // Mutation methods for DND and lazy loading
  const onItemsChangeRef = useRef(onItemsChange);
  onItemsChangeRef.current = onItemsChange;

  const setFlatNodes = useCallback(
    (nodes: FlatTreeNode<T>[]) => {
      if (onItemsChangeRef.current) {
        onItemsChangeRef.current(buildTree(nodes));
      }
    },
    []
  );

  const insertChildren = useCallback(
    (parentId: string, children: TreeNodeNested<T>[]) => {
      // Rebuild items with children inserted under the parent
      function insertInto(
        nodes: TreeNodeNested<T>[]
      ): TreeNodeNested<T>[] {
        return nodes.map((node) => {
          if (node.id === parentId) {
            return {
              ...node,
              children: [...(node.children ?? []), ...children],
            };
          }
          if (node.children) {
            return { ...node, children: insertInto(node.children) };
          }
          return node;
        });
      }

      if (onItemsChangeRef.current) {
        onItemsChangeRef.current(insertInto(items));
      }
    },
    [items]
  );

  return {
    flatNodes,
    visibleNodes,
    expandedIds,
    selectedIds,
    focusedId,
    toggleExpand,
    expand,
    collapse,
    select,
    toggleSelect,
    setFocused,
    setFlatNodes,
    insertChildren,
  };
}
