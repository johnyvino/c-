// Enrich each raw item with TMDb metadata.
// Input:  scripts/.cache/01-raw.json
// Output: scripts/.cache/02-enriched.json
// Cache:  scripts/.cache/tmdb.json (keyed by `${type}:${slug}` → tmdb response)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IN = path.join(__dirname, '.cache', '01-raw.json');
const OUT = path.join(__dirname, '.cache', '02-enriched.json');
const CACHE = path.join(__dirname, '.cache', 'tmdb.json');
const GENRES_CACHE = path.join(__dirname, '.cache', 'tmdb-genres.json');

const API_KEY = process.env.VITE_TMDB_API_KEY || process.env.TMDB_API_KEY;
if (!API_KEY) { console.error('Set VITE_TMDB_API_KEY in .env.local'); process.exit(1); }
const BASE = 'https://api.themoviedb.org/3';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const loadJSON = (p, fallback) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return fallback; }
};

const cache = loadJSON(CACHE, {});
let genresMap = loadJSON(GENRES_CACHE, null);

const tmdb = async (urlPath, params = {}) => {
  const url = new URL(`${BASE}${urlPath}`);
  url.searchParams.set('api_key', API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDb ${res.status} ${urlPath}: ${await res.text()}`);
  return res.json();
};

const loadGenres = async () => {
  if (genresMap) return genresMap;
  const [movieG, tvG] = await Promise.all([
    tmdb('/genre/movie/list'),
    tmdb('/genre/tv/list'),
  ]);
  genresMap = {
    movie: Object.fromEntries(movieG.genres.map((g) => [g.id, g.name])),
    tv: Object.fromEntries(tvG.genres.map((g) => [g.id, g.name])),
  };
  fs.writeFileSync(GENRES_CACHE, JSON.stringify(genresMap, null, 2));
  return genresMap;
};

const search = async (type, title, year) => {
  // type 'movie' → /search/movie; 'show' → /search/tv
  const endpoint = type === 'show' ? '/search/tv' : '/search/movie';
  const params = { query: title, include_adult: 'false' };
  if (year) {
    params[type === 'show' ? 'first_air_date_year' : 'year'] = String(year);
  }
  const result = await tmdb(endpoint, params);
  return result.results || [];
};

const fetchDetails = async (type, id) => {
  const endpoint = type === 'show' ? `/tv/${id}` : `/movie/${id}`;
  return tmdb(endpoint, { append_to_response: 'external_ids' });
};

const enrichOne = async (item, genres) => {
  const key = `${item.type}:${item.slug}`;
  if (cache[key]) return cache[key];

  // Try with year first, then without
  let candidates = await search(item.type, item.title, item.year);
  if (candidates.length === 0 && item.year) {
    candidates = await search(item.type, item.title, null);
  }
  if (candidates.length === 0) {
    cache[key] = { __miss: true };
    return cache[key];
  }

  // Pick best: exact year match preferred, then by popularity
  const dateKey = item.type === 'show' ? 'first_air_date' : 'release_date';
  const pickYear = (c) => {
    const d = c[dateKey];
    return d ? parseInt(d.slice(0, 4), 10) : null;
  };
  let best;
  if (item.year) {
    best = candidates.find((c) => pickYear(c) === item.year)
        || candidates.find((c) => Math.abs((pickYear(c) ?? 0) - item.year) <= 1)
        || candidates[0];
  } else {
    best = candidates[0];
  }

  let details = null;
  try {
    details = await fetchDetails(item.type, best.id);
  } catch (e) {
    console.warn(`  details failed for ${item.title}: ${e.message}`);
  }

  const genreNames = (best.genre_ids || []).map((id) => {
    const map = item.type === 'show' ? genres.tv : genres.movie;
    return map[id];
  }).filter(Boolean);

  const enriched = {
    tmdbId: best.id,
    title: best.title || best.name,
    originalTitle: best.original_title || best.original_name,
    year: pickYear(best),
    overview: best.overview || '',
    posterPath: best.poster_path || null,
    backdropPath: best.backdrop_path || null,
    language: best.original_language || null,
    popularity: best.popularity || 0,
    tmdbRating: best.vote_average ?? null,
    voteCount: best.vote_count || 0,
    genres: details?.genres?.map((g) => g.name) || genreNames,
    runtime: details?.runtime ?? null,
    seasons: details?.number_of_seasons ?? null,
    episodes: details?.number_of_episodes ?? null,
    imdbId: details?.external_ids?.imdb_id || details?.imdb_id || null,
    status: details?.status || null,
  };
  cache[key] = enriched;
  // Save cache periodically inside main loop
  return enriched;
};

const main = async () => {
  const raw = loadJSON(IN, []);
  console.log(`Enriching ${raw.length} titles...`);
  const genres = await loadGenres();

  const out = [];
  let hits = 0, misses = 0, cached = 0;
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    const key = `${item.type}:${item.slug}`;
    const wasCached = !!cache[key];
    let enriched;
    try {
      enriched = await enrichOne(item, genres);
    } catch (e) {
      console.warn(`  ERR ${item.title} (${item.year}): ${e.message}`);
      enriched = { __miss: true };
    }
    if (wasCached) cached++;
    if (enriched.__miss) {
      misses++;
      out.push({ ...item, tmdb: null });
      console.log(`  [${i + 1}/${raw.length}] MISS  ${item.title} (${item.year || '?'})`);
    } else {
      hits++;
      out.push({ ...item, tmdb: enriched });
      const tag = wasCached ? 'cache' : 'fetch';
      console.log(`  [${i + 1}/${raw.length}] ${tag} ${item.title} (${item.year || '?'}) → ${enriched.title} (${enriched.year || '?'})`);
    }

    // Persist cache every 25 calls
    if ((i + 1) % 25 === 0) {
      fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2));
    }
    // Gentle rate limit only when actually fetching
    if (!wasCached) await sleep(80);
  }
  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2));
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

  console.log(`\nDone. hits=${hits}  misses=${misses}  cached=${cached}`);
  console.log(`Wrote ${OUT}`);
};

main().catch((e) => { console.error(e); process.exit(1); });
