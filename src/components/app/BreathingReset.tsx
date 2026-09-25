import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** 4-4-6-2: a longer out-breath settles the body. Four rounds is about a minute. */
const PHASES = [
  { label: "Breathe in", seconds: 4, scale: 1 },
  { label: "Hold", seconds: 4, scale: 1 },
  { label: "Breathe out", seconds: 6, scale: 0.55 },
  { label: "Rest", seconds: 2, scale: 0.55 },
] as const;
const ROUNDS = 4;

function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not every device can.
  }
}

/**
 * A one-minute reset: one circle that grows and shrinks with a word, nothing
 * else to read. Useful when everything is too much.
 */
export function BreathingReset({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [left, setLeft] = useState<number>(PHASES[0].seconds);
  // Starts small, so the first breath in visibly grows.
  const [armed, setArmed] = useState(false);
  const done = step >= ROUNDS * PHASES.length;
  const phase = PHASES[step % PHASES.length]!;

  useEffect(() => {
    if (!open) {
      setStep(0);
      setLeft(PHASES[0].seconds);
      setArmed(false);
      return;
    }
    if (!armed) {
      const start = window.setTimeout(() => setArmed(true), 60);
      return () => window.clearTimeout(start);
    }
    if (done) return;
    vibrate(30);
    setLeft(phase.seconds);
    const tick = window.setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    const next = window.setTimeout(() => setStep((value) => value + 1), phase.seconds * 1000);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(next);
    };
  }, [open, armed, step, done, phase.seconds]);
  const scale = !armed ? 0.55 : done ? 0.7 : phase.scale;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col items-center gap-6 py-10 sm:max-w-sm">
        <DialogTitle className="sr-only">One-minute reset</DialogTitle>
        <DialogDescription className="sr-only">
          Breathe in for 4, hold for 4, out for 6, rest for 2. Four rounds.
        </DialogDescription>
        <div className="relative grid size-56 place-items-center" aria-hidden="true">
          <div
            className="absolute inset-0 rounded-full bg-primary/15 motion-reduce:transition-none"
            style={{
              transform: `scale(${scale})`,
              transition: `transform ${phase.seconds}s ease-in-out`,
            }}
          />
          <div
            className="absolute inset-6 rounded-full border border-primary/40 motion-reduce:transition-none"
            style={{
              transform: `scale(${scale})`,
              transition: `transform ${phase.seconds}s ease-in-out`,
            }}
          />
          <div className="relative text-center">
            <p className="text-xl font-semibold">{done ? "Done" : phase.label}</p>
            {!done ? (
              <p className="mt-1 text-sm tabular-nums text-muted-foreground">{left}</p>
            ) : null}
          </div>
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {done
            ? "That was a minute. Carry on when you're ready."
            : `Round ${Math.floor(step / PHASES.length) + 1} of ${ROUNDS}`}
        </p>
        <Button variant={done ? "default" : "ghost"} onClick={() => onOpenChange(false)}>
          {done ? "Back" : "Stop"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
