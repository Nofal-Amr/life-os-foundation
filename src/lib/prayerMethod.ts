/**
 * The calculation method a country's own authority uses, so Spirit can
 * suggest it when the saved one differs (owner's decision: the method
 * follows the country; Egypt uses the Egyptian General Authority).
 * A suggestion only: the user's choice is never changed without a tap.
 */

/** Country name (as place lookups return it, lower case) → method key. */
const BY_COUNTRY: Record<string, string> = {
  egypt: "Egyptian",
  "saudi arabia": "UmmAlQura",
  "united arab emirates": "Dubai",
  kuwait: "Kuwait",
  qatar: "Qatar",
  turkey: "Turkey",
  türkiye: "Turkey",
  pakistan: "Karachi",
  singapore: "Singapore",
  "united states": "NorthAmerica",
  "united states of america": "NorthAmerica",
  canada: "NorthAmerica",
  iran: "Tehran",
  مصر: "Egyptian",
  السعودية: "UmmAlQura",
};

/** Roughly Egypt's land: used when the saved place has no country in its name. */
function inEgypt(latitude: number, longitude: number): boolean {
  return latitude >= 22 && latitude <= 31.7 && longitude >= 25 && longitude <= 35;
}

/** The method used where the saved place is, or null when it can't tell. */
export function localMethod(
  place: string | null,
  latitude: number | null,
  longitude: number | null,
): string | null {
  const country = place?.split(",").at(-1)?.trim().toLowerCase();
  if (country && place?.includes(",") && BY_COUNTRY[country]) return BY_COUNTRY[country]!;
  if (latitude != null && longitude != null && inEgypt(latitude, longitude)) return "Egyptian";
  return null;
}

/** The local method, when it differs from the one saved. */
export function methodSuggestion(
  current: string | null,
  place: string | null,
  latitude: number | null,
  longitude: number | null,
): string | null {
  const local = localMethod(place, latitude, longitude);
  return local && local !== (current ?? "MuslimWorldLeague") ? local : null;
}
