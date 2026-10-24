import {
  Music,
  Pause,
  Play,
  RefreshCw,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { lifeConnect, type MediaAction, type MediaState } from "@/lib/native";

/**
 * Life Connect's music remote, on the main phone: what's playing on the SIM
 * phone, with Previous, Play/Pause, Next and its music volume. The same
 * buttons sit in a notification (lock screen and watch too) while it plays.
 * Opening this asks the SIM phone what's playing, and it keeps the remote up
 * to date for the next half hour.
 */
export function MusicRemote() {
  const [state, setState] = useState<MediaState | null>(() => lifeConnect.mediaState());
  const [volume, setVolume] = useState<number | null>(null);
  const [asked, setAsked] = useState(false);
  const dragging = useRef(false);

  useEffect(() => {
    lifeConnect.media("status");
    setAsked(true);
    const refresh = () => {
      const next = lifeConnect.mediaState();
      setState(next);
      if (!dragging.current) setVolume(null);
    };
    window.addEventListener("life-os-connect-media", refresh);
    // The bridge event only fires while the app is in front; a slow poll covers the rest.
    const timer = window.setInterval(refresh, 4000);
    return () => {
      window.removeEventListener("life-os-connect-media", refresh);
      window.clearInterval(timer);
    };
  }, []);

  const send = (action: MediaAction, level = 0) => {
    try {
      navigator.vibrate?.(10);
    } catch {
      // No vibration here.
    }
    lifeConnect.media(action, level);
  };

  const max = Math.max(1, state?.max ?? 15);
  const shownVolume = volume ?? state?.volume ?? 0;
  const stale = state?.at ? Date.now() - state.at > 10 * 60_000 : false;
  const title = state?.title?.trim();
  const heading = !state
    ? asked
      ? "Asking your SIM phone…"
      : "Nothing heard yet"
    : title || (state.playing ? `Playing on ${state.device}` : `Paused on ${state.device}`);
  const detail = state
    ? [state.artist, state.app, title ? `on ${state.device}` : null].filter(Boolean).join(" · ")
    : "Play music on your SIM phone, then control it from here.";

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <Music className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{heading}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
          {stale ? <p className="text-xs text-muted-foreground">Last heard a while ago.</p> : null}
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Ask again"
          onClick={() => send("status")}
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-12 rounded-full"
          aria-label="Previous"
          onClick={() => send("previous")}
        >
          <SkipBack className="size-5" />
        </Button>
        <Button
          type="button"
          size="icon"
          className="size-14 rounded-full"
          aria-label={state?.playing ? "Pause" : "Play"}
          onClick={() => {
            // Show the change at once; the SIM phone's answer confirms it.
            if (state) setState({ ...state, playing: !state.playing });
            send("toggle");
          }}
        >
          {state?.playing ? <Pause className="size-6" /> : <Play className="size-6" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-12 rounded-full"
          aria-label="Next"
          onClick={() => send("next")}
        >
          <SkipForward className="size-5" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Volume down"
          onClick={() => send("vol_down")}
        >
          <Volume1 className="size-4" />
        </Button>
        <Slider
          aria-label="Volume on your SIM phone"
          min={0}
          max={max}
          step={1}
          value={[shownVolume]}
          onValueChange={([value]) => {
            dragging.current = true;
            setVolume(value ?? 0);
          }}
          onValueCommit={([value]) => {
            dragging.current = false;
            send("vol_set", value ?? 0);
          }}
          className="flex-1"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Volume up"
          onClick={() => send("vol_up")}
        >
          <Volume2 className="size-4" />
        </Button>
        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
          {Math.round((shownVolume / max) * 100)}%
        </span>
      </div>
      {state && !state.known ? (
        <p className="text-xs text-muted-foreground">
          Song names show when the SIM phone runs Life OS Full with notification access. Playback
          and volume work either way.
        </p>
      ) : null}
    </div>
  );
}
