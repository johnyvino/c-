// Add one or more games to src/data/movies.json by RAWG URL or slug.
//
// Usage:
//   node scripts/add-rawg.mjs <url-or-slug> [<url-or-slug> ...]
//
// Examples:
//   node scripts/add-rawg.mjs https://rawg.io/games/inside
//   node scripts/add-rawg.mjs inside monument-valley call-of-duty-3
//
// Idempotent — re-running with an existing slug skips it. Downloads the cover
// to public/posters/<slug>.jpg. Pulls platforms, stores, screenshots, videos,
// developers, publishers, ESRB, metacritic the same way the bulk sync script
// does, so the new entries are immediately rich.

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MOVIES_JSON = path.join(ROOT, 'src', 'data', 'movies.json');
const POSTERS_DIR = path.join(ROOT, 'public', 'posters');
fs.mkdirSync(POSTERS_DIR, { recursive: true });

const RAWG_KEY = process.env.VITE_RAWG_API_KEY || process.env.RAWG_API_KEY;
if (!RAWG_KEY) { console.error('Set VITE_RAWG_API_KEY in .env.local'); process.exit(1); }
const BASE = 'https://api.rawg.io/api';
const UA = 'JohnvinosFavorites/1.0 (add-rawg)';

// Same RAWG CDN resize transform used by rebuild-games-from-rawg.mjs — keeps
// poster downloads and screenshot URLs at sensible dimensions.
const rawgResize = (url, width) => {
  if (!url || !url.includes('media.rawg.io/media/')) return url;
  if (url.includes('/media/resize/') || url.includes('/media/crop/')) return url;
  return url.replace('/media/', `/media/resize/${width}/-/`);
};

// RAWG canonical store-id map. Fallback for /games/{id}/stores rows whose
// store_id isn't in the game detail's `stores` array (RAWG endpoints aren't
// perfectly consistent — without this, Black Myth: Wukong loses its PS5 entry).
const RAWG_STORE_FALLBACK = {
  1:  { slug: 'steam',             name: 'Steam',                domain: 'store.steampowered.com' },
  2:  { slug: 'xbox-store',        name: 'Xbox Store',           domain: 'microsoft.com' },
  3:  { slug: 'playstation-store', name: 'PlayStation Store',    domain: 'store.playstation.com' },
  4:  { slug: 'apple-appstore',    name: 'App Store',            domain: 'apps.apple.com' },
  5:  { slug: 'gog',               name: 'GOG',                  domain: 'gog.com' },
  6:  { slug: 'nintendo',          name: 'Nintendo Store',       domain: 'nintendo.com' },
  7:  { slug: 'xbox360',           name: 'Xbox 360 Store',       domain: 'marketplace.xbox.com' },
  8:  { slug: 'google-play',       name: 'Google Play',          domain: 'play.google.com' },
  9:  { slug: 'itch',              name: 'itch.io',              domain: 'itch.io' },
  11: { slug: 'epic-games',        name: 'Epic Games Store',     domain: 'epicgames.com' },
};

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node scripts/add-rawg.mjs <url-or-slug> [<url-or-slug> ...]');
  process.exit(1);
}

// Accept any of: full URL, /games/slug, or bare slug.
const slugFromArg = (a) => {
  const m = a.match(/rawg\.io\/games\/([^/?#]+)/);
  if (m) return m[1];
  return a.replace(/^\/?games\//, '').trim();
};

const httpsGetJson = (url, attempt = 1) =>
  new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpsGetJson(res.headers.location, attempt).then(resolve, reject);
      }
      if (res.statusCode === 429 && attempt < 5) {
        res.resume();
        const wait = 1000 * Math.pow(2, attempt);
        return setTimeout(() => httpsGetJson(url, attempt + 1).then(resolve, reject), wait);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });

const downloadTo = (url, filepath, attempt = 1) =>
  new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA }, timeout: 20000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadTo(res.headers.location, filepath, attempt).then(resolve, reject);
      }
      if (res.statusCode === 429 && attempt < 5) {
        res.resume();
        const wait = 1000 * Math.pow(2, attempt);
        return setTimeout(() => downloadTo(url, filepath, attempt + 1).then(resolve, reject), wait);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} ${url}`));
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
      ws.on('error', (e) => { fs.unlink(tmp, () => reject(e)); });
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('timeout')); });
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchDetail = async (slug) => {
  const url = new URL(`${BASE}/games/${slug}`);
  url.searchParams.set('key', RAWG_KEY);
  return httpsGetJson(url.toString());
};

const fetchSub = async (id, suffix) => {
  try {
    const url = new URL(`${BASE}/games/${id}/${suffix}`);
    url.searchParams.set('key', RAWG_KEY);
    const json = await httpsGetJson(url.toString());
    return json.results || [];
  } catch { return []; }
};

const buildEntry = (detail, storeRows, movieRows, screenshotRows, localSlug) => {
  const year = detail.released ? parseInt(detail.released.slice(0, 4), 10) : null;
  const platforms = (detail.parent_platforms || []).map((p) => ({
    slug: p.platform.slug,
    name: p.platform.name,
  }));
  const storeMeta = new Map((detail.stores || []).map((s) => [s.store.id, s.store]));
  const stores = storeRows
    .map((row) => {
      const meta = storeMeta.get(row.store_id) || RAWG_STORE_FALLBACK[row.store_id];
      if (!meta) return null;
      return { slug: meta.slug, name: meta.name, domain: meta.domain || null, url: row.url };
    })
    .filter(Boolean);
  const screenshots = screenshotRows
    .map((s) => rawgResize(s.image, 1280))
    .filter((img) => img && img !== detail.background_image);
  const videos = movieRows.map((m) => ({
    name: m.name,
    preview: m.preview || null,
    low: m.data?.['480'] || null,
    high: m.data?.max || null,
  })).filter((v) => v.low || v.high);

  return {
    id: `game-${localSlug}`,
    slug: localSlug,
    title: detail.name,
    originalTitle: detail.name,
    year,
    type: 'game',
    poster: `/posters/${localSlug}.jpg`,
    genres: (detail.genres || []).map((g) => g.name),
    language: null,
    runtime: null,
    seasons: null,
    episodes: null,
    overview: detail.description_raw || null,
    detailsUrl: `https://rawg.io/games/${detail.slug}`,
    website: detail.website || null,
    popularity: detail.added || 0,
    rawgId: detail.id,
    rawgSlug: detail.slug,
    platforms,
    stores,
    screenshots,
    videos,
    developers: (detail.developers || []).map((d) => d.name),
    publishers: (detail.publishers || []).map((p) => p.name),
    esrbRating: detail.esrb_rating ? { name: detail.esrb_rating.name, slug: detail.esrb_rating.slug } : null,
    metacritic: typeof detail.metacritic === 'number' ? detail.metacritic : null,
    playtime: typeof detail.playtime === 'number' && detail.playtime > 0 ? detail.playtime : null,
    ratings: { tmdb: null, voteCount: detail.ratings_count || 0, personal: null },
    tmdbId: null,
    twist: false, scary: false, intense: false, mindbending: false, clever: false,
  };
};

const main = async () => {
  const data = JSON.parse(fs.readFileSync(MOVIES_JSON, 'utf-8'));
  const slugs = args.map(slugFromArg);
  console.log(`Adding ${slugs.length} game(s)...`);

  let added = 0, skipped = 0, failed = 0;

  for (const slug of slugs) {
    const localId = `game-${slug}`;
    if (data.some((m) => m.id === localId)) {
      console.log(`  skip   ${slug} (already in movies.json)`);
      skipped++;
      continue;
    }
    let detail;
    try {
      detail = await fetchDetail(slug);
      if (!detail || !detail.name) throw new Error('detail missing name');
    } catch (e) {
      console.log(`  FAIL   ${slug}  (${e.message || e.code || String(e)})`);
      failed++;
      await sleep(400);
      continue;
    }
    const [storeRows, movieRows, screenshotRows] = await Promise.all([
      fetchSub(detail.id, 'stores'),
      fetchSub(detail.id, 'movies'),
      fetchSub(detail.id, 'screenshots'),
    ]);
    const entry = buildEntry(detail, storeRows, movieRows, screenshotRows, slug);

    const out = path.join(POSTERS_DIR, `${slug}.jpg`);
    if (detail.background_image) {
      try {
        if (fs.existsSync(out)) fs.unlinkSync(out);
        await downloadTo(rawgResize(detail.background_image, 640), out);
      } catch (e) {
        entry.poster = null;
        console.log(`  poster FAIL ${slug}: ${e.message}`);
      }
    } else {
      entry.poster = null;
    }
    data.push(entry);
    added++;
    const extras = [
      entry.platforms.length ? `${entry.platforms.length}p` : '',
      entry.stores.length ? `${entry.stores.length}st` : '',
      entry.screenshots.length ? `${entry.screenshots.length}sh` : '',
      entry.videos.length ? `${entry.videos.length}v` : '',
    ].filter(Boolean).join(' ');
    console.log(`  ok     ${slug}  (${detail.name})${extras ? `   [${extras}]` : ''}`);
    await sleep(800);
  }

  if (added > 0) {
    fs.writeFileSync(MOVIES_JSON, JSON.stringify(data, null, 2) + '\n');
  }
  console.log();
  console.log(`Done. added=${added}  skipped=${skipped}  failed=${failed}`);
};

main().catch((e) => { console.error(e); process.exit(1); });
