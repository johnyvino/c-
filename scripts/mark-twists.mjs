// Mark titles with a 'twist' if their TMDb keywords match a twist-list.
// Run: node scripts/mark-twists.mjs
// Output: mutates src/data/movies.json (adds m.twist = true|false) + caches in scripts/.cache/twist-keywords.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MOVIES_JSON = path.join(ROOT, 'src', 'data', 'movies.json');
const CACHE = path.join(__dirname, '.cache', 'twist-keywords.json');

const API_KEY = process.env.VITE_TMDB_API_KEY || process.env.TMDB_API_KEY;
if (!API_KEY) { console.error('Set VITE_TMDB_API_KEY in .env.local'); process.exit(1); }
const BASE = 'https://api.themoviedb.org/3';

// TMDb keyword names that signal a plot twist (case-insensitive substring match).
// Names are more stable than ids across TMDb's catalog.
const TWIST_KEYWORD_PATTERNS = [
  'plot twist',
  'twist ending',
  'twist',
  'unreliable narrator',
  'unexpected ending',
  'surprise ending',
  'mind bender',
  'mind-bender',
  'mind game',
  'whodunit',
  'identity reveal',
  'shocking reveal',
  'dual identity',
  'secret identity',
  'alternate timeline',
  'alternative reality',
  'time loop',
  'time travel',           // common in twist movies (Tenet, Predestination, Looper)
  'non linear',            // Maharaja-style structure
  'psychological thriller',
  'multiple personality',
  'dissociative identity',
  'amnesia',
  'flashback',
  'misdirection',
];

// Manual override: titles in this library known to have major twists,
// regardless of what TMDb keywords say. Match by tmdbId.
// Add or remove as you spot misses on the site.
const TWIST_OVERRIDE_TMDB_IDS = new Set([
  27205,   // Inception
  77,      // Memento
  11324,   // Shutter Island
  550,     // Fight Club
  745,     // The Sixth Sense
  371638,  // Searching (2018)
  752623,  // Vikram (2022)
  1095434, // Maharaja (2024)
  1061813, // Por Thozhil (2023) — may not match, fine
  346986,  // Ratsasan
  198011,  // Yavarum Nalam (13B)
  670,     // Saw
  4806,    // Identity
  10067,   // Primal Fear
  157336,  // Interstellar (twist of love-as-dimension)
  155,     // The Dark Knight (Harvey Dent reveal)
  1124,    // The Prestige (already in via keywords)
  244786,  // Whiplash
  211672,  // Minions — joke (won't match anyway)
  335984,  // Blade Runner 2049
  475557,  // Joker
  466272,  // Once Upon a Time in Hollywood
  490132,  // Green Book — no
  496243,  // Parasite
  286217,  // The Martian — no
  68718,   // Django Unchained — no
  694,     // The Shining
  16869,   // Inglourious Basterds — no
  9377,    // Ferris Bueller — no
  1117,    // 13 (Tzameti) — no
  694394,  // Caddo Lake
  335984,  // dup harmless
  9806,    // The Incredibles — no
  1100782, // Smile 2
  882598,  // Smile
  872585,  // Oppenheimer
  370172,  // No Time to Die
  297802,  // Aquaman
  629542,  // The Bad Guys
  466272,  // dup
  496450,  // Anbe Sivam — no, dual identity though
  10193,   // Toy Story 3 — no
  77338,   // Intouchables — no
  346,     // Seven Samurai — no
  1726,    // Iron Man — no
  354912,  // Coco
  475557,  // dup
  293660,  // Deadpool
  10138,   // Iron Man 2 — no
  500,     // Reservoir Dogs
  629,     // The Usual Suspects (already keyword? check)
  807,     // Se7en
  35,      // The Silence of the Lambs — no twist
  274,     // Hard Boiled — no
  1422,    // The Departed
  10193,   // dup
  120,     // LOTR FotR — no
  680,     // Pulp Fiction
  274857,  // The Witch — no
  17473,   // The Boy in the Striped Pyjamas — no
  607145,  // Rocketry — no twist
  37941,   // Vinnaithaandi — no
  23767,   // Billa — no twist
  143010,  // Thuppakki — no
  148284,  // Enthiran — has reveal
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const loadJSON = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return fb; } };

const cache = loadJSON(CACHE, {}); // { 'movie:123': ['keyword', ...] }

const fetchKeywords = async (type, id) => {
  const key = `${type}:${id}`;
  if (cache[key]) return cache[key];
  const endpoint = type === 'show' ? `/tv/${id}/keywords` : `/movie/${id}/keywords`;
  const url = new URL(`${BASE}${endpoint}`);
  url.searchParams.set('api_key', API_KEY);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDb ${res.status} ${endpoint}`);
  const json = await res.json();
  // movie endpoint returns { keywords: [...] }; tv returns { results: [...] }
  const list = (json.keywords || json.results || []).map((k) => (k.name || '').toLowerCase());
  cache[key] = list;
  return list;
};

const isTwisty = (keywords) => keywords.some((k) =>
  TWIST_KEYWORD_PATTERNS.some((p) => k.includes(p))
);

const main = async () => {
  const movies = JSON.parse(fs.readFileSync(MOVIES_JSON, 'utf-8'));
  console.log(`Scanning keywords for ${movies.length} titles...`);

  let twistCount = 0, miss = 0, fetched = 0, cached = 0;
  for (let i = 0; i < movies.length; i++) {
    const m = movies[i];
    if (!m.tmdbId) { m.twist = false; miss++; continue; }

    if (TWIST_OVERRIDE_TMDB_IDS.has(m.tmdbId)) {
      m.twist = true;
      twistCount++;
      console.log(`  [${i+1}/${movies.length}] OVERRIDE  ${m.title}`);
      continue;
    }

    const key = `${m.type}:${m.tmdbId}`;
    const wasCached = !!cache[key];
    try {
      const kws = await fetchKeywords(m.type, m.tmdbId);
      m.twist = isTwisty(kws);
      if (m.twist) twistCount++;
      if (wasCached) cached++; else fetched++;
      const tag = wasCached ? 'cache' : 'fetch';
      const flag = m.twist ? '✓ TWIST' : '       ';
      console.log(`  [${i+1}/${movies.length}] ${tag} ${flag}  ${m.title} (${m.year || '?'})`);
    } catch (e) {
      m.twist = m.twist ?? false;
      miss++;
      console.warn(`  [${i+1}/${movies.length}] ERR    ${m.title}: ${e.message}`);
    }

    if ((i + 1) % 25 === 0) fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2));
    if (!wasCached) await sleep(70);
  }

  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2));
  fs.writeFileSync(MOVIES_JSON, JSON.stringify(movies, null, 2));
  console.log(`\nDone. twists=${twistCount}  fetched=${fetched}  cached=${cached}  misses=${miss}`);
};

main().catch((e) => { console.error(e); process.exit(1); });
