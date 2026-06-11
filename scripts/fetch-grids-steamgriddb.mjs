// Fill in vertical posters for games that Steam's CDN couldn't cover (mobile,
// retro, platform-exclusive). Uses SteamGridDB — community-curated game art
// with broad coverage of every platform. Free, but requires registration.
//
// Setup:
//   1. Sign in at https://www.steamgriddb.com/
//   2. Get your API key at https://www.steamgriddb.com/profile/preferences/api
//   3. Add to .env.local:    VITE_STEAMGRIDDB_API_KEY=...
//
// Usage: npm run fetch-grids-steamgriddb

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'src', 'data', 'movies.json');
const POSTERS_DIR = path.join(ROOT, 'public', 'posters');

const KEY = process.env.VITE_STEAMGRIDDB_API_KEY || process.env.STEAMGRIDDB_API_KEY;
if (!KEY) {
  console.error('Set VITE_STEAMGRIDDB_API_KEY in .env.local');
  console.error('  Get one at https://www.steamgriddb.com/profile/preferences/api');
  process.exit(1);
}

const SGDB = 'https://www.steamgriddb.com/api/v2';

const fetchJson = (url) =>
  new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { Authorization: `Bearer ${KEY}`, 'User-Agent': 'JohnvinosFavorites/1.0' },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 120)}`));
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`bad JSON: ${e.message}`)); }
      });
    });
    req.on('error', (e) => reject(new Error(`network: ${e.code || e.message}`)));
    req.setTimeout(15000, () => req.destroy(new Error('timeout')));
  });

const downloadTo = (url, filepath) =>
  new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'JohnvinosFavorites/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadTo(res.headers.location, filepath).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const tmp = filepath + '.tmp';
      const ws = fs.createWriteStream(tmp);
      res.pipe(ws);
      ws.on('finish', () => { ws.close(); fs.renameSync(tmp, filepath); resolve(); });
      ws.on('error', (e) => { fs.unlink(tmp, () => reject(e)); });
    }).on('error', reject);
  });

const searchGame = async (title) => {
  const data = await fetchJson(`${SGDB}/search/autocomplete/${encodeURIComponent(title)}`);
  return data?.data?.[0] || null;
};

const fetchVerticalGrid = async (sgdbId) => {
  // dimensions=600x900 = standard vertical box art; types=static avoids GIFs
  const url = `${SGDB}/grids/game/${sgdbId}?dimensions=600x900&types=static&nsfw=false`;
  const data = await fetchJson(url);
  return data?.data?.[0] || null;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf-8'));
  let fetched = 0, skipped = 0, failed = 0;
  for (const g of data) {
    if (g.type !== 'game') continue;
    if (g.posterVertical && fs.existsSync(path.join(ROOT, 'public', g.posterVertical))) {
      skipped++;
      continue;
    }
    try {
      const hit = await searchGame(g.title);
      if (!hit) throw new Error('not found on SteamGridDB');
      const grid = await fetchVerticalGrid(hit.id);
      if (!grid?.url) throw new Error('no 600x900 grid available');
      const ext = grid.url.match(/\.(jpe?g|png|webp)/i)?.[1]?.toLowerCase() || 'jpg';
      const out = path.join(POSTERS_DIR, `${g.slug}-vertical.${ext === 'jpeg' ? 'jpg' : ext}`);
      await downloadTo(grid.url, out);
      g.posterVertical = `/posters/${path.basename(out)}`;
      fetched++;
      console.log(`  ✓ ${g.slug} (sgdb ${hit.id})`);
      await sleep(150);
    } catch (e) {
      failed++;
      const msg = e.message || e.code || e.toString() || 'unknown error';
      console.log(`  ✗ ${g.slug}: ${msg}`);
    }
  }
  fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
  console.log(`\nDone. fetched=${fetched} skipped=${skipped} failed=${failed}`);
};

main().catch((e) => { console.error(e); process.exit(1); });
