// Multi-field search with tiered scoring. The goal is "more robust but not
// crowded": a query like "n" matches Netflix-like titles only, while "nolan"
// matches Christopher Nolan as a director once director data is enriched.
//
// Tiers (higher = better match):
//   100  title starts with query
//    80  title contains query
//    75  original title contains query
//    50  cast / developer name contains query        (3+ char queries)
//    45  director / publisher / creator contains q   (3+ char queries)
//    30  genre contains query                        (3+ char queries)
//    10  overview contains query                     (4+ char queries)
//
// Short queries narrow the field on purpose — typing "i" shouldn't return
// every movie whose plot summary contains "i". The 3- and 4-char floors are
// what keeps results from feeling crowded.

const lower = (s) => (s || '').toLowerCase();
const includesAny = (arr, q) => Array.isArray(arr) && arr.some((s) => lower(s).includes(q));

export const matchScore = (m, q) => {
  if (!q) return 1;
  const t = lower(m.title);
  const ot = lower(m.originalTitle);

  if (t.startsWith(q)) return 100;
  if (t.includes(q)) return 80;
  if (ot && ot.includes(q)) return 75;

  if (q.length < 3) return 0;

  if (m.type === 'game') {
    if (includesAny(m.developers, q)) return 50;
    if (includesAny(m.publishers, q)) return 45;
  } else {
    if (includesAny(m.cast, q)) return 50;
    const directorish = m.director || m.creator;
    if (directorish && lower(directorish).includes(q)) return 45;
  }

  if (includesAny(m.genres, q)) return 30;

  if (q.length >= 4 && lower(m.overview).includes(q)) return 10;

  return 0;
};

// Filter + sort by score. Stable secondary sort keeps the original order for
// ties so the rest of the pipeline (year/genre filters, shuffle) still feels
// predictable.
export const searchAndScore = (items, query) => {
  const q = (query || '').trim().toLowerCase();
  if (!q) return items;
  const scored = [];
  for (let i = 0; i < items.length; i++) {
    const score = matchScore(items[i], q);
    if (score > 0) scored.push({ item: items[i], score, i });
  }
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.map((s) => s.item);
};
