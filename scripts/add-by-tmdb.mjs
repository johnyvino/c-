// Add a single title by TMDb id or url.
// Usage:
//   node scripts/add-by-tmdb.mjs https://www.themoviedb.org/tv/72548
//   node scripts/add-by-tmdb.mjs tv/72548
//   node scripts/add-by-tmdb.mjs movie/27205
//
// What it does:
//   1) Fetches TMDb details (+external_ids)
//   2) Downloads w780 poster into public/posters/<slug>.jpg
//   3) Inserts into src/data/movies.json (replacing any existing by tmdbId)
//   4) Refreshes src/data/filters.json facets
//
// Idempotent — re-running with the same id updates that entry only.

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MOVIES_JSON = path.join(ROOT, 'src', 'data', 'movies.json');
const FILTERS_JSON = path.join(ROOT, 'src', 'data', 'filters.json');
const POSTERS_DIR = path.join(ROOT, 'public', 'posters');

const API_KEY = process.env.VITE_TMDB_API_KEY || process.env.TMDB_API_KEY;
if (!API_KEY) { console.error('Set VITE_TMDB_API_KEY in .env.local'); process.exit(1); }
const BASE = 'https://api.themoviedb.org/3';

const LANG_NAMES = {
  en: 'English', ta: 'Tamil', hi: 'Hindi', te: 'Telugu', ml: 'Malayalam',
  kn: 'Kannada', ko: 'Korean', ja: 'Japanese', zh: 'Chinese', cn: 'Chinese',
  fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese',
  ru: 'Russian', tr: 'Turkish', ar: 'Arabic', th: 'Thai', vi: 'Vietnamese',
};

const slugify = (s) =>
  s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const parseArg = (arg) => {
  // Accept: full url, "tv/123", "movie/123"
  const m = arg.match(/(movie|tv)\/(\d+)/);
  if (!m) throw new Error(`Cannot parse "${arg}". Expected url or tv/<id> or movie/<id>.`);
  return { tmdbType: m[1], id: m[2] };
};

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

const yearBucket = (year) => {
  if (!year) return 'Unknown';
  if (year >= 2020) return '2020s';
  if (year >= 2010) return '2010s';
  if (year >= 2000) return '2000s';
  if (year >= 1990) return '1990s';
  return 'Older';
};

const main = async () => {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/add-by-tmdb.mjs <tmdb url or tv/id or movie/id>');
    process.exit(1);
  }
  const { tmdbType, id } = parseArg(arg);
  const ourType = tmdbType === 'tv' ? 'show' : 'movie';
  console.log(`Fetching ${tmdbType}/${id}...`);

  const endpoint = tmdbType === 'tv' ? `/tv/${id}` : `/movie/${id}`;
  const details = await tmdb(endpoint, { append_to_response: 'external_ids' });

  const title = details.title || details.name;
  const dateField = tmdbType === 'tv' ? 'first_air_date' : 'release_date';
  const year = details[dateField] ? parseInt(details[dateField].slice(0, 4), 10) : null;
  const slug = slugify(`${title}-${year ?? ''}`);

  // Download poster
  fs.mkdirSync(POSTERS_DIR, { recursive: true });
  const filename = `${slug}.jpg`;
  const filepath = path.join(POSTERS_DIR, filename);
  if (details.poster_path) {
    if (fs.existsSync(filepath) && fs.statSync(filepath).size >= 1024) {
      console.log(`  poster already cached`);
    } else {
      console.log(`  downloading poster...`);
      await downloadPoster(`https://image.tmdb.org/t/p/w780${details.poster_path}`, filepath);
    }
  } else {
    console.log(`  no poster on TMDb`);
  }

  const entry = {
    id: `${ourType}-${slug}`,
    slug,
    title,
    originalTitle: details.original_title || details.original_name || null,
    year,
    type: ourType,
    poster: details.poster_path ? `/posters/${filename}` : null,
    posterSource: details.poster_path ? 'tmdb-w780' : null,
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
    imdbId: details.external_ids?.imdb_id || details.imdb_id || null,
    sources: ['manual'],
    sourceUrl: `https://www.themoviedb.org/${tmdbType}/${details.id}`,
  };

  // Merge into movies.json — replace if same tmdbId, else append
  const movies = JSON.parse(fs.readFileSync(MOVIES_JSON, 'utf-8'));
  const existingIdx = movies.findIndex((m) => m.tmdbId === entry.tmdbId);
  if (existingIdx >= 0) {
    movies[existingIdx] = { ...movies[existingIdx], ...entry };
    console.log(`  updated existing: ${title}`);
  } else {
    movies.push(entry);
    console.log(`  added: ${title} (${year || '?'})`);
  }
  // Resort by popularity desc to keep file consistent
  movies.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  fs.writeFileSync(MOVIES_JSON, JSON.stringify(movies, null, 2));

  // Refresh filters.json facets only if the file exists. Earlier versions of
  // the project derived facets from a separate filters.json; the runtime now
  // computes them on the fly from movies.json, so this is best-effort.
  if (fs.existsSync(FILTERS_JSON)) {
    const genreSet = new Set();
    const yearSet = new Set();
    const langSet = new Set();
    const sourceSet = new Set();
    for (const t of movies) {
      for (const g of (t.genres || [])) genreSet.add(g);
      yearSet.add(yearBucket(t.year));
      if (t.language) langSet.add(t.language);
      for (const s of (t.sources || [])) sourceSet.add(s);
    }
    const yearOrder = ['2020s', '2010s', '2000s', '1990s', 'Older', 'Unknown'];
    const existingFilters = JSON.parse(fs.readFileSync(FILTERS_JSON, 'utf-8'));
    const filters = {
      ...existingFilters,
      genres: [...genreSet].sort(),
      years: yearOrder.filter((y) => yearSet.has(y)),
      languages: [...langSet].sort(),
      sources: [...sourceSet].sort(),
    };
    fs.writeFileSync(FILTERS_JSON, JSON.stringify(filters, null, 2));
  }

  console.log(`\nDone. ${movies.length} total titles.`);
};

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
