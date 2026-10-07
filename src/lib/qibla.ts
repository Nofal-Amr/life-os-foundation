/**
 * Qibla direction and phone heading.
 *
 * The phone's heading comes from its full orientation, not just the compass
 * angle, so it works both lying flat (the top edge points the way) and held
 * up like a camera (the back of the phone points the way) — the camera view
 * in the Qibla finder relies on the second.
 */

export const KAABA = { latitude: 21.422487, longitude: 39.826206 } as const;

const rad = (degrees: number) => (degrees * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;

/** 0–360, clockwise from north. */
export function normalise(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** Great-circle bearing from a place to the Kaaba, clockwise from true north. */
export function qiblaBearing(latitude: number, longitude: number): number {
  const phi = rad(latitude);
  const phiK = rad(KAABA.latitude);
  const deltaLambda = rad(KAABA.longitude - longitude);
  const y = Math.sin(deltaLambda);
  const x = Math.cos(phi) * Math.tan(phiK) - Math.sin(phi) * Math.cos(deltaLambda);
  return normalise(deg(Math.atan2(y, x)));
}

/** Distance to the Kaaba in km (haversine). */
export function distanceToKaabaKm(latitude: number, longitude: number): number {
  const dPhi = rad(KAABA.latitude - latitude);
  const dLambda = rad(KAABA.longitude - longitude);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(rad(latitude)) * Math.cos(rad(KAABA.latitude)) * Math.sin(dLambda / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type Pose = {
  /** Which way the phone points, clockwise from north. */
  heading: number;
  /** "upright" when held up like a camera (heading = where the back faces). */
  hold: "flat" | "upright";
};

/**
 * Heading from a DeviceOrientation reading measured against north
 * (deviceorientationabsolute: alpha, beta, gamma in degrees).
 * Uses the rotation matrix from the W3C spec (Z-X'-Y'' intrinsic).
 */
export function poseFromOrientation(alpha: number, beta: number, gamma: number): Pose {
  const cA = Math.cos(rad(alpha));
  const sA = Math.sin(rad(alpha));
  const cB = Math.cos(rad(beta));
  const sB = Math.sin(rad(beta));
  const cG = Math.cos(rad(gamma));
  const sG = Math.sin(rad(gamma));
  // The back of the phone (−Z) in earth coordinates (x east, y north, z up).
  const back = {
    x: -(cA * sG + cG * sA * sB),
    y: -(sA * sG - cA * cG * sB),
    z: -cB * cG,
  };
  // Held up: the back points mostly sideways, so it gives the heading.
  if (Math.abs(back.z) < 0.6) {
    return { heading: normalise(deg(Math.atan2(back.x, back.y))), hold: "upright" };
  }
  // Lying flat: the top edge (+Y) gives it.
  const top = { x: -cB * sA, y: cA * cB };
  return { heading: normalise(deg(Math.atan2(top.x, top.y))), hold: "flat" };
}

/** iOS gives the compass heading directly (webkitCompassHeading), for a flat phone. */
export function poseFromCompass(compassHeading: number): Pose {
  return { heading: normalise(compassHeading), hold: "flat" };
}

/** Signed turn from heading to target, −180…180 (positive = turn right). */
export function turnTo(heading: number, target: number): number {
  return normalise(target - heading + 180) - 180;
}

/** Smooths noisy headings across the 0/360 seam. */
export function smoothHeading(previous: number | null, next: number, factor = 0.25): number {
  if (previous == null) return next;
  return normalise(previous + turnTo(previous, next) * factor);
}
