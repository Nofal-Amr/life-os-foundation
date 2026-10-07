import { Camera, Compass, LocateFixed } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  distanceToKaabaKm,
  poseFromCompass,
  poseFromOrientation,
  qiblaBearing,
  smoothHeading,
  turnTo,
  type Pose,
} from "@/lib/qibla";
import { cn } from "@/lib/utils";

/** Rough horizontal field of view of a phone's main camera held upright. */
const CAMERA_FOV = 60;
/** Within this many degrees counts as facing the Qibla. */
const ALIGNED = 4;

type OrientationEventWithCompass = DeviceOrientationEvent & { webkitCompassHeading?: number };
type PermissionedOrientation = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
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

/**
 * Qibla finder. Lying flat it's a compass; held up, the camera shows the
 * Kaaba marker where it lies, the way Google's Qibla Finder does. The
 * direction comes from the saved prayer location (or your location now).
 */
export function QiblaFinder({
  latitude,
  longitude,
  place,
}: {
  latitude: number | null;
  longitude: number | null;
  place: string | null;
}) {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(
    latitude != null && longitude != null ? { latitude, longitude } : null,
  );
  const [pose, setPose] = useState<Pose | null>(null);
  const [running, setRunning] = useState(false);
  const [camera, setCamera] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const smoothed = useRef<number | null>(null);
  const wasAligned = useRef(false);

  const target = location ? qiblaBearing(location.latitude, location.longitude) : null;
  const turn = pose && target != null ? turnTo(pose.heading, target) : null;
  const aligned = turn != null && Math.abs(turn) <= ALIGNED;

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

  // Sensors run only while the finder is on.
  useEffect(() => {
    if (!running) return;
    const absolute = "ondeviceorientationabsolute" in window;
    const handle = (event: Event) => {
      const reading = event as OrientationEventWithCompass;
      let next: Pose | null = null;
      if (typeof reading.webkitCompassHeading === "number") {
        // iOS: a ready compass heading; upright use falls back to the camera tilt below.
        next =
          reading.beta != null && Math.abs(reading.beta) > 55 && reading.alpha != null
            ? { heading: reading.webkitCompassHeading, hold: "upright" }
            : poseFromCompass(reading.webkitCompassHeading);
      } else if (reading.alpha != null && reading.beta != null && reading.gamma != null) {
        if (!absolute && !reading.absolute) return;
        next = poseFromOrientation(reading.alpha, reading.beta, reading.gamma);
      }
      if (!next) return;
      smoothed.current = smoothHeading(smoothed.current, next.heading);
      setPose({ heading: smoothed.current, hold: next.hold });
      setProblem(null);
    };
    const name = absolute ? "deviceorientationabsolute" : "deviceorientation";
    window.addEventListener(name, handle);
    const silence = window.setTimeout(() => {
      if (smoothed.current == null)
        setProblem(
          "No compass reading yet. Allow motion and orientation access, or try the Life OS app.",
        );
    }, 3000);
    return () => {
      window.removeEventListener(name, handle);
      window.clearTimeout(silence);
    };
  }, [running]);

  // Camera only while the camera view is on.
  useEffect(() => {
    if (!camera) return;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => {
        setProblem("The camera isn't available. The compass still works.");
        setCamera(false);
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [camera]);

  async function start(withCamera: boolean) {
    setProblem(null);
    const Orientation = window.DeviceOrientationEvent as PermissionedOrientation | undefined;
    if (!Orientation) {
      setProblem("This device has no compass sensor.");
      return;
    }
    // iOS asks first. Some browsers answer "denied" yet still send readings,
    // so listen anyway; the silence check below says so if nothing comes.
    if (typeof Orientation.requestPermission === "function") {
      try {
        await Orientation.requestPermission();
      } catch {
        // Carry on and see whether readings arrive.
      }
    }
    setRunning(true);
    setCamera(withCamera);
  }

  function locate() {
    setProblem(null);
    navigator.geolocation?.getCurrentPosition(
      (position) =>
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => setProblem("Couldn't get your location. You can set it in Settings."),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  }

  if (!location || target == null) {
    return (
      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <p className="text-sm">The Qibla is worked out from where you are.</p>
        <Button type="button" onClick={locate}>
          <LocateFixed className="size-4" /> Use my location
        </Button>
        {problem ? <p className="text-sm text-muted-foreground">{problem}</p> : null}
      </section>
    );
  }

  const guidance =
    turn == null
      ? "Waiting for the compass…"
      : aligned
        ? "Facing the Qibla"
        : `Turn ${turn > 0 ? "right" : "left"} ${Math.round(Math.abs(turn))}°`;

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {Math.round(target)}° from north ·{" "}
        {Math.round(distanceToKaabaKm(location.latitude, location.longitude)).toLocaleString()} km
        to Makkah
        {place ? ` · from ${place}` : ""}
      </p>

      {!running ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void start(true)}>
            <Camera className="size-4" /> Find with the camera
          </Button>
          <Button type="button" variant="outline" onClick={() => void start(false)}>
            <Compass className="size-4" /> Compass only
          </Button>
        </div>
      ) : null}

      {running && camera ? (
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black sm:max-w-md">
          <video ref={videoRef} playsInline muted className="size-full object-cover" />
          {pose?.hold === "upright" && turn != null ? (
            Math.abs(turn) < CAMERA_FOV / 2 ? (
              <div
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-100"
                style={{ left: `${50 + (turn / CAMERA_FOV) * 100}%` }}
              >
                <KaabaIcon className={cn("size-20 drop-shadow-lg", aligned && "scale-110")} />
              </div>
            ) : (
              <div
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-sm text-white",
                  turn > 0 ? "right-3" : "left-3",
                )}
              >
                {turn > 0 ? "Turn right →" : "← Turn left"}
              </div>
            )
          ) : (
            <p className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-lg bg-black/60 p-3 text-center text-sm text-white">
              Hold the phone up in front of you.
            </p>
          )}
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/40" aria-hidden="true" />
          <p
            className={cn(
              "absolute inset-x-0 bottom-0 p-3 text-center text-base font-semibold text-white",
              aligned ? "bg-primary/80" : "bg-black/50",
            )}
            aria-live="polite"
          >
            {guidance}
          </p>
        </div>
      ) : null}

      {running && !camera ? (
        <div className="flex flex-col items-center gap-3">
          <div className="relative size-72 max-w-[85vw]">
            <div
              className="absolute left-1/2 top-0 z-10 h-5 w-1 -translate-x-1/2 rounded-full bg-foreground"
              aria-hidden="true"
            />
            <svg
              viewBox="0 0 200 200"
              className="size-full transition-transform duration-100"
              style={{ transform: `rotate(${-(pose?.heading ?? 0)}deg)` }}
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
                  y2="44"
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
          {pose?.hold === "upright" ? (
            <p className="text-xs text-muted-foreground">
              Held up: the back of the phone points the way.
            </p>
          ) : null}
        </div>
      ) : null}

      {running ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCamera((value) => !value)}
          >
            {camera ? <Compass className="size-4" /> : <Camera className="size-4" />}
            {camera ? "Compass" : "Camera"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setRunning(false);
              setCamera(false);
              setPose(null);
              smoothed.current = null;
            }}
          >
            Stop
          </Button>
        </div>
      ) : null}

      {problem ? <p className="text-sm text-muted-foreground">{problem}</p> : null}
      <p className="text-xs text-muted-foreground">
        Keep away from metal, magnets and other phones. If it drifts, move the phone in a figure 8
        to calibrate.
      </p>
    </section>
  );
}
