"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import {
  TreeView,
  TreeViewDndContext,
  type TreeNodeNested,
  type TreeNodeRenderProps,
  type FlatTreeNode,
  type CrossTreeDragInfo,
  type LoadChildrenFn,
} from "@/registry/new-york/blocks/tree-view/tree-view";
import {
  flattenTree,
  buildTree,
  getDescendantIds,
  removeNodes,
} from "@/registry/new-york/blocks/tree-view/lib/tree-utils";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronDown, Folder, File, Loader2 } from "lucide-react";

// Demo data type
interface DemoItem {
  label: string;
}

// Seeded PRNG (mulberry32) — deterministic random for demo data
function createRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng = createRng(0);

function randInt(min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

const SUFFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomSuffix(len: number = 4): string {
  let s = "";
  for (let i = 0; i < len; i++) s += SUFFIX_CHARS[Math.floor(rng() * SUFFIX_CHARS.length)];
  return s;
}

const FILE_NAMES = [
  "index", "main", "app", "config", "utils", "helpers", "types",
  "constants", "schema", "layout", "page", "routes", "middleware",
  "context", "store", "actions", "reducer", "hooks", "service", "api",
];

const FILE_EXTENSIONS = [".ts", ".tsx", ".js", ".css", ".json", ".md", ".yaml", ".env"];

const DIR_NAMES = [
  "components", "hooks", "lib", "utils", "styles", "assets", "pages",
  "api", "config", "models", "services", "types", "features", "modules",
  "layouts", "shared", "common", "store", "middleware", "plugins",
];

function randomFileName(): string {
  return pick(FILE_NAMES) + pick(FILE_EXTENSIONS);
}

function randomDirName(): string {
  return pick(DIR_NAMES);
}

function generateFileTree(
  depth: number,
  parentPath: string,
  maxDepth: number = 3,
): TreeNodeNested<DemoItem>[] {
  const dirCount =
    depth === 0 ? randInt(2, 3) : randInt(0, Math.max(0, 2 - depth));
  const fileCount = randInt(1, 3);

  const dirs: TreeNodeNested<DemoItem>[] = Array.from(
    { length: dirCount },
    () => {
      const name = randomDirName();
      const uniqueName = `${name}-${randomSuffix()}`;
      const path = parentPath ? `${parentPath}/${uniqueName}` : uniqueName;
      return {
        id: path,
        data: { label: name },
        isGroup: true,
        children:
          depth < maxDepth ? generateFileTree(depth + 1, path, maxDepth) : [],
      };
    },
  );

  const files: TreeNodeNested<DemoItem>[] = Array.from(
    { length: fileCount },
    () => {
      const name = randomFileName();
      const uniqueName = `${name}-${randomSuffix()}`;
      const path = parentPath ? `${parentPath}/${uniqueName}` : uniqueName;
      return {
        id: path,
        data: { label: name },
      };
    },
  );

  return [...dirs, ...files];
}

function createRandomFileTree(seed: number): TreeNodeNested<DemoItem>[] {
  rng = createRng(seed);
  return generateFileTree(0, "");
}

function collectGroupIds(
  nodes: TreeNodeNested<DemoItem>[],
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.isGroup) ids.push(node.id);
    if (node.children) ids.push(...collectGroupIds(node.children));
  }
  return ids;
}

// Render function for tree nodes
function renderTreeNode({
  node,
  isExpanded,
  isSelected,
  isFocused,
  isDragging,
  depth,
  hasChildren,
  toggle,
  select,
}: TreeNodeRenderProps<DemoItem>) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm cursor-pointer select-none",
        "hover:bg-accent/50",
        isSelected && "bg-accent text-accent-foreground",
        isFocused && !isSelected && "ring-1 ring-ring",
        isDragging && "opacity-50",
      )}
      style={{ paddingLeft: depth * 20 + 8 }}
      onClick={(e) => {
        e.stopPropagation();
        if (hasChildren) {
          toggle();
        }
        select();
      }}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )
        ) : null}
      </span>
      {node.isGroup ? (
        <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <File className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate">{node.data.label}</span>
    </div>
  );
}

// ---------- Simple Tree with Lazy Loading ----------

// Static initial data: groups have no children (undefined) so they trigger lazy loading
const SIMPLE_TREE_DATA: TreeNodeNested<DemoItem>[] = [
  {
    id: "src",
    data: { label: "src" },
    isGroup: true,
  },
  {
    id: "public",
    data: { label: "public" },
    isGroup: true,
  },
  {
    id: "readme",
    data: { label: "README.md" },
  },
  {
    id: "package-json",
    data: { label: "package.json" },
  },
];

// Simulated server responses keyed by parent node id
const LAZY_CHILDREN: Record<string, TreeNodeNested<DemoItem>[]> = {
  src: [
    {
      id: "src/components",
      data: { label: "components" },
      isGroup: true,
    },
    {
      id: "src/hooks",
      data: { label: "hooks" },
      isGroup: true,
    },
    { id: "src/app.tsx", data: { label: "app.tsx" } },
    { id: "src/index.ts", data: { label: "index.ts" } },
  ],
  public: [
    { id: "public/favicon.ico", data: { label: "favicon.ico" } },
    { id: "public/robots.txt", data: { label: "robots.txt" } },
  ],
  "src/components": [
    { id: "src/components/button.tsx", data: { label: "button.tsx" } },
    { id: "src/components/input.tsx", data: { label: "input.tsx" } },
    { id: "src/components/dialog.tsx", data: { label: "dialog.tsx" } },
  ],
  "src/hooks": [
    { id: "src/hooks/use-state.ts", data: { label: "use-state.ts" } },
    { id: "src/hooks/use-effect.ts", data: { label: "use-effect.ts" } },
  ],
};

const loadChildren: LoadChildrenFn<DemoItem> = async (node) => {
  // Random delay between 0-500ms
  const delay = Math.floor(Math.random() * 500);
  await new Promise((resolve) => setTimeout(resolve, delay));
  return LAZY_CHILDREN[node.id] ?? [];
};

// Render function that also shows a loading spinner
function renderSimpleTreeNode({
  node,
  isExpanded,
  isSelected,
  isFocused,
  isLoading,
  depth,
  hasChildren,
  toggle,
  select,
}: TreeNodeRenderProps<DemoItem>) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm cursor-pointer select-none",
        "hover:bg-accent/50",
        isSelected && "bg-accent text-accent-foreground",
        isFocused && !isSelected && "ring-1 ring-ring",
      )}
      style={{ paddingLeft: depth * 20 + 8 }}
      onClick={(e) => {
        e.stopPropagation();
        if (hasChildren) {
          toggle();
        }
        select();
      }}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : hasChildren ? (
          isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )
        ) : null}
      </span>
      {node.isGroup ? (
        <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <File className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate">{node.data.label}</span>
    </div>
  );
}

export function SimpleTreeDemo() {
  const [items, setItems] = useState(SIMPLE_TREE_DATA);

  return (
    <TreeView<DemoItem>
      items={items}
      onItemsChange={setItems}
      renderNode={renderSimpleTreeNode}
      loadChildren={loadChildren}
      selectionMode="single"
      aria-label="Simple tree with lazy loading"
    />
  );
}

// ---------- Cross-Tree DND Demo ----------

const SHARED_DND_GROUP = "cross-tree";
const INDENT_WIDTH = 20;

export function TreeViewDemo() {
  const initialA = useMemo(() => createRandomFileTree(42), []);
  const initialB = useMemo(() => createRandomFileTree(99), []);
  const defaultExpandedA = useMemo(() => collectGroupIds(initialA), [initialA]);
  const defaultExpandedB = useMemo(() => collectGroupIds(initialB), [initialB]);

  const [itemsA, setItemsA] = useState(initialA);
  const [itemsB, setItemsB] = useState(initialB);

  // Refs for accessing current items in the drag-end handler
  const itemsARef = useRef(itemsA);
  itemsARef.current = itemsA;
  const itemsBRef = useRef(itemsB);
  itemsBRef.current = itemsB;

  const handleCrossTreeDragEnd = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any) => {
      const crossTree = event.crossTree as CrossTreeDragInfo | undefined;
      // Only handle cross-tree moves (same-tree is handled internally)
      if (!crossTree) return;

      const source = event.operation?.source;
      const target = event.operation?.target;
      if (!source || !target) return;

      const sourceId = String(source.id);
      const targetId = String(target.id);

      // Determine which state arrays correspond to source/target
      const getTreeState = (treeId: string) => {
        if (treeId === "tree-a") return { items: itemsARef.current, setItems: setItemsA };
        if (treeId === "tree-b") return { items: itemsBRef.current, setItems: setItemsB };
        return null;
      };

      const sourceState = getTreeState(crossTree.sourceTreeId);
      const targetState = getTreeState(crossTree.targetTreeId);
      if (!sourceState || !targetState) return;

      const sourceFlatNodes = flattenTree<DemoItem>(sourceState.items);
      const targetFlatNodes = flattenTree<DemoItem>(targetState.items);

      const sourceNode = sourceFlatNodes.find((n) => n.id === sourceId);
      if (!sourceNode) return;

      // Use the projection already computed by the target tree during dragOver
      const { dropPosition, projectedDepth, projectedParentId } = crossTree;

      // Collect the dragged node and its descendants
      const descendantIds = getDescendantIds(sourceFlatNodes, sourceId);
      const draggedIds = new Set([sourceId, ...descendantIds]);
      const draggedNodes = sourceFlatNodes.filter((n) => draggedIds.has(n.id));

      // Update depth and parentId for all dragged nodes
      const depthDiff = (projectedDepth ?? 0) - sourceNode.depth;
      const updatedDragged: FlatTreeNode<DemoItem>[] = draggedNodes.map((n) => ({
        ...n,
        depth: n.depth + depthDiff,
        parentId:
          n.id === sourceId ? (projectedParentId ?? null) : n.parentId,
      }));

      // Find insertion point in target flat array
      const targetFlatIdx = targetFlatNodes.findIndex(
        (n) => n.id === targetId,
      );
      let insertAt = targetFlatNodes.length;
      if (targetFlatIdx >= 0) {
        if (dropPosition === "inside") {
          insertAt = targetFlatIdx + 1;
        } else {
          let i = targetFlatIdx + 1;
          while (
            i < targetFlatNodes.length &&
            targetFlatNodes[i].depth > targetFlatNodes[targetFlatIdx].depth
          ) {
            i++;
          }
          insertAt = i;
        }
      }

      const newTargetFlat = [
        ...targetFlatNodes.slice(0, insertAt),
        ...updatedDragged,
        ...targetFlatNodes.slice(insertAt),
      ];

      // Remove from source tree
      const newSourceFlat = removeNodes(sourceFlatNodes, [sourceId]);

      sourceState.setItems(buildTree<DemoItem>(newSourceFlat));
      targetState.setItems(buildTree<DemoItem>(newTargetFlat));
    },
    [],
  );

  return (
    <TreeViewDndContext onDragEnd={handleCrossTreeDragEnd}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="mb-2 text-sm font-medium">Tree A</h3>
          <div className="rounded-md border p-2">
            <TreeView<DemoItem>
              treeId="tree-a"
              items={itemsA}
              onItemsChange={setItemsA}
              renderNode={renderTreeNode}
              renderDragOverlay={renderTreeNode}
              defaultExpandedIds={defaultExpandedA}
              selectionMode="single"
              draggable
              droppable
              dndGroup={SHARED_DND_GROUP}
              indentationWidth={INDENT_WIDTH}
              aria-label="Tree A"
            />
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium">Tree B</h3>
          <div className="rounded-md border p-2">
            <TreeView<DemoItem>
              treeId="tree-b"
              items={itemsB}
              onItemsChange={setItemsB}
              renderNode={renderTreeNode}
              renderDragOverlay={renderTreeNode}
              defaultExpandedIds={defaultExpandedB}
              selectionMode="single"
              draggable
              droppable
              dndGroup={SHARED_DND_GROUP}
              indentationWidth={INDENT_WIDTH}
              aria-label="Tree B"
            />
          </div>
        </div>
      </div>
    </TreeViewDndContext>
  );
}
