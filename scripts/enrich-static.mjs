// Bake all runtime-fetched fields (cast, director, runtime, genres, score,
// photos, providers + Watchmode deep-links) into src/data/movies.json so the
// public site needs zero API access at runtime. Idempotent. Cached responses
// keep re-runs cheap — the weekly cron mostly hits cache and only fetches the
// titles where TMDB/Watchmode data has changed.
//
// Usage: npm run enrich-static [--force]
//   --force  ignore cache; re-fetch every title

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dedupeProviders, mergeWatchmodeIntoProviders, pickWatchRegion } from '../src/lib/tmdb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'src', 'data', 'movies.json');
const CACHE_DIR = path.join(__dirname, '.cache');
const TMDB_CACHE = path.join(CACHE_DIR, 'tmdb-static.json');
const WM_CACHE = path.join(CACHE_DIR, 'watchmode-static.json');
fs.mkdirSync(CACHE_DIR, { recursive: true });

const TMDB_KEY = process.env.VITE_TMDB_API_KEY || process.env.TMDB_API_KEY;
const WM_KEY = process.env.VITE_WATCHMODE_API_KEY || process.env.WATCHMODE_API_KEY;
if (!TMDB_KEY) { console.error('Set VITE_TMDB_API_KEY in .env.local'); process.exit(1); }
if (!WM_KEY) { console.error('Set VITE_WATCHMODE_API_KEY in .env.local'); process.exit(1); }

const TMDB_BASE = 'https://api.themoviedb.org/3';
const WM_BASE = 'https://api.watchmode.com/v1';
const WATCHMODE_TYPE_PRIORITY = { sub: 0, free: 1, ads: 2, tve: 3, rent: 4, buy: 5, purchase: 5 };

const force = process.argv.includes('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const loadJSON = (p, fallback) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return fallback; }
};
const tmdbCache = force ? {} : loadJSON(TMDB_CACHE, {});
const wmCache = force ? {} : loadJSON(WM_CACHE, {});
const flush = () => {
  fs.writeFileSync(TMDB_CACHE, JSON.stringify(tmdbCache, null, 2));
  fs.writeFileSync(WM_CACHE, JSON.stringify(wmCache, null, 2));
};

const fetchTmdb = async (type, tmdbId) => {
  const key = `${type}:${tmdbId}`;
  if (tmdbCache[key]) return tmdbCache[key];
  const segment = type === 'show' ? 'tv' : 'movie';
  const url = `${TMDB_BASE}/${segment}/${tmdbId}`
    + `?api_key=${TMDB_KEY}`
    + `&append_to_response=credits,images,watch/providers`
    + `&include_image_language=en,null`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`TMDB ${r.status}`);
  const json = await r.json();
  tmdbCache[key] = json;
  return json;
};

const fetchWatchmode = async (type, tmdbId, region = 'US') => {
  const key = `${type}:${tmdbId}:${region}`;
  if (wmCache[key]) return wmCache[key];
  try {
    const searchField = type === 'show' ? 'tmdb_tv_id' : 'tmdb_movie_id';
    const sr = await fetch(
      `${WM_BASE}/search/?apiKey=${WM_KEY}`
      + `&search_field=${searchField}&search_value=${tmdbId}`
    );
    if (!sr.ok) throw new Error(`WM search ${sr.status}`);
    const sd = await sr.json();
    const wmId = sd.title_results?.[0]?.id;
    if (!wmId) { wmCache[key] = []; return []; }
    const r = await fetch(
      `${WM_BASE}/title/${wmId}/sources/?apiKey=${WM_KEY}&regions=${region}`
    );
    if (!r.ok) throw new Error(`WM sources ${r.status}`);
    const data = await r.json();
    const sources = Array.isArray(data) ? data.filter((s) => s.web_url) : [];
    wmCache[key] = sources;
    return sources;
  } catch (e) {
    // Don't poison cache on failure — let the next run retry. Returning [] keeps
    // movies.json valid even if Watchmode is down on enrichment day.
    console.log(`    watchmode failed for tmdb:${tmdbId}: ${e.message}`);
    return [];
  }
};

const buildEntry = (movie, tmdb, wmSources) => {
  const region = pickWatchRegion(tmdb['watch/providers']?.results);
  const subs = region ? [...(region.flatrate || []), ...(region.free || []), ...(region.ads || [])] : [];
  const list = subs.length ? subs : (region ? [...(region.rent || []), ...(region.buy || [])] : []);
  const tmdbProviders = dedupeProviders(list);
  const providers = mergeWatchmodeIntoProviders(tmdbProviders, wmSources, WATCHMODE_TYPE_PRIORITY);

  const director = movie.type === 'show'
    ? (tmdb.created_by?.[0]?.name || null)
    : (tmdb.credits?.crew?.find((c) => c.job === 'Director')?.name || null);
  const cast = (tmdb.credits?.cast || []).slice(0, 5).map((c) => c.name);
  const runtime = movie.type === 'show'
    ? (tmdb.episode_run_time?.[0] || null)
    : (tmdb.runtime || null);
  const genres = (tmdb.genres || []).map((g) => g.name);
  const score = typeof tmdb.vote_average === 'number' && tmdb.vote_average > 0
    ? Math.round(tmdb.vote_average * 10)
    : null;
  const photos = (tmdb.images?.backdrops || [])
    .slice(0, 8)
    .map((b) => `https://image.tmdb.org/t/p/w780${b.file_path}`);

  return { providers, director, cast, runtime, genres, score, photos };
};

const main = async () => {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf-8'));
  let enriched = 0, skipped = 0, failed = 0;
  for (let i = 0; i < data.length; i++) {
    const m = data[i];
    if (m.type === 'game' || !m.tmdbId) { skipped++; continue; }
    try {
      const tmdb = await fetchTmdb(m.type, m.tmdbId);
      const wm = await fetchWatchmode(m.type, m.tmdbId);
      const fields = buildEntry(m, tmdb, wm);
      Object.assign(m, fields);
      enriched++;
      if (enriched % 25 === 0) {
        flush();
        fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
        console.log(`  flushed @ ${enriched}`);
      }
      await sleep(50);
    } catch (e) {
      failed++;
      console.log(`  FAIL ${m.title}: ${e.message}`);
    }
  }
  flush();
  fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
  console.log(`Done. enriched=${enriched} skipped=${skipped} failed=${failed}`);
};

main().catch((e) => { console.error(e); process.exit(1); });
