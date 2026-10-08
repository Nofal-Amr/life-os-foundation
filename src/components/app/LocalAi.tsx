import { Check, Cpu, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AI_MODEL, deleteModel, loadModel, modelDownloaded } from "@/lib/localAi";
import { cn } from "@/lib/utils";

/* -------------------------------------------- shared "is it here" state */

type AiState = { ready: boolean | null; progress: number | null };
let state: AiState = { ready: null, progress: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<AiState>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};
let checked = false;

/** Whether the on-device model is downloaded (null while checking). */
export function useLocalAi(): AiState {
  useEffect(() => {
    if (checked) return;
    checked = true;
    void modelDownloaded().then((ready) => set({ ready }));
  }, []);
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
}

/** Settings: download, or delete, the on-device model. */
export function LocalAiCard() {
  const { ready, progress } = useLocalAi();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    set({ progress: 0 });
    try {
      await loadModel((fraction) => set({ progress: fraction }));
      set({ ready: true, progress: null });
      toast.success("On-device AI is ready. It works offline now.");
    } catch {
      set({ progress: null });
      toast.error("The download didn't finish. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteModel();
      set({ ready: false });
      toast.success("Removed from this device.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stat-card space-y-3 p-5">
      <p className="flex items-center gap-2 text-base font-semibold">
        <Cpu className="size-4" /> On-device AI
      </p>
      <p className="text-xs text-muted-foreground">
        A small AI model ({AI_MODEL.label}) that runs on this device: it suggests first steps for a
        task and pulls tasks out of a note. Nothing you type leaves the device, and it works
        offline. It's small, so it can be wrong — you always pick what's kept.
      </p>
      {ready ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5">
            <Check className="size-4" /> On this device
          </span>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove()}>
            <Trash2 className="size-4" /> Remove ({AI_MODEL.sizeMb} MB)
          </Button>
        </div>
      ) : progress != null ? (
        <div className="space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">
            Downloading… {Math.round(progress * 100)}% of {AI_MODEL.sizeMb} MB. Keep the app open.
          </p>
        </div>
      ) : (
        <Button size="sm" disabled={busy || ready === null} onClick={() => void download()}>
          <Sparkles className="size-4" /> Download ({AI_MODEL.sizeMb} MB, once)
        </Button>
      )}
    </section>
  );
}

/**
 * Runs an on-device suggestion and lets you tick which ones to keep.
 * `run` produces the suggestions; `onKeep` saves the ones you picked.
 */
export function AiSuggestDialog({
  open,
  onOpenChange,
  title,
  description,
  run,
  onKeep,
  keepLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  run: () => Promise<string[]>;
  onKeep: (items: string[]) => Promise<void>;
  keepLabel: string;
}) {
  const [items, setItems] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setItems(null);
    run()
      .then((result) => {
        if (cancelled) return;
        setItems(result);
        setPicked(new Set(result.map((_, index) => index)));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
    // Run once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {items == null ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Thinking on this device…
          </p>
        ) : items.length ? (
          <ul className="space-y-1">
            {items.map((item, index) => (
              <li key={item}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-accent">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--primary)]"
                    checked={picked.has(index)}
                    onChange={(event) => {
                      const next = new Set(picked);
                      if (event.target.checked) next.add(index);
                      else next.delete(index);
                      setPicked(next);
                    }}
                  />
                  <span
                    className={cn(
                      "text-sm",
                      !picked.has(index) && "text-muted-foreground line-through",
                    )}
                  >
                    {item}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-sm text-muted-foreground">
            Nothing came up. Try writing a bit more.
          </p>
        )}
        {items?.length ? (
          <Button
            className="h-11 w-full"
            disabled={!picked.size || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onKeep(items.filter((_, index) => picked.has(index)));
                onOpenChange(false);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Couldn't save them.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {keepLabel} ({picked.size})
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
