import { useEffect, useRef, useState } from "react";

/**
 * A figure that rolls when it changes: the old value slides up and out, the
 * new one slides in from below. The first render is still. Under reduced
 * motion the global rule removes the movement and keeps a short fade.
 */
export function AnimatedNumber({ value, className }: { value: string; className?: string }) {
  const previous = useRef(value);
  const [state, setState] = useState<{ from: string | null; to: string; n: number }>({
    from: null,
    to: value,
    n: 0,
  });

  useEffect(() => {
    if (previous.current === value) return;
    setState((current) => ({ from: previous.current, to: value, n: current.n + 1 }));
    previous.current = value;
  }, [value]);

  return (
    <span className={`relative inline-grid overflow-hidden align-bottom ${className ?? ""}`}>
      {state.from != null ? (
        <span
          key={`out-${state.n}`}
          aria-hidden="true"
          className="col-start-1 row-start-1 animate-out fade-out slide-out-to-top-[60%] fill-mode-forwards duration-300 ease-out"
        >
          {state.from}
        </span>
      ) : null}
      <span
        key={`in-${state.n}`}
        className={`col-start-1 row-start-1 ${state.n ? "animate-in fade-in slide-in-from-bottom-[60%] duration-300 ease-out" : ""}`}
      >
        {state.to}
      </span>
    </span>
  );
}
