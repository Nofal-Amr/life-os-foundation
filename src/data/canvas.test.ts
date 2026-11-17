import { describe, expect, it } from "vitest";

import {
  CANVAS_PREFIX,
  addCard,
  addChild,
  addSibling,
  canvasText,
  childrenOf,
  connect,
  dayCanvasOn,
  edgePoints,
  emptyCanvas,
  fitView,
  freeSpot,
  isCanvasNote,
  mindMapStart,
  parentOf,
  parseCanvas,
  removeCard,
  safeUrl,
  serializeCanvas,
  updateEdge,
  zoomAt,
} from "./canvas";

describe("canvas storage", () => {
  it("round-trips cards, lines and view", () => {
    let doc = addCard(emptyCanvas(), { id: "a", kind: "text", text: "Idea", x: 0, y: 0 }).doc;
    doc = addCard(doc, { id: "b", kind: "link", url: "https://example.com/", x: 300, y: 0 }).doc;
    doc = connect(doc, "a", "b", "leads to");
    doc.view = { x: 10, y: 20, zoom: 1.5 };
    const back = parseCanvas(serializeCanvas(doc));
    expect(back.cards).toHaveLength(2);
    expect(back.edges[0]).toMatchObject({ from: "a", to: "b", label: "leads to" });
    expect(back.view).toEqual({ x: 10, y: 20, zoom: 1.5 });
  });

  it("never crashes on a broken body", () => {
    expect(parseCanvas("hello")).toEqual(emptyCanvas());
    expect(parseCanvas(`${CANVAS_PREFIX}{oops`)).toEqual(emptyCanvas());
    expect(parseCanvas(null)).toEqual(emptyCanvas());
  });

  it("drops lines to missing cards and unsafe links", () => {
    const body =
      CANVAS_PREFIX +
      JSON.stringify({
        cards: [
          { id: "a", kind: "text", x: 0, y: 0, w: 200 },
          { id: "b", kind: "link", url: "javascript:alert(1)", x: 0, y: 0, w: 200 },
          { id: "c", kind: "weird", x: 0, y: 0 },
        ],
        edges: [
          { id: "e1", from: "a", to: "zzz" },
          { id: "e2", from: "a", to: "b" },
        ],
      });
    const doc = parseCanvas(body);
    expect(doc.cards.map((c) => c.id)).toEqual(["a", "b"]);
    expect(doc.cards[1]!.url).toBeUndefined();
    expect(doc.edges.map((e) => e.id)).toEqual(["e2"]);
  });

  it("knows a canvas note", () => {
    expect(isCanvasNote({ tags: ["canvas"], body: "" })).toBe(true);
    expect(isCanvasNote({ tags: [], body: `${CANVAS_PREFIX}{}` })).toBe(true);
    expect(isCanvasNote({ tags: ["Ideas"], body: "text" })).toBe(false);
  });

  it("finds the day's canvas", () => {
    const notes = [
      { tags: ["canvas", "canvas-day:2026-11-17"], updated_at: "1" },
      { tags: ["canvas-day:2026-11-17"], updated_at: "2" },
    ];
    expect(dayCanvasOn(notes, "2026-11-17")).toBe(notes[0]);
    expect(dayCanvasOn(notes, "2026-11-18")).toBeNull();
  });
});

describe("links", () => {
  it("accepts web links and adds https", () => {
    expect(safeUrl("example.com")).toBe("https://example.com/");
    expect(safeUrl("http://a.b/c")).toBe("http://a.b/c");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("not a link")).toBeNull();
  });
});

describe("mind map", () => {
  it("stacks children to the right of the parent", () => {
    const start = mindMapStart("Main");
    const root = start.cards[0]!;
    const one = addChild(start, root.id)!;
    const two = addChild(one.doc, root.id, { [one.card.id]: 50 })!;
    expect(one.card.x).toBeGreaterThan(root.x + root.w);
    expect(one.card.y).toBe(root.y);
    expect(two.card.y).toBeGreaterThan(one.card.y + 50);
    expect(childrenOf(two.doc, root.id)).toHaveLength(2);
    expect(parentOf(two.doc, two.card.id)).toBe(root.id);
  });

  it("adds a sibling under the same parent", () => {
    const start = mindMapStart("Main");
    const root = start.cards[0]!;
    const child = addChild(start, root.id)!;
    const sib = addSibling(child.doc, child.card.id)!;
    expect(parentOf(sib.doc, sib.card.id)).toBe(root.id);
    expect(sib.card.x).toBe(child.card.x);
  });

  it("removing a card removes its lines", () => {
    const start = mindMapStart("Main");
    const root = start.cards[0]!;
    const child = addChild(start, root.id)!;
    const doc = removeCard(child.doc, child.card.id);
    expect(doc.edges).toHaveLength(0);
  });

  it("won't join a card to itself or twice", () => {
    let doc = addCard(emptyCanvas(), { id: "a", kind: "text", x: 0, y: 0 }).doc;
    doc = addCard(doc, { id: "b", kind: "text", x: 0, y: 0 }).doc;
    doc = connect(doc, "a", "a");
    doc = connect(doc, "a", "b");
    doc = connect(doc, "b", "a");
    expect(doc.edges).toHaveLength(1);
    doc = updateEdge(doc, doc.edges[0]!.id, "  why  ");
    expect(doc.edges[0]!.label).toBe("why");
    expect(canvasText(doc)).toContain("why");
  });
});

describe("view", () => {
  it("zooms around a point", () => {
    const view = zoomAt({ x: 0, y: 0, zoom: 1 }, 2, 100, 100);
    expect(view).toEqual({ x: -100, y: -100, zoom: 2 });
    expect(zoomAt(view, 100, 0, 0).zoom).toBe(2.5);
  });

  it("fits every card on screen", () => {
    let doc = addCard(emptyCanvas(), { kind: "text", x: 0, y: 0 }).doc;
    doc = addCard(doc, { kind: "text", x: 800, y: 0 }).doc;
    const view = fitView(doc, 400, 600);
    expect(view.zoom).toBeLessThan(1);
    // The left card's left edge is on screen.
    expect(view.x).toBeGreaterThanOrEqual(0);
  });

  it("joins facing sides", () => {
    const p = edgePoints({ x: 0, y: 0, w: 100, h: 50 }, { x: 300, y: 0, w: 100, h: 50 });
    expect(p).toMatchObject({ x1: 100, y1: 25, x2: 300, y2: 25, horizontal: true });
    const q = edgePoints({ x: 0, y: 0, w: 100, h: 50 }, { x: 0, y: 300, w: 100, h: 50 });
    expect(q).toMatchObject({ x1: 50, y1: 50, x2: 50, y2: 300, horizontal: false });
  });
});

describe("placing new cards", () => {
  it("finds a spot that covers nothing", () => {
    const doc = addCard(emptyCanvas(), { kind: "text", x: 0, y: 0 }).doc;
    const spot = freeSpot(doc, 0, 0);
    const card = doc.cards[0]!;
    const overlaps =
      spot.x < card.x + card.w &&
      spot.x + card.w > card.x &&
      spot.y < card.y + 64 &&
      spot.y + 64 > card.y;
    expect(overlaps).toBe(false);
    expect(freeSpot(emptyCanvas(), 5, 7)).toEqual({ x: 5, y: 7 });
  });
});
