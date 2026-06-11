// Enrich movies/shows in src/data/movies.json with cast (top 5) and director
// (movies) / creator (shows). Uses TMDB credits endpoint. Idempotent — only
// fetches for entries missing the fields. Cached to scripts/.cache so re-runs
// are cheap.
//
// Usage: npm run enrich-credits

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'src', 'data', 'movies.json');
const CACHE_DIR = path.join(__dirname, '.cache');
const CACHE = path.join(CACHE_DIR, 'tmdb-credits.json');
fs.mkdirSync(CACHE_DIR, { recursive: true });

const API_KEY = process.env.VITE_TMDB_API_KEY || process.env.TMDB_API_KEY;
if (!API_KEY) { console.error('Set VITE_TMDB_API_KEY in .env.local'); process.exit(1); }
const BASE = 'https://api.themoviedb.org/3';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf-8')) : {};
const saveCache = () => fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2));

const fetchCredits = async (type, tmdbId) => {
  const key = `${type}:${tmdbId}`;
  if (cache[key]) return cache[key];
  const path = type === 'show' ? 'tv' : 'movie';
  const url = `${BASE}/${path}/${tmdbId}?api_key=${API_KEY}&append_to_response=credits`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`TMDB ${r.status} for ${key}`);
  const json = await r.json();
  const out = {
    cast: (json.credits?.cast || []).slice(0, 5).map((c) => c.name),
    director: type === 'show'
      ? (json.created_by?.[0]?.name || null)
      : (json.credits?.crew?.find((c) => c.job === 'Director')?.name || null),
  };
  cache[key] = out;
  saveCache();
  return out;
};

const main = async () => {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf-8'));
  let enriched = 0;
  let skipped = 0;
  let failed = 0;
  for (const m of data) {
    if (m.type === 'game' || !m.tmdbId) { skipped++; continue; }
    if (Array.isArray(m.cast) && m.cast.length && m.director !== undefined) { skipped++; continue; }
    try {
      const credits = await fetchCredits(m.type, m.tmdbId);
      m.cast = credits.cast;
      m.director = credits.director;
      enriched++;
      if (enriched % 25 === 0) {
        fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
        console.log(`  flushed @ ${enriched}`);
      }
      await sleep(40);
    } catch (e) {
      failed++;
      console.log(`  FAIL ${m.title}: ${e.message}`);
    }
  }
  fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
  console.log(`Done. enriched=${enriched} skipped=${skipped} failed=${failed}`);
};

main().catch((e) => { console.error(e); process.exit(1); });
