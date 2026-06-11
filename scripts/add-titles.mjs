// Batch-add titles by TMDb id, url, or name.
// Usage:
//   node scripts/add-titles.mjs
//
// Edit the TITLES list below to add what you want. Each entry is either:
//   { url: '...' }                  — explicit TMDb url, e.g. /movie/123 or /tv/456
//   { name: 'X', type: 'movie' }    — name search restricted to movies
//   { name: 'X', type: 'show' }     — name search restricted to TV
//   { name: 'X', type: 'movie', year: 2009 }  — narrows search by year
//
// What it does per entry:
//   1) Resolves the title (search by name, or use the url directly)
//   2) Fetches TMDb details
//   3) Downloads w780 poster into public/posters/<slug>.jpg
//   4) Inserts/updates src/data/movies.json (matched by tmdbId)

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MOVIES_JSON = path.join(ROOT, 'src', 'data', 'movies.json');
const POSTERS_DIR = path.join(ROOT, 'public', 'posters');

const API_KEY = process.env.VITE_TMDB_API_KEY || process.env.TMDB_API_KEY;
if (!API_KEY) { console.error('Set VITE_TMDB_API_KEY in .env.local'); process.exit(1); }
const BASE = 'https://api.themoviedb.org/3';

// EDIT THIS LIST
const TITLES = [
  // Movies — name lookups
  { name: "Harry Potter and the Sorcerer's Stone", type: 'movie', year: 2001 },
  { name: 'Deep Blue Sea', type: 'movie', year: 1999 },
  { name: 'The Mummy', type: 'movie', year: 1999 },
  { name: 'The Mummy Returns', type: 'movie', year: 2001 },
  { name: 'The Chronicles of Narnia: The Voyage of the Dawn Treader', type: 'movie', year: 2010 },
  { name: 'Fast & Furious', type: 'movie', year: 2009 },
  { name: 'Speed', type: 'movie', year: 1994 },
  { name: 'Kung Fu Panda', type: 'movie', year: 2008 },
  { name: "Ocean's Eleven", type: 'movie', year: 2001 },
  // Shows — explicit TMDb urls
  { url: 'https://www.themoviedb.org/tv/20993-galactik-football' },
  { url: 'https://www.themoviedb.org/tv/2826-dragon-booster' },
  { url: 'https://www.themoviedb.org/tv/4429-timon-pumbaa' },
  // Power Rangers — TMDb has it under /movie/...
  { url: 'https://www.themoviedb.org/movie/1096236-power-rangers-dino-thunder-white-thunder' },
];

const LANG_NAMES = {
  en: 'English', ta: 'Tamil', hi: 'Hindi', te: 'Telugu', ml: 'Malayalam',
  kn: 'Kannada', ko: 'Korean', ja: 'Japanese', zh: 'Chinese', cn: 'Chinese',
  fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese',
  ru: 'Russian', tr: 'Turkish', ar: 'Arabic', th: 'Thai', vi: 'Vietnamese',
};

const slugify = (s) =>
  s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tmdb = async (urlPath, params = {}) => {
  const url = new URL(`${BASE}${urlPath}`);
  url.searchParams.set('api_key', API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDb ${res.status} ${urlPath}: ${await res.text()}`);
  return res.json();
};

const downloadPoster = (url, filepath) =>
  new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadPoster(res.headers.location, filepath).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const tmp = `${filepath}.tmp`;
      const ws = fs.createWriteStream(tmp);
      res.pipe(ws);
      ws.on('finish', () => {
        ws.close(() => {
          const stat = fs.statSync(tmp);
          if (stat.size < 1024) {
            fs.unlinkSync(tmp);
            return reject(new Error(`too small (${stat.size}B)`));
          }
          fs.renameSync(tmp, filepath);
          resolve();
        });
      });
      ws.on('error', (err) => fs.unlink(tmp, () => reject(err)));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });

const parseUrl = (s) => {
  const m = s.match(/(movie|tv)\/(\d+)/);
  if (!m) throw new Error(`Cannot parse url "${s}"`);
  return { tmdbType: m[1], id: m[2] };
};

const searchByName = async (name, type, year) => {
  const endpoint = type === 'show' ? '/search/tv' : '/search/movie';
  const params = { query: name };
  if (year && type === 'movie') params.year = year;
  if (year && type === 'show') params.first_air_date_year = year;
  const data = await tmdb(endpoint, params);
  if (!data.results || data.results.length === 0) {
    throw new Error(`no TMDb result for "${name}"${year ? ` (${year})` : ''}`);
  }
  return { tmdbType: type === 'show' ? 'tv' : 'movie', id: String(data.results[0].id) };
};

const upsertOne = async (entry) => {
  let ref;
  if (entry.url) {
    ref = parseUrl(entry.url);
  } else if (entry.name) {
    ref = await searchByName(entry.name, entry.type || 'movie', entry.year);
  } else {
    throw new Error(`entry needs url or name: ${JSON.stringify(entry)}`);
  }
  const { tmdbType, id } = ref;
  const ourType = tmdbType === 'tv' ? 'show' : 'movie';

  const details = await tmdb(`/${tmdbType}/${id}`, { append_to_response: 'external_ids' });
  const title = details.title || details.name;
  const dateField = tmdbType === 'tv' ? 'first_air_date' : 'release_date';
  const year = details[dateField] ? parseInt(details[dateField].slice(0, 4), 10) : null;
  const slug = slugify(`${title}-${year ?? ''}`);

  fs.mkdirSync(POSTERS_DIR, { recursive: true });
  const filename = `${slug}.jpg`;
  const filepath = path.join(POSTERS_DIR, filename);
  let posterOk = false;
  if (details.poster_path) {
    if (fs.existsSync(filepath) && fs.statSync(filepath).size >= 1024) {
      posterOk = true;
    } else {
      try {
        await downloadPoster(`https://image.tmdb.org/t/p/w780${details.poster_path}`, filepath);
        posterOk = true;
      } catch (e) {
        console.log(`    poster download failed: ${e.message}`);
      }
    }
  }

  return {
    id: `${ourType}-${slug}`,
    slug,
    title,
    originalTitle: details.original_title || details.original_name || null,
    year,
    type: ourType,
    poster: posterOk ? `/posters/${filename}` : null,
    genres: details.genres?.map((g) => g.name) || [],
    language: details.original_language ? (LANG_NAMES[details.original_language] || details.original_language.toUpperCase()) : null,
    languageCode: details.original_language || null,
    runtime: details.runtime ?? null,
    seasons: details.number_of_seasons ?? null,
    episodes: details.number_of_episodes ?? null,
    overview: details.overview || '',
    ratings: {
      tmdb: details.vote_average != null ? Number(details.vote_average.toFixed(1)) : null,
      voteCount: details.vote_count || 0,
      personal: null,
    },
    popularity: details.popularity || 0,
    tmdbId: details.id,
    twist: false,
    scary: false,
    intense: false,
    mindbending: false,
    clever: false,
  };
};

const main = async () => {
  const movies = JSON.parse(fs.readFileSync(MOVIES_JSON, 'utf-8'));
  const byTmdbId = new Map(movies.filter((m) => m.tmdbId).map((m) => [m.tmdbId, m]));

  let added = 0, updated = 0, failed = 0;
  for (const entry of TITLES) {
    const label = entry.url || `${entry.name} (${entry.year || '?'})`;
    try {
      const rec = await upsertOne(entry);
      if (byTmdbId.has(rec.tmdbId)) {
        const idx = movies.findIndex((m) => m.tmdbId === rec.tmdbId);
        movies[idx] = { ...movies[idx], ...rec };
        updated++;
        console.log(`  upd  ${rec.title} (${rec.year}) [${rec.type}]`);
      } else {
        movies.push(rec);
        byTmdbId.set(rec.tmdbId, rec);
        added++;
        console.log(`  add  ${rec.title} (${rec.year}) [${rec.type}]`);
      }
    } catch (e) {
      failed++;
      console.log(`  FAIL ${label}: ${e.message}`);
    }
    await sleep(120);
  }

  fs.writeFileSync(MOVIES_JSON, JSON.stringify(movies, null, 2) + '\n');
  console.log(`\nDone. added=${added}  updated=${updated}  failed=${failed}`);
  console.log(`Total: ${movies.length} (movies=${movies.filter((m) => m.type === 'movie').length}, shows=${movies.filter((m) => m.type === 'show').length}, games=${movies.filter((m) => m.type === 'game').length})`);
};

main().catch((e) => { console.error(e); process.exit(1); });
