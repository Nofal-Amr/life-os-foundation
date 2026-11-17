import {
  ExternalLink,
  GitBranchPlus,
  Link2,
  Maximize,
  Minus,
  Pencil,
  Plus,
  Spline,
  StickyNote,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  CARD_H,
  CARD_W,
  addCard,
  addChild,
  addSibling,
  centreOf,
  connect,
  edgePoints,
  fitView,
  freeSpot,
  isCanvasNote,
  removeCard,
  removeEdge,
  safeUrl,
  updateCard,
  updateEdge,
  zoomAt,
  type CanvasCard,
  type CanvasDoc,
  type CanvasView,
} from "@/data/canvas";
import { dailyDateOf, dailyTitle } from "@/data/dailyNotes";
import { checklistOf, isLockedNote, type Note } from "@/data/notes";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Selection = { type: "card" | "edge"; id: string } | null;

type Gesture =
  | { kind: "pan"; startX: number; startY: number; view: CanvasView; moved: boolean }
  | { kind: "pinch"; dist: number; midX: number; midY: number; view: CanvasView }
  | {
      kind: "card";
      id: string;
      pointerId: number;
      startX: number;
      startY: number;
      cardX: number;
      cardY: number;
      moved: boolean;
    }
  | { kind: "link"; from: string; pointerId: number }
  | null;

/** How far a pointer moves before a tap becomes a drag (screen px). */
const TAP_SLOP = 5;

/**
 * The canvas itself: cards you drag, lines between them, pan and zoom. Works
 * with a mouse (wheel pans, Ctrl+wheel zooms, drag the dot to connect) and
 * with touch (one finger pans or drags, two fingers zoom, buttons for the rest).
 * Keys when a card is selected: Tab adds a child, Enter a sibling, Delete
 * removes it, Escape lets go.
 */
export function CanvasBoard({
  doc,
  onChange,
  notes,
  onOpenNote,
}: {
  doc: CanvasDoc;
  onChange: (doc: CanvasDoc, opts?: { viewOnly?: boolean }) => void;
  notes: Note[];
  onOpenNote: (note: Note) => void;
}) {
  const t = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setViewState] = useState<CanvasView>(doc.view ?? { x: 0, y: 0, zoom: 1 });
  const viewRef = useRef(view);
  const docRef = useRef(doc);
  docRef.current = doc;
  const [selected, setSelected] = useState<Selection>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [linkLine, setLinkLine] = useState<{ x: number; y: number } | null>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const heightsRef = useRef(heights);
  heightsRef.current = heights;
  const [dialog, setDialog] = useState<"note" | "link" | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture>(null);
  const lastTap = useRef(0);

  const setView = useCallback(
    (next: CanvasView) => {
      viewRef.current = next;
      setViewState(next);
      onChange({ ...docRef.current, view: next }, { viewOnly: true });
    },
    [onChange],
  );

  // Size of the board, and a first view that centres the cards.
  const placed = useRef(!!doc.view);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setSize({ w, h });
      if (!placed.current && w && h) {
        placed.current = true;
        const first = fitView(docRef.current, w, h);
        viewRef.current = first;
        setViewState(first);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = boxRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.x) / v.zoom, y: (clientY - rect.top - v.y) / v.zoom };
  }, []);

  const local = useCallback((clientX: number, clientY: number) => {
    const rect = boxRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  /* ---------------------------------------------------------- Editing */

  const change = useCallback(
    (next: CanvasDoc) => onChange({ ...next, view: viewRef.current }),
    [onChange],
  );

  const select = (sel: Selection) => {
    setSelected(sel);
    if (!sel || sel.type !== "card" || sel.id !== editing) setEditing(null);
  };

  const addAndEdit = useCallback(
    (result: { doc: CanvasDoc; card: CanvasCard } | null) => {
      if (!result) return;
      change(result.doc);
      setSelected({ type: "card", id: result.card.id });
      if (result.card.kind === "text") setEditing(result.card.id);
      // Keep the new card in sight.
      const v = viewRef.current;
      const sx = result.card.x * v.zoom + v.x;
      const sy = result.card.y * v.zoom + v.y;
      const el = boxRef.current;
      if (
        el &&
        (sx < 0 ||
          sy < 0 ||
          sx + CARD_W * v.zoom > el.clientWidth ||
          sy + CARD_H * v.zoom > el.clientHeight)
      ) {
        setView({
          ...v,
          x: el.clientWidth / 2 - (result.card.x + CARD_W / 2) * v.zoom,
          y: el.clientHeight / 2 - (result.card.y + CARD_H / 2) * v.zoom,
        });
      }
    },
    [change, setView],
  );

  const addAtCentre = useCallback(
    (card: Omit<CanvasCard, "id" | "w" | "x" | "y">) => {
      const centre = centreOf(viewRef.current, size.w, size.h);
      const at = freeSpot(docRef.current, centre.x, centre.y, heightsRef.current);
      addAndEdit(addCard(docRef.current, { ...card, x: at.x, y: at.y }));
    },
    [addAndEdit, size],
  );

  const addChildOf = useCallback(
    (id: string) => addAndEdit(addChild(docRef.current, id, heightsRef.current)),
    [addAndEdit],
  );
  const addSiblingOf = useCallback(
    (id: string) => addAndEdit(addSibling(docRef.current, id, heightsRef.current)),
    [addAndEdit],
  );

  const removeSelected = useCallback(() => {
    if (!selected) return;
    change(
      selected.type === "card"
        ? removeCard(docRef.current, selected.id)
        : removeEdge(docRef.current, selected.id),
    );
    setSelected(null);
    setEditing(null);
  }, [change, selected]);

  // Keyboard: mind-map keys while a card is selected.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const inCardText = inField && !!target?.closest("[data-card-id]");
      if (inField && !inCardText) return;
      if (document.querySelector("[role=dialog]")) return;
      if (event.key === "Escape") {
        if (editing) setEditing(null);
        else {
          setSelected(null);
          setConnectFrom(null);
        }
        return;
      }
      if (!selected || selected.type !== "card") {
        if (
          !inField &&
          selected?.type === "edge" &&
          (event.key === "Delete" || event.key === "Backspace")
        ) {
          event.preventDefault();
          removeSelected();
        }
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        addChildOf(selected.id);
      } else if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        addSiblingOf(selected.id);
      } else if (!inField && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        removeSelected();
      } else if (!inField && event.key === "F2") {
        event.preventDefault();
        setEditing(selected.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, editing, addChildOf, addSiblingOf, removeSelected]);

  /* ---------------------------------------------------------- Board gestures */

  function onBoardPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("[data-card-id],[data-ui],[data-edge-id]")) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    boxRef.current?.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    startBoardGesture();
  }

  function startBoardGesture() {
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      gesture.current = {
        kind: "pinch",
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        midX: mid.x,
        midY: mid.y,
        view: viewRef.current,
      };
    } else if (pts.length === 1) {
      gesture.current = {
        kind: "pan",
        startX: pts[0]!.x,
        startY: pts[0]!.y,
        view: viewRef.current,
        moved: false,
      };
    }
  }

  function onBoardPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (g?.kind === "card" && event.pointerId === g.pointerId) {
      const dx = event.clientX - g.startX;
      const dy = event.clientY - g.startY;
      if (!g.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
      g.moved = true;
      const z = viewRef.current.zoom;
      change(updateCard(docRef.current, g.id, { x: g.cardX + dx / z, y: g.cardY + dy / z }));
      return;
    }
    if (g?.kind === "link" && event.pointerId === g.pointerId) {
      setLinkLine(toWorld(event.clientX, event.clientY));
      return;
    }
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (g?.kind === "pan") {
      const dx = event.clientX - g.startX;
      const dy = event.clientY - g.startY;
      if (!g.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
      g.moved = true;
      setView({ ...g.view, x: g.view.x + dx, y: g.view.y + dy });
    } else if (g?.kind === "pinch") {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      const zoomed = zoomAt(g.view, dist / g.dist, g.midX, g.midY);
      setView({ ...zoomed, x: zoomed.x + mid.x - g.midX, y: zoomed.y + mid.y - g.midY });
    }
  }

  function onBoardPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (g?.kind === "card" && event.pointerId === g.pointerId) {
      gesture.current = null;
      if (!g.moved) tapCard(g.id);
      return;
    }
    if (g?.kind === "link" && event.pointerId === g.pointerId) {
      gesture.current = null;
      setLinkLine(null);
      finishLink(g.from, event.clientX, event.clientY);
      return;
    }
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (g?.kind === "pan" && !g.moved) {
      // A tap on empty space lets go; a double tap adds a card there.
      const now = Date.now();
      if (now - lastTap.current < 320 && !connectFrom) {
        lastTap.current = 0;
        const at = toWorld(event.clientX, event.clientY);
        addAndEdit(
          addCard(docRef.current, {
            kind: "text",
            text: "",
            x: at.x - CARD_W / 2,
            y: at.y - CARD_H / 2,
          }),
        );
      } else {
        lastTap.current = now;
        select(null);
        setConnectFrom(null);
      }
    }
    // Lifting one finger of a pinch carries on as a pan with the other.
    gesture.current = null;
    if (pointers.current.size) startBoardGesture();
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-ui]")) return;
    const v = viewRef.current;
    if (event.ctrlKey || event.metaKey) {
      const p = local(event.clientX, event.clientY);
      setView(zoomAt(v, Math.exp(-event.deltaY * 0.01), p.x, p.y));
    } else {
      setView({ ...v, x: v.x - event.deltaX, y: v.y - event.deltaY });
    }
  }

  // Ctrl+wheel must not zoom the whole page.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const stop = (event: WheelEvent) => {
      if (!(event.target as HTMLElement).closest("[data-ui]")) event.preventDefault();
    };
    el.addEventListener("wheel", stop, { passive: false });
    return () => el.removeEventListener("wheel", stop);
  }, []);

  /* ---------------------------------------------------------- Cards */

  function onCardPointerDown(event: ReactPointerEvent<HTMLDivElement>, card: CanvasCard) {
    const target = event.target as HTMLElement;
    if (target.closest("button,a,textarea,input,[data-handle]")) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.stopPropagation();
    boxRef.current?.setPointerCapture(event.pointerId);
    gesture.current = {
      kind: "card",
      id: card.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cardX: card.x,
      cardY: card.y,
      moved: false,
    };
  }

  function tapCard(id: string) {
    if (connectFrom && connectFrom !== id) {
      change(connect(docRef.current, connectFrom, id));
      setConnectFrom(null);
      setSelected({ type: "card", id });
      return;
    }
    const card = docRef.current.cards.find((c) => c.id === id);
    if (selected?.type === "card" && selected.id === id && card?.kind === "text") {
      setEditing(id);
    } else {
      select({ type: "card", id });
    }
  }

  function onHandleDown(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    event.stopPropagation();
    event.preventDefault();
    boxRef.current?.setPointerCapture(event.pointerId);
    gesture.current = { kind: "link", from: id, pointerId: event.pointerId };
    setLinkLine(toWorld(event.clientX, event.clientY));
  }

  /** Dropped on a card: join them. Dropped on empty space: a new card there, joined. */
  function finishLink(from: string, clientX: number, clientY: number) {
    const hit = document
      .elementsFromPoint(clientX, clientY)
      .map((el) => (el as HTMLElement).closest?.("[data-card-id]") as HTMLElement | null)
      .find((el) => el && el.dataset["cardId"] !== from);
    if (hit?.dataset["cardId"]) {
      change(connect(docRef.current, from, hit.dataset["cardId"]));
      setSelected({ type: "card", id: hit.dataset["cardId"] });
      return;
    }
    const source = docRef.current.cards.find((c) => c.id === from);
    const at = toWorld(clientX, clientY);
    if (!source) return;
    const sx = source.x + source.w / 2;
    const sy = source.y + (heightsRef.current[from] ?? CARD_H) / 2;
    // A short flick back onto itself does nothing.
    if (Math.hypot(at.x - sx, at.y - sy) < 60) {
      setSelected({ type: "card", id: from });
      return;
    }
    const added = addCard(docRef.current, {
      kind: "text",
      text: "",
      x: at.x - CARD_W / 2,
      y: at.y - CARD_H / 2,
    });
    addAndEdit({ doc: connect(added.doc, from, added.card.id), card: added.card });
  }

  const measure = useCallback((id: string, h: number) => {
    setHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
  }, []);

  /* ---------------------------------------------------------- Render */

  const byId = useMemo(() => new Map(doc.cards.map((c) => [c.id, c])), [doc.cards]);
  const notesById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const selectedCard = selected?.type === "card" ? byId.get(selected.id) : undefined;
  const selectedEdge =
    selected?.type === "edge" ? doc.edges.find((e) => e.id === selected.id) : undefined;
  const box = (c: CanvasCard) => ({ x: c.x, y: c.y, w: c.w, h: heights[c.id] ?? CARD_H });

  const zoomBy = (factor: number) => setView(zoomAt(view, factor, size.w / 2, size.h / 2));

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Add cards */}
      <div
        data-ui
        className="absolute left-2 top-2 z-20 flex gap-1 rounded-full border border-border bg-card/95 p-1 shadow-sm backdrop-blur"
      >
        <ToolButton label={t("Text card")} onClick={() => addAtCentre({ kind: "text", text: "" })}>
          <Type className="size-4" />
        </ToolButton>
        <ToolButton label={t("Note card")} onClick={() => setDialog("note")}>
          <StickyNote className="size-4" />
        </ToolButton>
        <ToolButton label={t("Link card")} onClick={() => setDialog("link")}>
          <Link2 className="size-4" />
        </ToolButton>
      </div>
      {/* Zoom */}
      <div
        data-ui
        className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-full border border-border bg-card/95 p-1 shadow-sm backdrop-blur"
      >
        <ToolButton label={t("Zoom out")} onClick={() => zoomBy(1 / 1.25)}>
          <Minus className="size-4" />
        </ToolButton>
        <span
          className="w-10 text-center text-xs tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {Math.round(view.zoom * 100)}%
        </span>
        <ToolButton label={t("Zoom in")} onClick={() => zoomBy(1.25)}>
          <Plus className="size-4" />
        </ToolButton>
        <ToolButton
          label={t("Show everything")}
          onClick={() => setView(fitView(doc, size.w, size.h, heights))}
        >
          <Maximize className="size-4" />
        </ToolButton>
      </div>

      <div
        ref={boxRef}
        data-testid="canvas-board"
        className={cn(
          "relative min-h-0 flex-1 touch-none select-none overflow-hidden rounded-2xl border border-border bg-muted/30",
          connectFrom && "cursor-crosshair",
        )}
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in oklch, var(--color-muted-foreground) 22%, transparent) 1px, transparent 1px)",
          backgroundSize: `${24 * view.zoom}px ${24 * view.zoom}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
        onPointerDown={onBoardPointerDown}
        onPointerMove={onBoardPointerMove}
        onPointerUp={onBoardPointerUp}
        onPointerCancel={onBoardPointerUp}
        onWheel={onWheel}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        >
          <svg
            className="absolute left-0 top-0 overflow-visible"
            width="1"
            height="1"
            aria-hidden="false"
          >
            <defs>
              <marker
                id="canvas-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill="var(--color-muted-foreground)" />
              </marker>
            </defs>
            {doc.edges.map((edge) => {
              const a = byId.get(edge.from);
              const b = byId.get(edge.to);
              if (!a || !b) return null;
              const p = edgePoints(box(a), box(b));
              const d = curve(p);
              const isSel = selected?.type === "edge" && selected.id === edge.id;
              const mx = (p.x1 + p.x2) / 2;
              const my = (p.y1 + p.y2) / 2;
              return (
                <g key={edge.id} data-edge-id={edge.id}>
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={18 / view.zoom}
                    className="cursor-pointer"
                    style={{ pointerEvents: "stroke" }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => select({ type: "edge", id: edge.id })}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={isSel ? "var(--color-primary)" : "var(--color-muted-foreground)"}
                    strokeWidth={isSel ? 2.5 : 1.5}
                    markerEnd="url(#canvas-arrow)"
                    style={{ pointerEvents: "none" }}
                  />
                  {edge.label ? (
                    <foreignObject
                      x={mx - 80}
                      y={my - 14}
                      width="160"
                      height="28"
                      style={{ overflow: "visible" }}
                    >
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => select({ type: "edge", id: edge.id })}
                          className={cn(
                            "max-w-[160px] truncate rounded-full border bg-background px-2 py-0.5 text-xs",
                            isSel ? "border-primary" : "border-border",
                          )}
                        >
                          {edge.label}
                        </button>
                      </div>
                    </foreignObject>
                  ) : null}
                </g>
              );
            })}
            {linkLine && gesture.current?.kind === "link"
              ? (() => {
                  const from = byId.get(gesture.current.from);
                  if (!from) return null;
                  const b = box(from);
                  return (
                    <line
                      x1={b.x + b.w / 2}
                      y1={b.y + b.h / 2}
                      x2={linkLine.x}
                      y2={linkLine.y}
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                    />
                  );
                })()
              : null}
          </svg>

          {doc.cards.map((card) => (
            <CardView
              key={card.id}
              card={card}
              note={card.noteId ? notesById.get(card.noteId) : undefined}
              selected={selected?.type === "card" && selected.id === card.id}
              connectTarget={!!connectFrom && connectFrom !== card.id}
              editing={editing === card.id}
              onPointerDown={(event) => onCardPointerDown(event, card)}
              onText={(text) => change(updateCard(docRef.current, card.id, { text }))}
              onDoneEditing={() => setEditing((e) => (e === card.id ? null : e))}
              onHandleDown={(event) => onHandleDown(event, card.id)}
              onAddChild={() => addChildOf(card.id)}
              onMeasure={measure}
              onOpenNote={onOpenNote}
            />
          ))}
        </div>

        {!doc.cards.length ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-muted-foreground">
            {t("Double-tap anywhere to add a card, or use the buttons above.")}
          </div>
        ) : null}
        {connectFrom ? (
          <div
            data-ui
            className="absolute inset-x-0 top-14 z-20 mx-auto w-fit rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground shadow"
          >
            {t("Tap the card to connect to")}
          </div>
        ) : null}
      </div>

      {/* What you can do with the selection */}
      {selectedCard || selectedEdge ? (
        <div
          data-ui
          className="absolute inset-x-2 bottom-2 z-20 mx-auto flex w-fit max-w-[calc(100%-1rem)] flex-wrap items-center justify-center gap-1 rounded-2xl border border-border bg-card/95 p-1 shadow-md backdrop-blur"
        >
          {selectedCard ? (
            <>
              <BarButton label={t("Child")} onClick={() => addChildOf(selectedCard.id)}>
                <GitBranchPlus className="size-4" />
              </BarButton>
              <BarButton label={t("Sibling")} onClick={() => addSiblingOf(selectedCard.id)}>
                <Plus className="size-4" />
              </BarButton>
              <BarButton
                label={t("Connect")}
                active={connectFrom === selectedCard.id}
                onClick={() =>
                  setConnectFrom((c) => (c === selectedCard.id ? null : selectedCard.id))
                }
              >
                <Spline className="size-4" />
              </BarButton>
              {selectedCard.kind === "text" ? (
                <BarButton label={t("Edit")} onClick={() => setEditing(selectedCard.id)}>
                  <Pencil className="size-4" />
                </BarButton>
              ) : null}
            </>
          ) : selectedEdge ? (
            <EdgeLabel
              key={selectedEdge.id}
              value={selectedEdge.label ?? ""}
              onChange={(label) => change(updateEdge(docRef.current, selectedEdge.id, label))}
            />
          ) : null}
          <BarButton label={t("Delete")} onClick={removeSelected}>
            <Trash2 className="size-4" />
          </BarButton>
          <BarButton
            label={t("Done")}
            onClick={() => {
              select(null);
              setConnectFrom(null);
            }}
          >
            <X className="size-4" />
          </BarButton>
        </div>
      ) : null}

      <NotePicker
        open={dialog === "note"}
        onOpenChange={(open) => setDialog(open ? "note" : null)}
        notes={notes}
        onPick={(note) => {
          setDialog(null);
          addAtCentre({ kind: "note", noteId: note.id });
        }}
      />
      <LinkDialog
        open={dialog === "link"}
        onOpenChange={(open) => setDialog(open ? "link" : null)}
        onAdd={(url, text) => {
          setDialog(null);
          addAtCentre({ kind: "link", url, ...(text ? { text } : {}) });
        }}
      />
    </div>
  );
}

function curve(p: ReturnType<typeof edgePoints>): string {
  const { x1, y1, x2, y2, horizontal } = p;
  if (horizontal) {
    const c = Math.max(30, Math.abs(x2 - x1) / 2) * Math.sign(x2 - x1 || 1);
    return `M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}`;
  }
  const c = Math.max(30, Math.abs(y2 - y1) / 2) * Math.sign(y2 - y1 || 1);
  return `M${x1},${y1} C${x1},${y1 + c} ${x2},${y2 - c} ${x2},${y2}`;
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

function BarButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-10 min-w-10 flex-col items-center justify-center rounded-xl px-2 text-[11px] leading-tight hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-accent text-accent-foreground",
      )}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function EdgeLabel({ value, onChange }: { value: string; onChange: (label: string) => void }) {
  const t = useT();
  const [text, setText] = useState(value);
  return (
    <input
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        onChange(event.target.value);
      }}
      maxLength={60}
      placeholder={t("Label for this line")}
      aria-label={t("Label for this line")}
      className="h-10 w-44 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

function CardView({
  card,
  note,
  selected,
  connectTarget,
  editing,
  onPointerDown,
  onText,
  onDoneEditing,
  onHandleDown,
  onAddChild,
  onMeasure,
  onOpenNote,
}: {
  card: CanvasCard;
  note: Note | undefined;
  selected: boolean;
  connectTarget: boolean;
  editing: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onText: (text: string) => void;
  onDoneEditing: () => void;
  onHandleDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onAddChild: () => void;
  onMeasure: (id: string, h: number) => void;
  onOpenNote: (note: Note) => void;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => onMeasure(card.id, el.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [card.id, onMeasure]);

  useEffect(() => {
    if (editing) {
      const el = textRef.current;
      el?.focus();
      if (el) el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);

  return (
    <div
      ref={ref}
      data-card-id={card.id}
      data-testid="canvas-card"
      onPointerDown={onPointerDown}
      className={cn(
        "absolute rounded-xl border bg-card p-3 text-sm shadow-sm transition-shadow",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border",
        connectTarget && "ring-2 ring-dashed ring-primary/40",
        !editing && "cursor-grab active:cursor-grabbing",
      )}
      style={{ left: card.x, top: card.y, width: card.w, minHeight: CARD_H }}
    >
      {card.kind === "text" ? (
        editing ? (
          <textarea
            ref={textRef}
            value={card.text ?? ""}
            onChange={(event) => onText(event.target.value)}
            onBlur={onDoneEditing}
            rows={1}
            aria-label={t("Card text")}
            placeholder={t("Type an idea")}
            className="block w-full resize-none bg-transparent leading-snug outline-none [field-sizing:content] placeholder:text-muted-foreground"
          />
        ) : (
          <p
            className={cn(
              "whitespace-pre-wrap break-words leading-snug",
              !card.text?.trim() && "text-muted-foreground",
            )}
          >
            {card.text?.trim() ? card.text : t("Empty card")}
          </p>
        )
      ) : card.kind === "note" ? (
        <NoteCardBody note={note} onOpen={onOpenNote} />
      ) : (
        <LinkCardBody card={card} />
      )}

      {selected && !editing ? (
        <>
          {/* Drag this dot onto another card to join them, or onto empty space for a new card. */}
          <button
            type="button"
            data-handle
            aria-label={t("Drag to connect")}
            title={t("Drag to connect")}
            onPointerDown={onHandleDown}
            className="absolute -right-3 top-1/2 flex size-6 -translate-y-1/2 touch-none items-center justify-center rounded-full border-2 border-primary bg-background"
          >
            <span className="size-2 rounded-full bg-primary" />
          </button>
          <button
            type="button"
            aria-label={t("Add child")}
            title={t("Add child")}
            onClick={onAddChild}
            className="absolute -bottom-3 left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
          >
            <Plus className="size-3.5" />
          </button>
        </>
      ) : null}
    </div>
  );
}

function notePreview(note: Note): string {
  const list = checklistOf(note);
  if (list) return list.map((item) => `${item.done ? "✓" : "○"} ${item.text}`).join("\n");
  return (note.body ?? "").trim();
}

function NoteCardBody({ note, onOpen }: { note: Note | undefined; onOpen: (note: Note) => void }) {
  const t = useT();
  if (!note) {
    return <p className="text-muted-foreground">{t("This note isn't here any more.")}</p>;
  }
  const day = dailyDateOf(note);
  const title = day ? dailyTitle(day) : note.title || t("Untitled note");
  const locked = isLockedNote(note);
  const preview = locked ? t("Locked note") : notePreview(note);
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="min-w-0 flex-1 font-medium leading-snug">{title}</p>
        <button
          type="button"
          onClick={() => onOpen(note)}
          aria-label={t("Open note")}
          title={t("Open note")}
          className="-m-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="size-3.5" />
        </button>
      </div>
      {preview ? (
        <p className="line-clamp-5 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
          {preview}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("Nothing written yet.")}</p>
      )}
    </div>
  );
}

function LinkCardBody({ card }: { card: CanvasCard }) {
  const url = card.url ? safeUrl(card.url) : null;
  let host = card.url ?? "";
  try {
    if (url) host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // Keep the raw text.
  }
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <Link2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate font-medium">{card.text?.trim() || host}</p>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${host}`}
            className="-m-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
      <p className="truncate text-xs text-muted-foreground" dir="ltr">
        {url ?? card.url}
      </p>
    </div>
  );
}

function NotePicker({
  open,
  onOpenChange,
  notes,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: Note[];
  onPick: (note: Note) => void;
}) {
  const t = useT();
  const [term, setTerm] = useState("");
  const list = useMemo(() => {
    const q = term.trim().toLowerCase();
    return notes
      .filter((n) => !isCanvasNote(n) && !n.archived)
      .map((n) => {
        const day = dailyDateOf(n);
        return { note: n, title: day ? dailyTitle(day) : n.title || t("Untitled note") };
      })
      .filter(
        ({ note, title }) =>
          !q ||
          title.toLowerCase().includes(q) ||
          (!isLockedNote(note) && (note.body ?? "").toLowerCase().includes(q)),
      )
      .slice(0, 50);
  }, [notes, term, t]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>{t("Add a note to the canvas")}</DialogTitle>
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t("Search your notes")}
          aria-label={t("Search your notes")}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
          {list.length ? (
            list.map(({ note, title }) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => onPick(note)}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {title}
                </button>
              </li>
            ))
          ) : (
            <li className="py-6 text-center text-sm text-muted-foreground">
              {t("No notes found.")}
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function LinkDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (url: string, text: string) => void;
}) {
  const t = useT();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    if (open) {
      setUrl("");
      setText("");
      setError(false);
    }
  }, [open]);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const safe = safeUrl(url);
    if (!safe) {
      setError(true);
      return;
    }
    onAdd(safe, text.trim());
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>{t("Add a link")}</DialogTitle>
        <form onSubmit={submit} className="space-y-3">
          <input
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setError(false);
            }}
            inputMode="url"
            dir="ltr"
            placeholder="https://"
            aria-label={t("Web address")}
            aria-invalid={error}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {error ? (
            <p className="text-sm text-destructive">{t("That doesn't look like a web address.")}</p>
          ) : null}
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("What it is (optional)")}
            aria-label={t("What it is (optional)")}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex justify-end">
            <Button type="submit">Add</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
