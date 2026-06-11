// Watchmode key. Loaded from VITE_WATCHMODE_API_KEY (see .env.example).
// Vite inlines this into the bundle at build time — treat it as a
// usage-restricted public key, not a secret. Free tier is 1k req/month.
export const WATCHMODE_API_KEY = import.meta.env.VITE_WATCHMODE_API_KEY;
export const WATCHMODE_BASE = 'https://api.watchmode.com/v1';

// Subscription/free first, paid last. Determines which source's `web_url` we
// keep when one brand has multiple entries (e.g. Prime Video sub + buy).
const TYPE_PRIORITY = { sub: 0, free: 1, ads: 2, tve: 3, rent: 4, buy: 5, purchase: 5 };

// Resolve TMDB id → Watchmode title id, then fetch sources for the requested
// region. Returns [] on any failure so the caller can degrade gracefully.
export const fetchWatchmodeSources = async (tmdbId, type, region = 'US') => {
  if (!tmdbId || !WATCHMODE_API_KEY) return [];
  const searchField = type === 'show' ? 'tmdb_tv_id' : 'tmdb_movie_id';
  try {
    const sr = await fetch(
      `${WATCHMODE_BASE}/search/?apiKey=${WATCHMODE_API_KEY}`
      + `&search_field=${searchField}&search_value=${tmdbId}`
    );
    if (!sr.ok) return [];
    const sd = await sr.json();
    const wmId = sd.title_results?.[0]?.id;
    if (!wmId) return [];
    const r = await fetch(
      `${WATCHMODE_BASE}/title/${wmId}/sources/?apiKey=${WATCHMODE_API_KEY}&regions=${region}`
    );
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data.filter((s) => s.web_url) : [];
  } catch {
    return [];
  }
};

export { TYPE_PRIORITY as WATCHMODE_TYPE_PRIORITY };
