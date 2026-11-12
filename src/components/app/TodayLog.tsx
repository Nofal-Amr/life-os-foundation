import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

export type LogTile = {
  key: string;
  icon: LucideIcon;
  label: string;
  /** Where things stand right now, from your own entries ("Asr 2:39 PM"). */
  detail: string;
} & ({ onClick: () => void; to?: never } | { to: string; hash?: string; onClick?: never });

const tileClass =
  "group flex min-h-[4.5rem] min-w-0 items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-left transition-[scale,background-color] duration-150 ease-out hover:bg-accent active:scale-[0.97]";

/**
 * One row of things to log today, each showing where it stands and opening
 * its quick panel on a tap. Replaces a page of logging cards: the figure and
 * the action live on the same tile.
 */
export function TodayLog({ tiles }: { tiles: LogTile[] }) {
  if (!tiles.length) return null;
  return (
    <section aria-labelledby="today-log">
      <h2 id="today-log" className="mb-3 text-sm font-semibold text-foreground">
        Log
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
        {tiles.map((tile) => {
          const body = (
            <>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <tile.icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">
                  {tile.label}
                </span>
                <span className="block truncate text-xs tabular-nums text-muted-foreground">
                  {tile.detail}
                </span>
              </span>
            </>
          );
          return tile.to ? (
            <Link
              key={tile.key}
              to={tile.to}
              {...(tile.hash ? { hash: tile.hash } : {})}
              className={tileClass}
            >
              {body}
            </Link>
          ) : (
            <button key={tile.key} type="button" onClick={tile.onClick} className={tileClass}>
              {body}
            </button>
          );
        })}
      </div>
    </section>
  );
}
