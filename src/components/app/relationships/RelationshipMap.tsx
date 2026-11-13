import { Maximize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import {
  litSet,
  relationLabel,
  type Circle,
  type LinkKind,
  type MapLayout,
  type PersonLink,
} from "@/data/relationships";

const RING_GAP = 110;
const RING_NAMES: Record<number, string> = {
  1: "Closest",
  2: "Family and friends",
  3: "Relatives and work",
};
/* Tint only helps tell circles apart; the ring and the label carry the meaning. */
const CIRCLE_TINT: Record<Circle, string> = {
  me: "var(--primary)",
  closest: "var(--chart-1)",
  family: "var(--chart-2)",
  friends: "var(--chart-3)",
  relatives: "var(--chart-4)",
  work: "var(--chart-5)",
};
const DASHED: LinkKind[] = ["friend", "colleague", "other"];
const LINK_WORD: Record<LinkKind, string> = {
  parent: "parent",
  child: "child",
  sibling: "sibling",
  spouse: "spouse",
  cousin: "cousin",
  friend: "friend",
  colleague: "colleague",
  other: "linked",
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

type View = { x: number; y: number; k: number };
const FIT: View = { x: 0, y: 0, k: 1 };
const clampK = (k: number) => Math.min(4, Math.max(0.4, k));

/**
 * The people map: Me in the centre, rings outward. Selecting someone makes
 * their side glow and dims everyone else; nobody is hidden. Drag to pan,
 * wheel or pinch to zoom, or use the buttons.
 */
export function RelationshipMap({
  layout,
  links,
  selectedId,
  onSelect,
}: {
  layout: MapLayout;
  links: PersonLink[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>(FIT);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: number; pinch: number | null }>({ moved: 0, pinch: null });

  const lit = useMemo(() => litSet(layout, links, selectedId), [layout, links, selectedId]);
  const half = Math.max(2, layout.rings + 0.75) * RING_GAP;
  const nodes = [...layout.nodes.values()];

  // Screen pixels → map units.
  const unit = useCallback(() => {
    const box = svgRef.current?.getBoundingClientRect();
    return box && box.width ? (2 * half) / Math.min(box.width, box.height || box.width) : 1;
  }, [half]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSelect(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSelect]);

  // Wheel zoom needs a non-passive listener so the page doesn't scroll.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setView((current) => ({
        ...current,
        k: clampK(current.k * Math.exp(-event.deltaY * 0.0015)),
      }));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) gesture.current = { moved: 0, pinch: null };
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const next = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, next);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const last = gesture.current.pinch;
      gesture.current.pinch = distance;
      gesture.current.moved += 10;
      if (last) setView((current) => ({ ...current, k: clampK((current.k * distance) / last) }));
      return;
    }
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    gesture.current.moved += Math.abs(dx) + Math.abs(dy);
    if (gesture.current.moved < 4) return;
    // Capture only once it's a real drag, so taps still reach the nodes.
    if (!svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current?.setPointerCapture(event.pointerId);
    }
    const u = unit();
    setView((current) => ({ ...current, x: current.x + dx * u, y: current.y + dy * u }));
  };
  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) gesture.current.pinch = null;
  };
  const wasDrag = () => gesture.current.moved >= 4;

  const dim = (id: string) => (lit ? !lit.has(id) : false);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <svg
        ref={svgRef}
        viewBox={`${-half} ${-half} ${2 * half} ${2 * half}`}
        className="block aspect-square max-h-[70vh] w-full cursor-grab touch-none select-none active:cursor-grabbing"
        role="group"
        aria-label="Map of your people. Me is in the centre. Select someone to light up their side."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(event) => {
          if (event.target === event.currentTarget && !wasDrag()) onSelect(null);
        }}
      >
        <defs>
          <filter id="people-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {Array.from({ length: layout.rings }, (_, index) => index + 1).map((ring) => (
            <g key={ring} aria-hidden="true" className="pointer-events-none">
              <circle
                r={ring * RING_GAP}
                fill="none"
                stroke="var(--border)"
                strokeDasharray="2 6"
              />
              {RING_NAMES[ring] ? (
                <text
                  y={-ring * RING_GAP + 14}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px] uppercase tracking-wider"
                  opacity={0.7}
                >
                  {RING_NAMES[ring]}
                </text>
              ) : null}
            </g>
          ))}

          {links.map((link) => {
            const a = layout.nodes.get(link.from_person);
            const b = layout.nodes.get(link.to_person);
            if (!a || !b) return null;
            const on = lit ? lit.has(a.person.id) && lit.has(b.person.id) : true;
            const touches =
              selectedId && (link.from_person === selectedId || link.to_person === selectedId);
            return (
              <g
                key={link.id}
                aria-hidden="true"
                className="pointer-events-none transition-opacity duration-200 motion-reduce:transition-none"
                opacity={on ? 1 : 0.12}
              >
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={lit && on ? "var(--primary)" : "var(--muted-foreground)"}
                  strokeOpacity={lit && on ? 0.75 : 0.35}
                  strokeWidth={lit && on ? 2 : 1.25}
                  strokeDasharray={DASHED.includes(link.kind) ? "5 5" : undefined}
                />
                {touches ? (
                  <text
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2 - 4}
                    textAnchor="middle"
                    className="fill-foreground text-[10px]"
                    paintOrder="stroke"
                    stroke="var(--card)"
                    strokeWidth={4}
                  >
                    {LINK_WORD[link.kind]}
                  </text>
                ) : null}
              </g>
            );
          })}

          {nodes.map((node) => {
            const { person } = node;
            const r = node.ring === 0 ? 26 : node.ring === 1 ? 20 : node.ring === 2 ? 17 : 14;
            const selected = person.id === selectedId;
            const glowing = !!lit && lit.has(person.id);
            const tint = CIRCLE_TINT[person.circle];
            return (
              <g
                key={person.id}
                transform={`translate(${node.x} ${node.y})`}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={`${person.name}, ${relationLabel(person.relation)}${selected ? ", selected" : ""}`}
                data-person={person.id}
                data-lit={lit ? String(glowing) : undefined}
                className="cursor-pointer outline-none transition-opacity duration-200 focus-visible:[&>circle.ring-focus]:opacity-100 motion-reduce:transition-none"
                opacity={dim(person.id) ? 0.22 : 1}
                onClick={(event) => {
                  event.stopPropagation();
                  if (wasDrag()) return;
                  onSelect(selected ? null : person.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(selected ? null : person.id);
                  }
                }}
              >
                {glowing ? (
                  <circle
                    r={r + (selected ? 9 : 6)}
                    fill="var(--primary)"
                    opacity={selected ? 0.45 : 0.25}
                    filter="url(#people-glow)"
                  />
                ) : null}
                <circle
                  className="ring-focus"
                  r={r + 4}
                  fill="none"
                  stroke="var(--ring)"
                  strokeWidth={2}
                  opacity={0}
                />
                <circle
                  r={r}
                  fill="var(--card)"
                  stroke={selected ? "var(--primary)" : tint}
                  strokeWidth={selected ? 3 : 2}
                />
                <circle r={r - 3} fill={tint} opacity={0.18} />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-foreground font-semibold"
                  fontSize={node.ring === 0 ? 13 : 11}
                >
                  {person.is_me ? "Me" : initials(person.name)}
                </text>
                {person.is_me ? null : (
                  <text
                    y={r + 13}
                    textAnchor="middle"
                    className="fill-foreground text-[11px]"
                    paintOrder="stroke"
                    stroke="var(--card)"
                    strokeWidth={4}
                  >
                    {person.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        {[
          {
            label: "Zoom in",
            icon: Plus,
            run: () => setView((v) => ({ ...v, k: clampK(v.k * 1.25) })),
          },
          {
            label: "Zoom out",
            icon: Minus,
            run: () => setView((v) => ({ ...v, k: clampK(v.k / 1.25) })),
          },
          { label: "Fit everyone", icon: Maximize2, run: () => setView(FIT) },
        ].map(({ label, icon: Icon, run }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            onClick={run}
            className="grid size-9 place-items-center rounded-lg border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
