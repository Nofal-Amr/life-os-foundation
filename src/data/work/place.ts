/**
 * Is a location reading at one of the company's places? Phone GPS is often
 * 20–40 m off indoors, so a reading counts as inside when its distance minus
 * its accuracy is within the place's radius; readings worse than 100 m are
 * too vague to decide.
 */

export const WORST_ACCURACY_M = 100;
export const RADIUS_MIN_M = 20;
export const RADIUS_MAX_M = 500;
export const RADIUS_DEFAULT_M = 50;

export type Point = { latitude: number; longitude: number };
export type Reading = Point & { accuracy: number };
export type PlaceLike = Point & {
  id: string;
  name: string;
  radius_m: number;
  kind: "office" | "site";
};

export type PlaceCheck =
  | { status: "inside"; place: PlaceLike; distance: number }
  | { status: "outside"; nearest: PlaceLike | null; distance: number | null }
  | { status: "unclear" };

const EARTH_M = 6_371_000;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: Point, b: Point): number {
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

export function checkPlace(reading: Reading, places: PlaceLike[]): PlaceCheck {
  if (!(reading.accuracy <= WORST_ACCURACY_M)) return { status: "unclear" };
  let inside: { place: PlaceLike; distance: number } | null = null;
  let nearest: { place: PlaceLike; distance: number } | null = null;
  for (const place of places) {
    const distance = distanceMeters(reading, place);
    if (!nearest || distance < nearest.distance) nearest = { place, distance };
    if (distance - reading.accuracy <= place.radius_m && (!inside || distance < inside.distance)) {
      inside = { place, distance };
    }
  }
  if (inside) return { status: "inside", ...inside };
  return {
    status: "outside",
    nearest: nearest?.place ?? null,
    distance: nearest?.distance ?? null,
  };
}

function point(latitude: number, longitude: number): Point | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

/** "30.0444, 31.2357", or a maps link with "@lat,lng" or "q=lat,lng"; null otherwise. */
export function parsePlaceInput(text: string): Point | null {
  const match =
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/.exec(text) ??
    /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/.exec(text) ??
    /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
  return match ? point(Number(match[1]), Number(match[2])) : null;
}
