// Download posters in highest practical quality.
// Input:  scripts/.cache/02-enriched.json
// Output: posters into public/posters/<slug>.jpg + scripts/.cache/03-posters.json
//
// Strategy per title (first success wins):
//   1. TMDb w780 from posterPath (best quality, consistent crop)
//   2. Upgrade any source poster hint to a higher resolution if recognized
//   3. Fall back to original poster hint
//   4. Skip with poster: null
//
// Idempotent: if a poster file already exists and is non-empty, skip download.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IN = path.join(__dirname, '.cache', '02-enriched.json');
const OUT = path.join(__dirname, '.cache', '03-posters.json');
const POSTERS_DIR = path.join(ROOT, 'public', 'posters');

fs.mkdirSync(POSTERS_DIR, { recursive: true });

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
          resolve();
        });
      });
      ws.on('error', (err) => {
        fs.unlink(tmp, () => reject(err));
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });

// Try to upgrade a known poster-host URL to a higher resolution.
// Returns the upgraded URL if recognized, otherwise the original.
const upgradePosterUrl = (url) => {
  if (!url) return url;
  // Pattern: /<id>-<slug>-0-150-0-225-crop.jpg → /<id>-<slug>-0-460-0-690-crop.jpg
  let upgraded = url.replace('-0-150-0-225-crop', '-0-460-0-690-crop');
  if (upgraded !== url) return upgraded;
  // Pattern: poster-185.jpg → poster-780.jpg
  upgraded = url.replace('poster-185.jpg', 'poster-780.jpg');
  return upgraded;
};

const buildCandidates = (item) => {
  const urls = [];
  if (item.tmdb?.posterPath) {
    urls.push({ tag: 'tmdb', url: `https://image.tmdb.org/t/p/w780${item.tmdb.posterPath}` });
  }
  if (item.posterHint) {
    const upgraded = upgradePosterUrl(item.posterHint);
    urls.push({ tag: 'hint-hi', url: upgraded });
    if (upgraded !== item.posterHint) urls.push({ tag: 'hint', url: item.posterHint });
  }
  return urls;
};

const main = async () => {
  const items = JSON.parse(fs.readFileSync(IN, 'utf-8'));
  console.log(`Resolving posters for ${items.length} titles...`);

  const results = [];
  let downloaded = 0, cached = 0, failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const filename = `${item.slug}.jpg`;
    const filepath = path.join(POSTERS_DIR, filename);
    const publicPath = `/posters/${filename}`;

    if (fs.existsSync(filepath) && fs.statSync(filepath).size >= 1024) {
      cached++;
      results.push({ slug: item.slug, poster: publicPath });
      console.log(`  [${i + 1}/${items.length}] cache ${item.title}`);
      continue;
    }

    const candidates = buildCandidates(item);
    let ok = false;
    for (const { tag, url } of candidates) {
      try {
        await fetchToFile(url, filepath);
        downloaded++;
        ok = true;
        results.push({ slug: item.slug, poster: publicPath });
        console.log(`  [${i + 1}/${items.length}] ${tag.padEnd(8)} ${item.title}`);
        break;
      } catch (e) {
        // try next candidate
      }
    }
    if (!ok) {
      failed++;
      results.push({ slug: item.slug, poster: null });
      console.log(`  [${i + 1}/${items.length}] FAIL     ${item.title} (${item.year || '?'})`);
    }
    if (!ok || downloaded % 5 === 0) await sleep(40);
  }

  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log(`\nDone. downloaded=${downloaded}  cached=${cached}  failed=${failed}`);
  console.log(`Wrote ${OUT}`);
};

main().catch((e) => { console.error(e); process.exit(1); });
