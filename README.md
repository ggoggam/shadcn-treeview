# TreeView for ShadCN

A generic, accessible TreeView component distributed as a [ShadCN registry](https://ui.shadcn.com/docs/registry) item. Built with React 19, TypeScript, and [@dnd-kit/react](https://dndkit.com/).

## Features

- **Recursive expand/collapse** with keyboard navigation (arrow keys, Home, End)
- **Drag-and-drop** reordering within a single tree
- **Cross-tree drag-and-drop** between multiple TreeView instances via `TreeViewDndContext`
- **Lazy loading** of child nodes with async `loadChildren` callback
- **Generic types** — bring your own node data shape with full type inference
- **Controlled & uncontrolled** — manage expanded/selected state yourself or let the component handle it
- **Accessible** — proper ARIA `tree`/`treeitem` roles, `aria-expanded`, `aria-selected`, keyboard support

## Installation

Add the component to your ShadCN project:

```bash
npx shadcn@latest add https://YOUR_REGISTRY_URL/r/tree-view.json
```

## Quick Start

```tsx
import { TreeView, type TreeNodeNested, type TreeNodeRenderProps } from "@/components/tree-view";

interface FileData {
  name: string;
}

const items: TreeNodeNested<FileData>[] = [
  {
    id: "1",
    data: { name: "Documents" },
    isGroup: true,
    children: [
      { id: "2", data: { name: "resume.pdf" } },
      { id: "3", data: { name: "cover-letter.docx" } },
    ],
  },
  { id: "4", data: { name: "photo.png" } },
];

function MyTree() {
  return (
    <TreeView<FileData>
      items={items}
      renderNode={({ node, isExpanded, depth, toggle, hasChildren }) => (
        <div style={{ paddingLeft: depth * 20 }} onClick={toggle}>
          {hasChildren ? (isExpanded ? "▼ " : "▶ ") : "  "}
          {node.data.name}
        </div>
      )}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `TreeNodeNested<T>[]` | — | Tree data in nested format |
| `onItemsChange` | `(items: TreeNodeNested<T>[]) => void` | — | Called when tree structure changes (reorder, DND) |
| `renderNode` | `(props: TreeNodeRenderProps<T>) => ReactNode` | — | Render function for each node |
| `renderDragOverlay` | `(props: TreeNodeRenderProps<T>) => ReactNode` | — | Render function for the drag overlay |
| `selectionMode` | `"none" \| "single" \| "multiple"` | `"single"` | Selection behavior |
| `selectedIds` / `onSelectedIdsChange` | `string[]` / `(ids: string[]) => void` | — | Controlled selection |
| `expandedIds` / `onExpandedIdsChange` | `string[]` / `(ids: string[]) => void` | — | Controlled expansion |
| `defaultExpandAll` | `boolean` | `false` | Expand all nodes initially |
| `defaultExpandedIds` | `string[]` | — | Specific nodes to expand initially |
| `draggable` | `boolean` | `false` | Enable drag |
| `droppable` | `boolean` | `false` | Enable drop |
| `canDrag` | `(node: FlatTreeNode<T>) => boolean` | — | Per-node drag guard |
| `canDrop` | `(event: TreeDragEvent<T>) => boolean` | — | Per-operation drop guard |
| `loadChildren` | `(node: FlatTreeNode<T>) => Promise<TreeNodeNested<T>[]>` | — | Async loader for lazy children |
| `indentationWidth` | `number` | `20` | Pixels per indent level |

## Cross-Tree Drag-and-Drop

Wrap multiple `TreeView` instances in `TreeViewDndContext` to enable dragging nodes between trees:

```tsx
import { TreeView, TreeViewDndContext } from "@/components/tree-view";

function TwoTrees() {
  return (
    <TreeViewDndContext onDragEnd={(event) => {
      if (event.crossTree) {
        // Handle cross-tree move
        const { sourceTreeId, targetTreeId, dropPosition, projectedParentId } = event.crossTree;
      }
    }}>
      <TreeView treeId="tree-a" items={itemsA} draggable droppable renderNode={...} />
      <TreeView treeId="tree-b" items={itemsB} draggable droppable renderNode={...} />
    </TreeViewDndContext>
  );
}
```

## Lazy Loading

Pass a `loadChildren` callback to load children on demand when a group node is expanded:

```tsx
<TreeView
  items={items}
  loadChildren={async (node) => {
    const children = await fetchChildren(node.id);
    return children; // TreeNodeNested<T>[]
  }}
  onLoadError={(nodeId, error) => console.error(`Failed to load ${nodeId}`, error)}
  renderNode={...}
/>
```

Nodes with `isGroup: true` and no `children` array will show an expand affordance and trigger `loadChildren` on first expand.

## Development

```bash
bun install
bun run dev          # Start dev server (Turbopack)
bun run build        # Production build
bun run lint         # ESLint
bun run registry:build  # Build registry JSON to public/r/
```

## License

MIT
