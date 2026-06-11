// Re-download all posters from TMDb at w342 size (was w780).
// w342 ≈ 60 KB vs w780 ≈ 250 KB — 4× smaller, still sharp at grid display size.
//
// Run: node scripts/resize-posters.mjs
// Idempotent — replaces existing files in public/posters/.

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchToFile = (url, filepath) =>
  new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchToFile(res.headers.location, filepath).then(resolve, reject);
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
          resolve(stat.size);
        });
      });
      ws.on('error', (err) => fs.unlink(tmp, () => reject(err)));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });

// Need posterPath from TMDb to construct the w342 URL — fetch it if missing.
const tmdb = async (urlPath) => {
  const url = new URL(`https://api.themoviedb.org/3${urlPath}`);
  url.searchParams.set('api_key', API_KEY);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDb ${res.status}`);
  return res.json();
};

const main = async () => {
  const movies = JSON.parse(fs.readFileSync(MOVIES_JSON, 'utf-8'));
  console.log(`Re-downloading posters at w342 for ${movies.length} titles...`);

  let downloaded = 0, skipped = 0, failed = 0;
  let totalBefore = 0, totalAfter = 0;

  for (let i = 0; i < movies.length; i++) {
    const m = movies[i];
    if (!m.poster || !m.tmdbId) { skipped++; continue; }

    const filename = path.basename(m.poster);
    const filepath = path.join(POSTERS_DIR, filename);

    // Capture original size for comparison
    let before = 0;
    if (fs.existsSync(filepath)) before = fs.statSync(filepath).size;
    totalBefore += before;

    try {
      // Fetch TMDb details to get poster_path (we don't store it on the title)
      const ep = m.type === 'show' ? `/tv/${m.tmdbId}` : `/movie/${m.tmdbId}`;
      const details = await tmdb(ep);
      if (!details.poster_path) { skipped++; totalAfter += before; continue; }

      const url = `https://image.tmdb.org/t/p/w342${details.poster_path}`;
      const newSize = await fetchToFile(url, filepath);
      totalAfter += newSize;
      downloaded++;
      console.log(`  [${i + 1}/${movies.length}] ${(before/1024).toFixed(0).padStart(4)}KB → ${(newSize/1024).toFixed(0).padStart(4)}KB  ${m.title}`);
    } catch (e) {
      failed++;
      totalAfter += before;
      console.warn(`  [${i + 1}/${movies.length}] FAIL  ${m.title}: ${e.message}`);
    }
    await sleep(50);
  }

  console.log(`\nDone. downloaded=${downloaded}  skipped=${skipped}  failed=${failed}`);
  console.log(`Total bytes:  before=${(totalBefore/1024/1024).toFixed(1)}MB  after=${(totalAfter/1024/1024).toFixed(1)}MB`);
  console.log(`Saved:        ${((totalBefore-totalAfter)/1024/1024).toFixed(1)}MB`);
};

main().catch((e) => { console.error(e); process.exit(1); });
