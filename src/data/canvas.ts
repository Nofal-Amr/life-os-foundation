import type { Note } from "@/data/notes";
import { createNote, updateNote } from "@/data/notes";
import { dailyTitle, uuidV5 } from "@/data/dailyNotes";
import { currentUserId } from "@/lib/supabase-helpers";

/**
 * Canvas: a free space for thinking in boxes and lines (mind maps, flows).
 *
 * A canvas is an ordinary row in `notes`, tagged `canvas`, whose body holds the
 * cards and lines as JSON after a fixed prefix. So no table change is needed,
 * and a canvas syncs, works offline and is backed up like every other note.
 *
 * Cards are one of three kinds: plain text, a link to one of your notes (it
 * shows that note, it doesn't copy it), or a web link. Lines join two cards and
 * may carry a short label. A canvas made from a daily note is also tagged
 * `canvas-day:YYYY-MM-DD` and has a fixed id per user and day, like daily notes.
 */
export const CANVAS_TAG = "canvas";
export const CANVAS_DAY_PREFIX = "canvas-day:";
export const CANVAS_PREFIX = "lifeos-canvas:v1:";

export type CardKind = "text" | "note" | "link";

export type CanvasCard = {
  id: string;
  kind: CardKind;
  x: number;
  y: number;
  w: number;
  /** Text cards: what's written. Link cards: an optional caption. */
  text?: string;
  noteId?: string;
  url?: string;
};

export type CanvasEdge = { id: string; from: string; to: string; label?: string };

export type CanvasView = { x: number; y: number; zoom: number };

export type CanvasDoc = { cards: CanvasCard[]; edges: CanvasEdge[]; view?: CanvasView };

export const CARD_W = 200;
/** Height assumed for a card before it has been measured on screen. */
export const CARD_H = 64;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.5;

export const emptyCanvas = (): CanvasDoc => ({ cards: [], edges: [] });

export function newCanvasId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isCanvasNote(note: Pick<Note, "tags" | "body">): boolean {
  return note.tags.includes(CANVAS_TAG) || (note.body ?? "").startsWith(CANVAS_PREFIX);
}

/** The day a canvas was opened from, or null. */
export function canvasDayOf(note: Pick<Note, "tags">): string | null {
  const tag = note.tags.find((t) => t.startsWith(CANVAS_DAY_PREFIX));
  return tag ? tag.slice(CANVAS_DAY_PREFIX.length) : null;
}

const num = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const str = (value: unknown) => (typeof value === "string" ? value : undefined);

/** Reads a canvas body. Anything unreadable gives an empty canvas, never a crash. */
export function parseCanvas(body: string | null | undefined): CanvasDoc {
  const raw = body ?? "";
  if (!raw.startsWith(CANVAS_PREFIX)) return emptyCanvas();
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(CANVAS_PREFIX.length));
  } catch {
    return emptyCanvas();
  }
  if (!data || typeof data !== "object") return emptyCanvas();
  const obj = data as Record<string, unknown>;
  const cards: CanvasCard[] = [];
  for (const item of Array.isArray(obj["cards"]) ? obj["cards"] : []) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const id = str(c["id"]);
    const kind = c["kind"];
    if (!id || (kind !== "text" && kind !== "note" && kind !== "link")) continue;
    const card: CanvasCard = {
      id,
      kind,
      x: num(c["x"], 0),
      y: num(c["y"], 0),
      w: Math.max(120, Math.min(480, num(c["w"], CARD_W))),
    };
    const text = str(c["text"]);
    if (text !== undefined) card.text = text;
    const noteId = str(c["noteId"]);
    if (noteId) card.noteId = noteId;
    const url = str(c["url"]);
    if (url && safeUrl(url)) card.url = url;
    cards.push(card);
  }
  const ids = new Set(cards.map((c) => c.id));
  const edges: CanvasEdge[] = [];
  for (const item of Array.isArray(obj["edges"]) ? obj["edges"] : []) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const id = str(e["id"]);
    const from = str(e["from"]);
    const to = str(e["to"]);
    if (!id || !from || !to || from === to || !ids.has(from) || !ids.has(to)) continue;
    const edge: CanvasEdge = { id, from, to };
    const label = str(e["label"]);
    if (label) edge.label = label;
    edges.push(edge);
  }
  const doc: CanvasDoc = { cards, edges };
  const v = obj["view"];
  if (v && typeof v === "object") {
    const view = v as Record<string, unknown>;
    doc.view = {
      x: num(view["x"], 0),
      y: num(view["y"], 0),
      zoom: clampZoom(num(view["zoom"], 1)),
    };
  }
  return doc;
}

export function serializeCanvas(doc: CanvasDoc): string {
  return CANVAS_PREFIX + JSON.stringify(doc);
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Only http(s) links can be opened from a card. */
export function safeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** The words on a canvas, for search. */
export function canvasText(doc: CanvasDoc): string {
  return [
    ...doc.cards.map((c) => [c.text, c.url].filter(Boolean).join(" ")),
    ...doc.edges.map((e) => e.label ?? ""),
  ]
    .filter((s) => s.trim())
    .join("\n");
}

/* ------------------------------------------------------------ Editing */

export function addCard(
  doc: CanvasDoc,
  card: Omit<CanvasCard, "id" | "w"> & { id?: string; w?: number },
): { doc: CanvasDoc; card: CanvasCard } {
  const full: CanvasCard = { w: CARD_W, ...card, id: card.id ?? newCanvasId() };
  return { doc: { ...doc, cards: [...doc.cards, full] }, card: full };
}

export function updateCard(doc: CanvasDoc, id: string, patch: Partial<CanvasCard>): CanvasDoc {
  return { ...doc, cards: doc.cards.map((c) => (c.id === id ? { ...c, ...patch, id } : c)) };
}

/** Removes a card and every line touching it. */
export function removeCard(doc: CanvasDoc, id: string): CanvasDoc {
  return {
    ...doc,
    cards: doc.cards.filter((c) => c.id !== id),
    edges: doc.edges.filter((e) => e.from !== id && e.to !== id),
  };
}

/** Joins two cards. A second line between the same two cards isn't added. */
export function connect(doc: CanvasDoc, from: string, to: string, label?: string): CanvasDoc {
  if (from === to) return doc;
  if (!doc.cards.some((c) => c.id === from) || !doc.cards.some((c) => c.id === to)) return doc;
  if (doc.edges.some((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from)))
    return doc;
  const edge: CanvasEdge = { id: newCanvasId(), from, to };
  if (label?.trim()) edge.label = label.trim();
  return { ...doc, edges: [...doc.edges, edge] };
}

export function updateEdge(doc: CanvasDoc, id: string, label: string): CanvasDoc {
  return {
    ...doc,
    edges: doc.edges.map((e) => {
      if (e.id !== id) return e;
      const next: CanvasEdge = { id: e.id, from: e.from, to: e.to };
      if (label.trim()) next.label = label.trim();
      return next;
    }),
  };
}

export function removeEdge(doc: CanvasDoc, id: string): CanvasDoc {
  return { ...doc, edges: doc.edges.filter((e) => e.id !== id) };
}

/** The card a card hangs from in a mind map: the first line that points at it. */
export function parentOf(doc: CanvasDoc, id: string): string | null {
  return doc.edges.find((e) => e.to === id)?.from ?? null;
}

export function childrenOf(doc: CanvasDoc, id: string): CanvasCard[] {
  const ids = new Set(doc.edges.filter((e) => e.from === id).map((e) => e.to));
  return doc.cards.filter((c) => ids.has(c.id));
}

const GAP_X = 80;
const GAP_Y = 24;

/**
 * Mind map: a new card to the right of `parentId`, joined to it, placed below
 * its last child so children stack in a column. Returns the new card.
 */
export function addChild(
  doc: CanvasDoc,
  parentId: string,
  heights: Record<string, number> = {},
): { doc: CanvasDoc; card: CanvasCard } | null {
  const parent = doc.cards.find((c) => c.id === parentId);
  if (!parent) return null;
  const kids = childrenOf(doc, parentId);
  const x = parent.x + parent.w + GAP_X;
  const y = kids.length
    ? Math.max(...kids.map((k) => k.y + (heights[k.id] ?? CARD_H))) + GAP_Y
    : parent.y;
  const added = addCard(doc, { kind: "text", text: "", x, y });
  return { doc: connect(added.doc, parentId, added.card.id), card: added.card };
}

/** Mind map: a new card under the same parent (or a new root under this one). */
export function addSibling(
  doc: CanvasDoc,
  id: string,
  heights: Record<string, number> = {},
): { doc: CanvasDoc; card: CanvasCard } | null {
  const card = doc.cards.find((c) => c.id === id);
  if (!card) return null;
  const parent = parentOf(doc, id);
  if (parent) return addChild(doc, parent, heights);
  return addCard(doc, {
    kind: "text",
    text: "",
    x: card.x,
    y: card.y + (heights[id] ?? CARD_H) + GAP_Y * 2,
  });
}

/** A starting mind map: one card in the middle. */
export function mindMapStart(text = ""): CanvasDoc {
  return addCard(emptyCanvas(), { kind: "text", text, x: -CARD_W / 2, y: -CARD_H / 2 }).doc;
}

/** Where to put a new card so it lands in the middle of what's on screen. */
export function centreOf(view: CanvasView, width: number, height: number) {
  return {
    x: (width / 2 - view.x) / view.zoom - CARD_W / 2,
    y: (height / 2 - view.y) / view.zoom - CARD_H / 2,
  };
}

/**
 * The nearest place to (x, y) where a new card won't cover another one:
 * tries the spot itself, then rings of spots around it.
 */
export function freeSpot(
  doc: CanvasDoc,
  x: number,
  y: number,
  heights: Record<string, number> = {},
): { x: number; y: number } {
  const gap = 16;
  const clear = (px: number, py: number) =>
    doc.cards.every(
      (c) =>
        px + CARD_W + gap <= c.x ||
        px >= c.x + c.w + gap ||
        py + CARD_H + gap <= c.y ||
        py >= c.y + (heights[c.id] ?? CARD_H) + gap,
    );
  if (clear(x, y)) return { x, y };
  const stepX = CARD_W / 2;
  const stepY = CARD_H / 2;
  for (let ring = 1; ring <= 12; ring++) {
    for (let j = -ring; j <= ring; j++) {
      for (const [i, k] of [
        [j, ring],
        [ring, j],
        [j, -ring],
        [-ring, j],
      ] as const) {
        const px = x + i * stepX;
        const py = y + k * stepY;
        if (clear(px, py)) return { x: px, y: py };
      }
    }
  }
  return { x, y };
}

/** A view that shows every card, centred, with a margin. */
export function fitView(
  doc: CanvasDoc,
  width: number,
  height: number,
  heights: Record<string, number> = {},
  margin = 32,
): CanvasView {
  if (!doc.cards.length) return { x: width / 2, y: height / 2, zoom: 1 };
  const minX = Math.min(...doc.cards.map((c) => c.x));
  const minY = Math.min(...doc.cards.map((c) => c.y));
  const maxX = Math.max(...doc.cards.map((c) => c.x + c.w));
  const maxY = Math.max(...doc.cards.map((c) => c.y + (heights[c.id] ?? CARD_H)));
  const zoom = clampZoom(
    Math.min(
      1,
      (width - margin * 2) / Math.max(1, maxX - minX),
      (height - margin * 2) / Math.max(1, maxY - minY),
    ),
  );
  return {
    x: width / 2 - ((minX + maxX) / 2) * zoom,
    y: height / 2 - ((minY + maxY) / 2) * zoom,
    zoom,
  };
}

/** Zooms by `factor` keeping the screen point (px, py) still. */
export function zoomAt(view: CanvasView, factor: number, px: number, py: number): CanvasView {
  const zoom = clampZoom(view.zoom * factor);
  const k = zoom / view.zoom;
  return { x: px - (px - view.x) * k, y: py - (py - view.y) * k, zoom };
}

type Box = { x: number; y: number; w: number; h: number };

/**
 * The two points a line between two cards runs between: the middle of the
 * sides that face each other.
 */
export function edgePoints(a: Box, b: Box) {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = bc.x - ac.x;
  const dy = bc.y - ac.y;
  // Compare against the cards' shapes so wide cards prefer left/right sides.
  const horizontal = Math.abs(dx) / ((a.w + b.w) / 2) >= Math.abs(dy) / ((a.h + b.h) / 2);
  if (horizontal) {
    const s = dx >= 0 ? 1 : -1;
    return {
      x1: ac.x + (s * a.w) / 2,
      y1: ac.y,
      x2: bc.x - (s * b.w) / 2,
      y2: bc.y,
      horizontal,
    };
  }
  const s = dy >= 0 ? 1 : -1;
  return { x1: ac.x, y1: ac.y + (s * a.h) / 2, x2: bc.x, y2: bc.y - (s * b.h) / 2, horizontal };
}

/* ------------------------------------------------------------ Saving */

export async function createCanvas(
  title: string,
  doc: CanvasDoc = emptyCanvas(),
  extraTags: string[] = [],
  id?: string,
): Promise<Note> {
  return createNote({
    ...(id ? { id } : {}),
    title,
    body: serializeCanvas(doc),
    tags: [CANVAS_TAG, ...extraTags],
  });
}

export function saveCanvas(id: string, title: string, doc: CanvasDoc): Promise<Note> {
  return updateNote(id, { title, body: serializeCanvas(doc) });
}

/** The same id for the same user and day, on every device. */
export async function dayCanvasId(date: string): Promise<string> {
  return uuidV5(`day-canvas:${await currentUserId()}:${date}`);
}

/** The canvas for a day, if one was made. */
export function dayCanvasOn<T extends Pick<Note, "tags" | "updated_at">>(
  notes: T[],
  date: string,
): T | null {
  const tag = `${CANVAS_DAY_PREFIX}${date}`;
  const found = notes.filter((n) => n.tags.includes(tag) && n.tags.includes(CANVAS_TAG));
  if (!found.length) return null;
  return found.reduce((a, b) => (b.updated_at > a.updated_at ? b : a));
}

/** A day's canvas starts with that day's note on it, when there is one. */
export function dayCanvasStart(dailyNoteId: string | null, date: string): CanvasDoc {
  if (dailyNoteId) {
    return addCard(emptyCanvas(), {
      kind: "note",
      noteId: dailyNoteId,
      x: -CARD_W / 2,
      y: -CARD_H / 2,
      w: 240,
    }).doc;
  }
  return mindMapStart(dailyTitle(date));
}
