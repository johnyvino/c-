// Client-only key + base URL for TMDB. Kept separate from `lib/tmdb.js` so
// that file can stay free of `import.meta.env` (it's imported by both the
// Vite bundle and the Node enrichment script).
//
// VITE_TMDB_API_KEY is inlined into the public bundle at build time. TMDB v3
// read-only keys are usage-restricted (rate-limit per key) — treat as
// public-by-design, not a secret. Each contributor uses their own key in
// .env.local; CI uses the workflow secret.
export const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
export const TMDB_BASE = 'https://api.themoviedb.org/3';
