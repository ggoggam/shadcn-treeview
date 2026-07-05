import { describe, expect, test } from "bun:test";
import type { FlatTreeNode, TreeNodeNested } from "./tree-types";
import {
  flattenTree,
  buildTree,
  getVisibleNodes,
  getDescendantIds,
  getAncestorIds,
  getSiblingCount,
  getProjection,
  removeNodes,
  insertNodes,
} from "./tree-utils";

interface Data {
  label: string;
}

function n(
  id: string,
  children?: TreeNodeNested<Data>[],
  isGroup?: boolean,
): TreeNodeNested<Data> {
  return {
    id,
    data: { label: id },
    ...(isGroup !== undefined && { isGroup }),
    ...(children !== undefined && { children }),
  };
}

function flat(
  id: string,
  overrides: Partial<FlatTreeNode<Data>> = {},
): FlatTreeNode<Data> {
  return {
    id,
    data: { label: id },
    isGroup: false,
    childrenLoaded: false,
    parentId: null,
    depth: 0,
    index: 0,
    ...overrides,
  };
}

const ids = (nodes: { id: string }[]) => nodes.map((x) => x.id);

// Shared fixture:
// a (group)
//   a1
//   a2 (group)
//     a2x
// b
// c (loaded empty group)
// d (lazy group: isGroup, children undefined)
const ITEMS: TreeNodeNested<Data>[] = [
  n("a", [n("a1"), n("a2", [n("a2x")])]),
  n("b"),
  n("c", [], true),
  n("d", undefined, true),
];
const FLAT = flattenTree(ITEMS);
const ALL_EXPANDED = new Set(["a", "a2", "c", "d"]);

describe("flattenTree", () => {
  test("produces DFS order with correct depths", () => {
    expect(ids(FLAT)).toEqual(["a", "a1", "a2", "a2x", "b", "c", "d"]);
    expect(FLAT.map((x) => x.depth)).toEqual([0, 1, 1, 2, 0, 0, 0]);
  });

  test("assigns parentId and per-sibling index", () => {
    const byId = new Map(FLAT.map((x) => [x.id, x]));
    expect(byId.get("a1")!.parentId).toBe("a");
    expect(byId.get("a2x")!.parentId).toBe("a2");
    expect(byId.get("b")!.parentId).toBeNull();
    expect(FLAT.filter((x) => x.parentId === null).map((x) => x.index)).toEqual(
      [0, 1, 2, 3],
    );
    expect(byId.get("a2")!.index).toBe(1);
  });

  test("infers isGroup from non-empty children, honors explicit isGroup", () => {
    const byId = new Map(FLAT.map((x) => [x.id, x]));
    expect(byId.get("a")!.isGroup).toBe(true); // inferred
    expect(byId.get("b")!.isGroup).toBe(false);
    expect(byId.get("c")!.isGroup).toBe(true); // explicit, empty children
    expect(byId.get("d")!.isGroup).toBe(true); // explicit, unloaded
  });

  test("childrenLoaded reflects whether a children array was provided", () => {
    const byId = new Map(FLAT.map((x) => [x.id, x]));
    expect(byId.get("a")!.childrenLoaded).toBe(true);
    expect(byId.get("c")!.childrenLoaded).toBe(true); // [] counts as loaded
    expect(byId.get("d")!.childrenLoaded).toBe(false); // lazy
  });
});

describe("buildTree", () => {
  test("flatten -> build -> flatten is identity on the flat form", () => {
    expect(flattenTree(buildTree(FLAT))).toEqual(FLAT);
  });

  test("preserves loaded-empty vs unloaded groups", () => {
    const tree = buildTree(FLAT);
    const c = tree.find((x) => x.id === "c")!;
    const d = tree.find((x) => x.id === "d")!;
    expect(c.children).toEqual([]);
    expect(d.children).toBeUndefined();
  });

  // Regression: children attached to a childrenLoaded:false parent used to
  // vanish — the parent was emitted with children:undefined before its
  // children were processed, so the late-created array was unreachable.
  // This is exactly the "drop inside a lazy group" DnD path.
  test("keeps children attached to an unloaded (childrenLoaded:false) parent", () => {
    const input = [
      flat("g", { isGroup: true }),
      flat("x", { parentId: "g", depth: 1 }),
    ];
    const tree = buildTree(input);
    expect(ids(tree)).toEqual(["g"]);
    expect(ids(tree[0].children ?? [])).toEqual(["x"]);
  });

  test("drop-inside-lazy-group round trip does not lose the dropped node", () => {
    // Simulate use-tree-dnd's handleDragEnd: move "b" inside lazy group "d"
    const remaining = removeNodes(FLAT, ["b"]);
    const dIdx = remaining.findIndex((x) => x.id === "d");
    const moved = { ...FLAT.find((x) => x.id === "b")!, parentId: "d", depth: 1 };
    const result = [
      ...remaining.slice(0, dIdx + 1),
      moved,
      ...remaining.slice(dIdx + 1),
    ];
    const tree = buildTree(result);
    const d = tree.find((x) => x.id === "d")!;
    expect(ids(d.children ?? [])).toEqual(["b"]);
    // total node count preserved
    expect(flattenTree(tree)).toHaveLength(FLAT.length);
  });

  test("preserves child order among siblings", () => {
    const tree = buildTree(FLAT);
    const a = tree.find((x) => x.id === "a")!;
    expect(ids(a.children!)).toEqual(["a1", "a2"]);
  });
});

describe("getVisibleNodes", () => {
  test("everything visible when all groups expanded", () => {
    expect(ids(getVisibleNodes(FLAT, ALL_EXPANDED))).toEqual(ids(FLAT));
  });

  test("only roots visible when nothing expanded", () => {
    expect(ids(getVisibleNodes(FLAT, new Set()))).toEqual(["a", "b", "c", "d"]);
  });

  test("collapsed inner group hides its subtree only", () => {
    expect(ids(getVisibleNodes(FLAT, new Set(["a"])))).toEqual([
      "a",
      "a1",
      "a2",
      "b",
      "c",
      "d",
    ]);
  });

  test("descendants of a hidden group stay hidden even if it is expanded", () => {
    // a2 expanded but a collapsed -> a2x must not appear
    expect(ids(getVisibleNodes(FLAT, new Set(["a2"])))).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });
});

describe("getDescendantIds / getAncestorIds / getSiblingCount", () => {
  test("descendants of a subtree root", () => {
    expect(getDescendantIds(FLAT, "a")).toEqual(["a1", "a2", "a2x"]);
    expect(getDescendantIds(FLAT, "a2")).toEqual(["a2x"]);
    expect(getDescendantIds(FLAT, "b")).toEqual([]);
  });

  test("ancestors from immediate parent to root", () => {
    expect(getAncestorIds(FLAT, "a2x")).toEqual(["a2", "a"]);
    expect(getAncestorIds(FLAT, "b")).toEqual([]);
  });

  test("sibling counts", () => {
    expect(getSiblingCount(FLAT, null)).toBe(4);
    expect(getSiblingCount(FLAT, "a")).toBe(2);
    expect(getSiblingCount(FLAT, "b")).toBe(0);
  });
});

describe("getProjection", () => {
  const VISIBLE = getVisibleNodes(FLAT, ALL_EXPANDED);
  const W = 20;

  test("zero offset between siblings keeps the surrounding depth", () => {
    // drag b over a1: between a1 and a2 (both depth 1)
    expect(getProjection(FLAT, VISIBLE, "b", "a1", 0, W)).toEqual({
      depth: 1,
      parentId: "a",
    });
  });

  // The minDepth clamp (next visible node's depth) is what keeps the flat
  // DFS list contiguous and makes hovering an expanded group mean "inside".
  // Removing it lets a drop land somewhere other than where the indicator
  // showed. Pin it.
  test("minDepth clamp: hovering an expanded group with children projects inside it", () => {
    // over a2 (group, next visible is its child a2x at depth 2)
    expect(getProjection(FLAT, VISIBLE, "b", "a2", 0, W)).toEqual({
      depth: 2,
      parentId: "a2",
    });
  });

  test("maxDepth clamp: cannot nest under a leaf deeper than the leaf itself", () => {
    // huge rightward offset over leaf b -> clamped to b's depth (0)
    expect(getProjection(FLAT, VISIBLE, "a2x", "b", 200, W)).toEqual({
      depth: 0,
      parentId: null,
    });
  });

  test("maxDepth clamp: at most one level under a group target", () => {
    expect(getProjection(FLAT, VISIBLE, "b", "a", 200, W)).toEqual({
      depth: 1,
      parentId: "a",
    });
  });

  test("negative offset dedents toward the root", () => {
    // d is the last visible node; dragging a2x far left lands at root level
    expect(getProjection(FLAT, VISIBLE, "a2x", "d", -100, W)).toEqual({
      depth: 0,
      parentId: null,
    });
  });

  test("cross-tree drag (active not in this tree) bases depth on the over node", () => {
    expect(getProjection(FLAT, VISIBLE, "not-here", "a1", 0, W)).toEqual({
      depth: 1,
      parentId: "a",
    });
  });

  test("unknown over id falls back to root", () => {
    expect(getProjection(FLAT, VISIBLE, "b", "nope", 0, W)).toEqual({
      depth: 0,
      parentId: null,
    });
  });
});

describe("removeNodes", () => {
  test("removes a subtree and reindexes remaining siblings", () => {
    const result = removeNodes(FLAT, ["a2"]);
    expect(ids(result)).toEqual(["a", "a1", "b", "c", "d"]);
    // a1 is now a's only child
    expect(result.find((x) => x.id === "a1")!.index).toBe(0);
  });

  test("removing a root removes all descendants and reindexes roots", () => {
    const result = removeNodes(FLAT, ["a"]);
    expect(ids(result)).toEqual(["b", "c", "d"]);
    expect(result.map((x) => x.index)).toEqual([0, 1, 2]);
  });

  test("removing multiple roots at once", () => {
    const result = removeNodes(FLAT, ["a", "c"]);
    expect(ids(result)).toEqual(["b", "d"]);
  });
});

describe("insertNodes", () => {
  test("inserts before the sibling at targetIndex and reindexes", () => {
    const x = flat("x", { parentId: "a", depth: 1 });
    const result = insertNodes(FLAT, [x], "a", 1);
    expect(ids(result)).toEqual(["a", "a1", "x", "a2", "a2x", "b", "c", "d"]);
    expect(
      result.filter((node) => node.parentId === "a").map((node) => node.index),
    ).toEqual([0, 1, 2]);
  });

  test("appends at the end of the flat list when targetIndex exceeds siblings", () => {
    const x = flat("x");
    const result = insertNodes(FLAT, [x], null, 99);
    expect(ids(result)).toEqual(["a", "a1", "a2", "a2x", "b", "c", "d", "x"]);
  });
});
