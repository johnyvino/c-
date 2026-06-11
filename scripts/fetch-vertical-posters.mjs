// Fetch vertical box art (600×900) from Steam's library CDN for every game
// with a Steam store URL, save to public/posters/{slug}-vertical.jpg, and
// patch the matching entry in src/data/movies.json with `posterVertical`.
//
// Steam's library art URL pattern is public + free + no auth required:
//   https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/library_600x900.jpg
//
// Games without a Steam URL (mobile-only, console-exclusive, retro) are
// reported as skipped — drop a manual file at posters/{slug}-vertical.{jpg,webp}
// and re-run if you want them covered.
//
// Usage: npm run fetch-vertical-posters

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'src', 'data', 'movies.json');
const POSTERS_DIR = path.join(ROOT, 'public', 'posters');

const STEAM_LIBRARY_URL = (appid) =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;
const STEAM_FALLBACK_URL = (appid) =>
  `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900.jpg`;

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
      ws.on('finish', () => {
        ws.close();
        fs.renameSync(tmp, filepath);
        resolve();
      });
      ws.on('error', (e) => { fs.unlink(tmp, () => reject(e)); });
    }).on('error', reject);
  });

const steamAppIdFrom = (storeUrl) => {
  const m = (storeUrl || '').match(/\/app\/(\d+)/);
  return m ? m[1] : null;
};

const main = async () => {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf-8'));
  let fetched = 0, skipped = 0, failed = 0, alreadyHad = 0;
  const noSteam = [];
  for (const g of data) {
    if (g.type !== 'game') continue;
    if (g.posterVertical && fs.existsSync(path.join(ROOT, 'public', g.posterVertical))) {
      alreadyHad++;
      continue;
    }
    const steamUrl = g.stores?.find((s) => s.slug === 'steam' && s.url)?.url;
    const appid = steamAppIdFrom(steamUrl);
    if (!appid) { noSteam.push(g.slug); skipped++; continue; }
    const out = path.join(POSTERS_DIR, `${g.slug}-vertical.jpg`);
    try {
      try {
        await downloadTo(STEAM_LIBRARY_URL(appid), out);
      } catch {
        await downloadTo(STEAM_FALLBACK_URL(appid), out);
      }
      g.posterVertical = `/posters/${g.slug}-vertical.jpg`;
      fetched++;
      console.log(`  ✓ ${g.slug} (appid ${appid})`);
    } catch (e) {
      failed++;
      console.log(`  ✗ ${g.slug} appid ${appid}: ${e.message}`);
    }
  }
  fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
  console.log(`\nDone. fetched=${fetched} alreadyHad=${alreadyHad} failed=${failed} no-steam=${skipped}`);
  if (noSteam.length) console.log('\nNo Steam URL (drop a manual file as posters/{slug}-vertical.jpg):');
  noSteam.forEach((s) => console.log('  -', s));
};

main().catch((e) => { console.error(e); process.exit(1); });
