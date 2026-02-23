import * as React from "react";
import {
  SimpleTreeDemo,
  SimpleTreeDemoWithMultiSelect,
  TreeViewDemo,
} from "./tree-view-demo";
// This page displays items from the custom registry.
// You are free to implement this with your own design as needed.

export default function Home() {
  return (
    <div className="max-w-3xl mx-auto flex flex-col min-h-svh px-4 py-8 gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">
          Treeview Component
        </h1>
        <p className="text-muted-foreground">
          A tree view component using shadcn.
        </p>
      </header>
      <main className="flex flex-col flex-1 gap-8">
        <div className="flex flex-col gap-4 border rounded-lg p-4 relative">
          <h2 className="text-sm text-muted-foreground sm:pl-3">
            Simple tree with lazy-loaded children (0–500ms random delay).
          </h2>
          <div className="relative p-4">
            <SimpleTreeDemo />
          </div>
        </div>
        <div className="flex flex-col gap-4 border rounded-lg p-4 relative">
          <h2 className="text-sm text-muted-foreground sm:pl-3">
            Simple tree with multiselect.
          </h2>
          <div className="relative p-4">
            <SimpleTreeDemoWithMultiSelect />
          </div>
        </div>
        <div className="flex flex-col gap-4 border rounded-lg p-4 min-h-[450px] relative">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-muted-foreground sm:pl-3">
              Cross-tree drag-and-drop between two tree instances.
            </h2>
          </div>
          <div className="min-h-[400px] relative p-4">
            <TreeViewDemo />
          </div>
        </div>
      </main>
    </div>
  );
}
