// Rebuild every game entry in src/data/movies.json from RAWG.
// Replaces title/year/genres/overview/poster/detailsUrl with RAWG data,
// preserving personal fields (notes, ratings.personal, twist/scary/etc).
// Also downloads each game's cover into public/posters/<slug>.jpg so all
// posters live locally with the same path convention as the rest of the site.
//
// Usage:
//   node scripts/rebuild-games-from-rawg.mjs              # rebuild all games
//   node scripts/rebuild-games-from-rawg.mjs --dry-run    # preview only
//   node scripts/rebuild-games-from-rawg.mjs --only=super-mario-64,it-takes-two
//
// If a title doesn't match cleanly, add an entry to OVERRIDES below — value is
// either the RAWG slug ('hollow-knight') or numeric id (3272).
//
// Idempotent. Rerun freely. Existing rawgId on an entry skips the search step.

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
const UA = 'JohnvinosFavorites/1.0 (rebuild-from-rawg)';

// RAWG's CDN supports a `/media/resize/W/-/...` URL transform that returns
// the image scaled to W pixels wide. Without this we'd download original
// 3840×2160 backgrounds (~900KB each) for poster slots that render at ~240px
// CSS — stored URLs and disk files become huge and look soft after the
// browser's cubic downscale. Apply this on every RAWG image we surface.
const rawgResize = (url, width) => {
  if (!url || !url.includes('media.rawg.io/media/')) return url;
  if (url.includes('/media/resize/') || url.includes('/media/crop/')) return url;
  return url.replace('/media/', `/media/resize/${width}/-/`);
};

// RAWG's canonical store-id map. Used as a fallback when /games/{id}/stores
// returns a row whose store_id isn't in the game detail's `stores` array.
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

// Map our local slug → RAWG slug or numeric id, for cases where the search
// doesn't pick the right title. Add entries here when the script reports a
// failure or picks the wrong game. Numeric ids are most stable.
const OVERRIDES = {
  // The bare 'it-takes-two' slug is a 2018 itch.io puzzle game; the Hazelight
  // 2021 game is at '-2' on RAWG.
  'it-takes-two': 'it-takes-two-2',
  // Same '-2' canonical pattern.
  'assassins-creed-brotherhood': 'assassins-creed-brotherhood-2',
};

const FIELDS_TO_PRESERVE = ['ratings.personal', 'notes', 'posterVertical', 'twist', 'scary', 'intense', 'mindbending', 'clever'];

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean)) : null;

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

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const searchAndPick = async (game) => {
  const url = new URL(`${BASE}/games`);
  url.searchParams.set('key', RAWG_KEY);
  url.searchParams.set('search', game.title);
  url.searchParams.set('page_size', '8');
  const json = await httpsGetJson(url.toString());
  const results = json.results || [];
  if (!results.length) return null;

  const targetName = norm(game.title);
  const scored = results.map((r) => {
    const rYear = r.released ? parseInt(r.released.slice(0, 4), 10) : null;
    const yearDelta = (game.year && rYear) ? Math.abs(rYear - game.year) : 99;
    const exact = norm(r.name) === targetName ? 0 : (norm(r.name).startsWith(targetName) ? 1 : 2);
    return { r, score: exact * 100 + yearDelta };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored[0].r;
};

const fetchDetail = async (slugOrId) => {
  const url = new URL(`${BASE}/games/${slugOrId}`);
  url.searchParams.set('key', RAWG_KEY);
  return httpsGetJson(url.toString());
};

// Per-game store rows include the actual game store URL (e.g. Steam app
// page). Returns [{ store_id, url }]; empty array on 404 / unsupported.
const fetchStores = async (id) => {
  try {
    const url = new URL(`${BASE}/games/${id}/stores`);
    url.searchParams.set('key', RAWG_KEY);
    const json = await httpsGetJson(url.toString());
    return json.results || [];
  } catch { return []; }
};

// Per-game movie rows include preview image + mp4 URLs. Returns
// [{ id, name, preview, data: { 480, max } }].
const fetchMovies = async (id) => {
  try {
    const url = new URL(`${BASE}/games/${id}/movies`);
    url.searchParams.set('key', RAWG_KEY);
    const json = await httpsGetJson(url.toString());
    return json.results || [];
  } catch { return []; }
};

// Per-game screenshots. Returns [{ id, image, width, height }]. RAWG's detail
// endpoint doesn't reliably include short_screenshots, so we always hit this.
const fetchScreenshots = async (id) => {
  try {
    const url = new URL(`${BASE}/games/${id}/screenshots`);
    url.searchParams.set('key', RAWG_KEY);
    const json = await httpsGetJson(url.toString());
    return json.results || [];
  } catch { return []; }
};

const applyRawg = (game, detail, storeRows, movieRows, screenshotRows) => {
  const year = detail.released ? parseInt(detail.released.slice(0, 4), 10) : null;

  const platforms = (detail.parent_platforms || []).map((p) => ({
    slug: p.platform.slug,
    name: p.platform.name,
  }));

  // Merge per-game store URLs with the store metadata embedded in detail.stores.
  // RAWG's /games/{id}/stores endpoint sometimes returns store URLs whose
  // store_id isn't in detail.stores (the two endpoints aren't perfectly synced).
  // Fall back to the canonical RAWG store-id map so we don't silently drop real
  // listings (e.g., Black Myth: Wukong's PS5 entry).
  const storeMeta = new Map(
    (detail.stores || []).map((s) => [s.store.id, s.store])
  );
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

  const next = {
    ...game,
    title: detail.name,
    originalTitle: detail.name,
    year,
    genres: (detail.genres || []).map((g) => g.name),
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
    ratings: {
      ...(game.ratings || {}),
      tmdb: null,
      voteCount: detail.ratings_count || 0,
      // personal preserved by spread above
    },
    poster: `/posters/${game.slug}.jpg`,
  };
  // Re-assert preserved fields (in case they were undefined and spread overrode).
  for (const k of FIELDS_TO_PRESERVE) {
    if (k.includes('.')) continue;
    if (game[k] !== undefined) next[k] = game[k];
  }
  if (game.ratings && game.ratings.personal !== undefined) {
    next.ratings.personal = game.ratings.personal;
  }
  return next;
};

const main = async () => {
  const data = JSON.parse(fs.readFileSync(MOVIES_JSON, 'utf-8'));
  const games = data.filter((m) => m.type === 'game');
  const target = ONLY ? games.filter((g) => ONLY.has(g.slug)) : games;

  console.log(`${games.length} game(s) total · ${target.length} to process${DRY_RUN ? ' (dry run)' : ''}`);
  if (ONLY) console.log(`  filter: ${[...ONLY].join(', ')}`);
  console.log();

  let ok = 0, failed = 0, posterFailed = 0;
  const updates = []; // applied entries, indexed by id

  for (const game of target) {
    const idx = data.findIndex((m) => m.id === game.id);
    if (idx === -1) continue;

    let detail;
    try {
      const override = OVERRIDES[game.slug];
      if (override) {
        detail = await fetchDetail(override);
      } else if (game.rawgId) {
        detail = await fetchDetail(game.rawgId);
      } else {
        const hit = await searchAndPick(game);
        if (!hit) throw new Error('no search results');
        detail = await fetchDetail(hit.slug || hit.id);
      }
      if (!detail || !detail.name) {
        throw new Error('detail response missing name (likely a redirect to a stub) — try a different override');
      }
      // RAWG has user-submitted junk entries (e.g. id 274722 titled '.undefined'
      // with slug 'undefined-2') that the search will sometimes surface. Treat
      // any name/slug that's literally "undefined" or starts with "." as junk.
      const looksJunk =
        /^\.?undefined/i.test(detail.name) ||
        /^undefined(-\d+)?$/i.test(detail.slug || '');
      if (looksJunk) {
        throw new Error(`picked a junk RAWG entry (name="${detail.name}" slug="${detail.slug}") — add an override`);
      }
    } catch (e) {
      failed++;
      const msg = e.message || e.code || String(e);
      console.log(`  FAIL   ${game.slug}  (${msg})`);
      await sleep(400);
      continue;
    }

    const [storeRows, movieRows, screenshotRows] = await Promise.all([
      fetchStores(detail.id),
      fetchMovies(detail.id),
      fetchScreenshots(detail.id),
    ]);
    const next = applyRawg(game, detail, storeRows, movieRows, screenshotRows);

    // Poster.
    const out = path.join(POSTERS_DIR, `${game.slug}.jpg`);
    if (detail.background_image) {
      try {
        if (!DRY_RUN) {
          if (fs.existsSync(out)) fs.unlinkSync(out);
          await downloadTo(rawgResize(detail.background_image, 640), out);
        }
      } catch (e) {
        posterFailed++;
        next.poster = null;
        console.log(`  poster FAIL ${game.slug}: ${e.message}`);
      }
    } else {
      next.poster = null;
    }

    if (!DRY_RUN) data[idx] = next;
    updates.push({ slug: game.slug, name: detail.name, year: next.year, rawgSlug: detail.slug });
    ok++;
    const tag = detail.slug === game.slug ? '' : `  →  ${detail.slug}`;
    const extras = [
      next.platforms?.length ? `${next.platforms.length}p` : '',
      next.stores?.length ? `${next.stores.length}st` : '',
      next.screenshots?.length ? `${next.screenshots.length}sh` : '',
      next.videos?.length ? `${next.videos.length}v` : '',
    ].filter(Boolean).join(' ');
    console.log(`  ok     ${game.slug}${tag}${extras ? `   [${extras}]` : ''}`);
    await sleep(800);
  }

  if (!DRY_RUN && ok > 0) {
    fs.writeFileSync(MOVIES_JSON, JSON.stringify(data, null, 2) + '\n');
  }

  console.log();
  console.log(`Done. updated=${ok}  failed=${failed}  posterFailed=${posterFailed}${DRY_RUN ? '  (dry run — no files written)' : ''}`);
  if (failed) {
    console.log('\nFor failures, add an entry to OVERRIDES at the top of this script:');
    console.log("  'your-local-slug': 'rawg-slug-or-numeric-id',");
  }
};

main().catch((e) => { console.error(e); process.exit(1); });
