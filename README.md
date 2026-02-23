# TreeView for ShadCN

A generic, accessible TreeView component distributed as a [ShadCN registry](https://ui.shadcn.com/docs/registry) item. Built with React 19, TypeScript, and [@dnd-kit/react](https://dndkit.com/).

## Features

- **Recursive expand/collapse** with keyboard navigation (arrow keys, Home, End)
- **Single & multiple selection** — Ctrl/Cmd+Click to toggle, Shift+Click for range, Ctrl+A to select all
- **Drag-and-drop** reordering within a single tree (multi-select DND moves all selected nodes)
- **Cross-tree drag-and-drop** between multiple TreeView instances via `TreeViewDndContext`
- **Lazy loading** of child nodes with async `loadChildren` callback
- **Generic types** — bring your own node data shape with full type inference
- **Controlled & uncontrolled** — manage expanded/selected state yourself or let the component handle it
- **Accessible** — proper ARIA `tree`/`treeitem` roles, `aria-expanded`, `aria-selected`, `aria-multiselectable`, keyboard support

## Installation

Add the component to your ShadCN project:

```bash
npx shadcn@latest add https://ggoggam.github.com/shadcn-treeview/r/tree-view.json
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

## Selection

Set `selectionMode` to control selection behavior:

- `"none"` — no selection
- `"single"` (default) — click selects one node at a time
- `"multiple"` — full multiselect with modifier keys and keyboard support

### Multiple Selection

```tsx
<TreeView<FileData>
  items={items}
  selectionMode="multiple"
  renderNode={({ node, depth, toggle, select, hasChildren }) => (
    <div style={{ paddingLeft: depth * 20 }} onClick={(e) => {
      if (hasChildren) toggle();
      select(e); // forwards modifier keys for multi-select
    }}>
      {node.data.name}
    </div>
  )}
/>
```

Pass the mouse event to `select(e)` to enable modifier-key behavior. Without the event, `select()` always replaces the selection (single-select behavior).

**Mouse interactions (multiple mode):**

| Action | Behavior |
|--------|----------|
| Click | Select only this node |
| Ctrl/Cmd+Click | Toggle this node in/out of selection |
| Shift+Click | Select range from last selected to this node |

**Keyboard interactions (multiple mode):**

| Key | Behavior |
|-----|----------|
| Space | Toggle focused node in/out of selection |
| Enter | Select only the focused node |
| Shift+Arrow Up/Down | Extend selection range while moving focus |
| Shift+Home/End | Select range from anchor to first/last node |
| Ctrl/Cmd+A | Select all visible nodes |

### Multi-Select Drag-and-Drop

When `selectionMode="multiple"` and you drag a node that is part of the current selection, all selected nodes move together. Dragging an unselected node moves only that node.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `TreeNodeNested<T>[]` | — | Tree data in nested format |
| `onItemsChange` | `(items: TreeNodeNested<T>[]) => MaybePromise<void>` | — | Called when tree structure changes (reorder, DND). Supports async callbacks. |
| `renderNode` | `(props: TreeNodeRenderProps<T>) => ReactNode` | — | Render function for each node |
| `renderDragOverlay` | `(props: TreeNodeRenderProps<T>) => ReactNode` | — | Render function for the drag overlay |
| `selectionMode` | `"none" \| "single" \| "multiple"` | `"single"` | Selection behavior. Multiple enables Ctrl/Shift click, range select, and multi-node DND. |
| `selectedIds` / `onSelectedIdsChange` | `string[]` / `(ids: string[]) => MaybePromise<void>` | — | Controlled selection |
| `expandedIds` / `onExpandedIdsChange` | `string[]` / `(ids: string[]) => MaybePromise<void>` | — | Controlled expansion |
| `defaultExpandAll` | `boolean` | `false` | Expand all nodes initially |
| `defaultExpandedIds` | `string[]` | — | Specific nodes to expand initially |
| `draggable` | `boolean` | `false` | Enable drag |
| `droppable` | `boolean` | `false` | Enable drop |
| `canDrag` | `(node: FlatTreeNode<T>) => boolean` | — | Per-node drag guard |
| `canDrop` | `(event: TreeDragEvent<T>) => boolean` | — | Per-operation drop guard |
| `loadChildren` | `(node: FlatTreeNode<T>) => Promise<TreeNodeNested<T>[]>` | — | Async loader for lazy children |
| `onLoadError` | `(nodeId: string, error: Error) => MaybePromise<void>` | — | Error callback for lazy loading failures |
| `onDragStart` | `(event: TreeDragEvent<T>) => MaybePromise<void>` | — | Called when a drag operation starts |
| `onDragEnd` | `(event: TreeDragEvent<T>) => MaybePromise<void>` | — | Called when a drag operation ends |
| `indentationWidth` | `number` | `20` | Pixels per indent level |
| `guideLineOffset` | `number` | `16` | Horizontal offset (px) for guide lines. The guide line at depth `d` is placed at `d * indentationWidth + guideLineOffset`. Set this to match the center of your chevron element. |
| `showGuideLines` | `boolean` | `true` | Show vertical guide lines for nesting depth |

All event callbacks (`onItemsChange`, `onSelectedIdsChange`, `onExpandedIdsChange`, `onDragStart`, `onDragEnd`, `onLoadError`) accept both sync and async functions via the `MaybePromise<void>` return type. This lets you call APIs directly from callbacks without wrapper boilerplate:

```tsx
<TreeView
  items={items}
  onItemsChange={async (items) => {
    await fetch("/api/tree", { method: "PUT", body: JSON.stringify(items) });
  }}
  renderNode={...}
/>
```

> **Note:** `canDrag` and `canDrop` remain synchronous (`=> boolean`) since they are evaluated during drag operations where an async round-trip would break the interaction.

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
  onLoadError={async (nodeId, error) => {
    await reportError({ nodeId, message: error.message });
  }}
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
