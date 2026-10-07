import { ArrowUp, Check, Compass, Info, LocateFixed } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { nativeCompass } from "@/lib/native";
import {
  distanceToKaabaKm,
  poseFromCompass,
  poseFromOrientation,
  qiblaBearing,
  smoothHeading,
  turnTo,
  type HoldMode,
} from "@/lib/qibla";
import { cn } from "@/lib/utils";

/** Within this many degrees counts as facing the Qibla. */
const ALIGNED = 4;
/** Stop asking GPS once it's this precise, or after this long. */
const GOOD_FIX_M = 30;
const FIX_TIMEOUT_MS = 45_000;
const MODE_KEY = "qibla:mode";

type OrientationEventWithCompass = DeviceOrientationEvent & { webkitCompassHeading?: number };
type PermissionedOrientation = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type Place = { latitude: number; longitude: number; accuracy: number | null; fresh: boolean };
type Reading = {
  heading: number;
  hold: "flat" | "upright";
  /** Degrees, from the sensor; null when it doesn't say. */
  accuracy: number | null;
  /** 0 unreliable … 3 high; null when the source doesn't say (website). */
  calibration: number | null;
  trueNorth: boolean;
};

/** size: drawing units, for use inside another SVG (CSS sizes don't apply there). */
function KaabaIcon({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      {...(size ? { width: size, height: size } : {})}
      aria-hidden="true"
    >
      <path d="M8 16 24 9l16 7v20l-16 7-16-7z" fill="#121212" />
      <path d="M8 16 24 23l16-7" fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
      <path d="M24 23v20" stroke="#2a2a2a" strokeWidth="1.5" />
      <path d="M8 20.5 24 27.5l16-7" fill="none" stroke="#c9a54a" strokeWidth="2.5" />
    </svg>
  );
}

function readMode(): HoldMode {
  try {
    const value = localStorage.getItem(MODE_KEY);
    return value === "flat" || value === "upright" ? value : "auto";
  } catch {
    return "auto";
  }
}

/** A fresh GPS fix each time the finder opens; GPS works without internet. */
function useFreshLocation(saved: { latitude: number; longitude: number } | null) {
  const [place, setPlace] = useState<Place | null>(
    saved ? { ...saved, accuracy: null, fresh: false } : null,
  );
  const [searching, setSearching] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!navigator.geolocation) {
      setSearching(false);
      setFailed(true);
      return;
    }
    setSearching(true);
    setFailed(false);
    let best: number | null = null;
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (best != null && accuracy >= best) return;
        best = accuracy;
        setPlace({ latitude, longitude, accuracy, fresh: true });
        if (accuracy <= GOOD_FIX_M) {
          navigator.geolocation.clearWatch(watch);
          setSearching(false);
        }
      },
      () => {
        setSearching(false);
        setFailed(true);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: FIX_TIMEOUT_MS },
    );
    const stop = window.setTimeout(() => {
      navigator.geolocation.clearWatch(watch);
      setSearching(false);
    }, FIX_TIMEOUT_MS);
    return () => {
      navigator.geolocation.clearWatch(watch);
      window.clearTimeout(stop);
    };
  }, [attempt]);

  return { place, searching, failed, retry: () => setAttempt((value) => value + 1) };
}

/**
 * Qibla finder. Lying flat it's a compass dial; held upright, an arrow
 * points where the back of the phone should face. In the Android app the
 * heading comes from the phone's own sensors, corrected from magnetic to true
 * north for where you are, and it says when the compass needs calibrating.
 */
export function QiblaFinder({
  latitude,
  longitude,
  place: placeName,
}: {
  latitude: number | null;
  longitude: number | null;
  place: string | null;
}) {
  const saved = latitude != null && longitude != null ? { latitude, longitude } : null;
  const { place, searching, failed, retry } = useFreshLocation(saved);
  const [mode, setModeState] = useState<HoldMode>(() => readMode());
  const [reading, setReading] = useState<Reading | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [webRunning, setWebRunning] = useState(false);
  const [silent, setSilent] = useState(false);
  const [wasCalibrating, setWasCalibrating] = useState(false);
  const smoothed = useRef<number | null>(null);
  const wasAligned = useRef(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const native = nativeCompass.available();
  const target = place ? qiblaBearing(place.latitude, place.longitude) : null;
  const turn = reading && target != null ? turnTo(reading.heading, target) : null;
  const aligned = turn != null && Math.abs(turn) <= ALIGNED;
  const needsCalibration =
    reading != null &&
    ((reading.calibration != null && reading.calibration <= 1) ||
      (reading.accuracy != null && reading.accuracy > 20));

  function setMode(next: HoldMode) {
    setModeState(next);
    smoothed.current = null;
    nativeCompass.setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // Not remembered in private mode.
    }
  }

  useEffect(() => {
    if (aligned && !wasAligned.current) {
      try {
        navigator.vibrate?.(40);
      } catch {
        // No vibration.
      }
    }
    wasAligned.current = aligned;
  }, [aligned]);

  useEffect(() => {
    if (needsCalibration) setWasCalibrating(true);
  }, [needsCalibration]);

  // Android app: the native, true-north compass. Restarts only when the place
  // moves meaningfully (a better GPS fix nearby changes nothing visible).
  const latKey = place ? place.latitude.toFixed(3) : null;
  const lonKey = place ? place.longitude.toFixed(3) : null;
  useEffect(() => {
    if (!native || !place) return;
    window.__lifeOSCompass = (heading, accuracy, calibration, upright) => {
      smoothed.current = smoothHeading(smoothed.current, heading, 0.3);
      setReading({
        heading: smoothed.current,
        hold: upright ? "upright" : "flat",
        accuracy: accuracy >= 0 ? accuracy : null,
        calibration,
        trueNorth: true,
      });
    };
    if (!nativeCompass.start(place.latitude, place.longitude, modeRef.current)) setSilent(true);
    return () => {
      nativeCompass.stop();
      delete window.__lifeOSCompass;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native, latKey, lonKey]);

  // Website: orientation events (magnetic north, no calibration info).
  useEffect(() => {
    if (native) return;
    const Orientation = window.DeviceOrientationEvent as PermissionedOrientation | undefined;
    if (!Orientation) {
      setSilent(true);
      return;
    }
    if (typeof Orientation.requestPermission === "function" && !webRunning) {
      setNeedsTap(true);
      return;
    }
    const absolute = "ondeviceorientationabsolute" in window;
    const handle = (event: Event) => {
      const value = event as OrientationEventWithCompass;
      let pose = null;
      if (typeof value.webkitCompassHeading === "number") {
        pose = poseFromCompass(value.webkitCompassHeading);
      } else if (value.alpha != null && value.beta != null && value.gamma != null) {
        if (!absolute && !value.absolute) return;
        pose = poseFromOrientation(value.alpha, value.beta, value.gamma, modeRef.current);
      }
      if (!pose) return;
      smoothed.current = smoothHeading(smoothed.current, pose.heading);
      setReading({
        heading: smoothed.current,
        hold: pose.hold,
        accuracy: null,
        calibration: null,
        trueNorth: false,
      });
      setSilent(false);
    };
    const name = absolute ? "deviceorientationabsolute" : "deviceorientation";
    window.addEventListener(name, handle);
    const quiet = window.setTimeout(() => {
      if (smoothed.current == null) setSilent(true);
    }, 3000);
    return () => {
      window.removeEventListener(name, handle);
      window.clearTimeout(quiet);
    };
  }, [native, webRunning]);

  async function allowWeb() {
    const Orientation = window.DeviceOrientationEvent as PermissionedOrientation | undefined;
    try {
      await Orientation?.requestPermission?.();
    } catch {
      // See whether readings arrive anyway.
    }
    setNeedsTap(false);
    setWebRunning(true);
  }

  const notice = (
    <p className="flex gap-2 rounded-lg border border-border bg-secondary/60 p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>
        For reference only, and still in development. Phone compasses can be thrown off by metal,
        magnets and cases; when it matters, check against a mosque or a known Qibla.
      </span>
    </p>
  );

  if (!place || target == null) {
    return (
      <section className="space-y-3">
        {notice}
        <div className="space-y-3 rounded-xl border border-border bg-card p-5">
          <p className="text-sm">
            {searching ? "Finding where you are…" : "The Qibla is worked out from where you are."}
          </p>
          {!searching ? (
            <Button type="button" onClick={retry}>
              <LocateFixed className="size-4" /> Try again
            </Button>
          ) : null}
          {failed ? (
            <p className="text-sm text-muted-foreground">
              Couldn't get your location. Allow location for Life OS, or set it in Settings.
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  const guidance =
    turn == null
      ? "Waiting for the compass…"
      : aligned
        ? "Facing the Qibla"
        : `Turn ${turn > 0 ? "right" : "left"} ${Math.round(Math.abs(turn))}°`;
  const upright = reading?.hold === "upright" || (!reading && mode === "upright");

  return (
    <section className="space-y-4">
      {notice}

      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {Math.round(target)}° from true north ·{" "}
          {Math.round(distanceToKaabaKm(place.latitude, place.longitude)).toLocaleString()} km to
          Makkah
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LocateFixed className="size-3.5" aria-hidden="true" />
          {place.fresh
            ? `Your location now${place.accuracy != null ? ` (±${Math.round(place.accuracy)} m)` : ""}`
            : `Saved location${placeName ? ` (${placeName})` : ""}`}
          {searching ? " · finding you…" : ""}
          {!searching && !place.fresh ? (
            <button type="button" className="underline underline-offset-2" onClick={retry}>
              Try again
            </button>
          ) : null}
        </p>
      </div>

      <div
        className="flex gap-1 rounded-lg bg-secondary p-1"
        role="radiogroup"
        aria-label="How you hold the phone"
      >
        {(
          [
            { value: "auto", label: "Auto" },
            { value: "flat", label: "Lying flat" },
            { value: "upright", label: "Held upright" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={mode === option.value}
            onClick={() => setMode(option.value)}
            className={cn(
              "min-h-10 flex-1 rounded-md px-2 text-sm font-medium transition-colors",
              mode === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {needsTap ? (
        <Button type="button" onClick={() => void allowWeb()}>
          <Compass className="size-4" /> Start the compass
        </Button>
      ) : null}

      {needsCalibration ? (
        <div
          className="tone-warning flex items-center gap-3 rounded-xl border p-3 text-sm"
          role="status"
        >
          <svg viewBox="0 0 60 30" className="h-8 w-16 shrink-0" aria-hidden="true">
            <path
              d="M30 15C24 7 16 5 10 9s-4 14 4 14 10-4 16-8 10-12 18-12 10 8 4 12-14 2-22 0z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="qibla-eight"
            />
          </svg>
          <span>
            The compass needs calibrating. Move the phone in a figure 8 a few times, away from metal
            and magnets.
          </span>
        </div>
      ) : wasCalibrating && reading?.calibration === 3 ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground" role="status">
          <Check className="size-4" /> Compass calibrated.
        </p>
      ) : null}

      {upright ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <div
            className={cn(
              "grid size-64 max-w-[80vw] place-items-center rounded-full border-2 transition-colors",
              aligned ? "border-primary" : "border-border",
            )}
          >
            {aligned ? (
              <KaabaIcon className="size-28" />
            ) : (
              <ArrowUp
                className="size-32 text-primary transition-transform duration-100"
                style={{ transform: `rotate(${turn ?? 0}deg)` }}
                strokeWidth={2.5}
                aria-hidden="true"
              />
            )}
          </div>
          <p className={cn("text-lg font-semibold", aligned && "text-primary")} aria-live="polite">
            {guidance}
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Hold the phone up in front of you, screen facing you. Turn until the arrow points
            straight up.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="relative size-72 max-w-[85vw]">
            <div
              className="absolute left-1/2 top-0 z-10 h-5 w-1 -translate-x-1/2 rounded-full bg-foreground"
              aria-hidden="true"
            />
            <svg
              viewBox="0 0 200 200"
              className="size-full transition-transform duration-100"
              style={{ transform: `rotate(${-(reading?.heading ?? 0)}deg)` }}
              aria-hidden="true"
            >
              <circle
                cx="100"
                cy="100"
                r="92"
                fill="none"
                strokeWidth="2"
                className={aligned ? "stroke-primary" : "stroke-border"}
              />
              {Array.from({ length: 72 }, (_, index) => (
                <line
                  key={index}
                  x1="100"
                  y1="10"
                  x2="100"
                  y2={index % 9 === 0 ? 20 : 15}
                  className="stroke-muted-foreground"
                  strokeWidth={index % 9 === 0 ? 1.5 : 0.75}
                  transform={`rotate(${index * 5} 100 100)`}
                />
              ))}
              {(["N", "E", "S", "W"] as const).map((label, index) => (
                <text
                  key={label}
                  x="100"
                  y="36"
                  textAnchor="middle"
                  className={cn(
                    "text-[12px] font-semibold",
                    label === "N" ? "fill-primary" : "fill-muted-foreground",
                  )}
                  transform={`rotate(${index * 90} 100 100)`}
                >
                  {label}
                </text>
              ))}
              <g transform={`rotate(${target} 100 100)`}>
                <line
                  x1="100"
                  y1="100"
                  x2="100"
                  y2="57"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="stroke-primary"
                />
                <circle
                  cx="100"
                  cy="40"
                  r="17"
                  className="fill-secondary stroke-primary"
                  strokeWidth="1.5"
                />
                <g transform="translate(86 26)">
                  <KaabaIcon size={28} />
                </g>
              </g>
            </svg>
          </div>
          <p className={cn("text-lg font-semibold", aligned && "text-primary")} aria-live="polite">
            {guidance}
          </p>
          <p className="text-xs text-muted-foreground">
            Lay the phone flat; its top edge points the way.
          </p>
        </div>
      )}

      {silent ? (
        <p className="text-sm text-muted-foreground">
          No compass reading. Allow motion and orientation access, or use the Life OS app.
        </p>
      ) : null}
      {reading ? (
        <p className="text-xs text-muted-foreground">
          {reading.trueNorth
            ? `Corrected from magnetic to true north for where you are (${nativeCompass.declination().toFixed(1)}°).`
            : "On the website the compass reads magnetic north, so it can be a few degrees off. The Life OS app corrects for that."}
        </p>
      ) : null}
    </section>
  );
}
