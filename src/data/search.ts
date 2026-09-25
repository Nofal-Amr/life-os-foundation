/**
 * Search across everything you've logged. Matching is plain text: case,
 * accents and Arabic letter variants are ignored (أ/إ/آ → ا, ة → ه, ى → ي),
 * and a title that starts with the query ranks above one that merely
 * contains it. No fuzzy guessing.
 */
export type SearchKind =
  "task" | "project" | "goal" | "note" | "habit" | "spending" | "food" | "resource" | "event";

export type SearchItem = {
  kind: SearchKind;
  id: string;
  title: string;
  /** Extra text that can match (description, note body), not shown. */
  body?: string | null | undefined;
  detail?: string | undefined;
};

export type SearchResult = SearchItem & { rank: number };

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u064B-\u0655\u0670\u0640]/g, "") // Arabic diacritics, hamza and madda marks, tatweel
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

function rankOf(item: SearchItem, query: string): number | null {
  const title = normalize(item.title);
  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  if (title.split(" ").some((word) => word.startsWith(query))) return 2;
  if (title.includes(query)) return 3;
  if (item.body && normalize(item.body).includes(query)) return 4;
  return null;
}

/** Best matches first; at most `perKind` of each kind so one kind can't crowd out the rest. */
export function searchItems(items: SearchItem[], rawQuery: string, perKind = 5): SearchResult[] {
  const query = normalize(rawQuery);
  if (query.length < 2) return [];
  const counts = new Map<SearchKind, number>();
  return items
    .map((item) => ({ item, rank: rankOf(item, query) }))
    .filter((entry): entry is { item: SearchItem; rank: number } => entry.rank != null)
    .sort((a, b) => a.rank - b.rank || a.item.title.localeCompare(b.item.title))
    .filter(({ item }) => {
      const seen = counts.get(item.kind) ?? 0;
      counts.set(item.kind, seen + 1);
      return seen < perKind;
    })
    .map(({ item, rank }) => ({ ...item, rank }));
}
