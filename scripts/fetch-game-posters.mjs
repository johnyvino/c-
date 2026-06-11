// Fetch cover art for game entries from Wikipedia's REST API and save into
// public/posters/<slug>.jpg. Also sets m.poster on each matched entry.
//
// Run locally (no API key needed):
//   node scripts/fetch-game-posters.mjs
//
// For each game we hit /api/rest_v1/page/summary/<title> and grab the
// originalimage. If a game's Wikipedia title differs from its display title
// (disambiguation, rare punctuation), add an override in WIKI_TITLE below.

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MOVIES_JSON = path.join(ROOT, 'src', 'data', 'movies.json');
const POSTERS_DIR = path.join(ROOT, 'public', 'posters');
fs.mkdirSync(POSTERS_DIR, { recursive: true });

const UA = 'JohnvinosFavorites/1.0 (personal site; contact: johnvino@local)';

// Override Wikipedia article titles where the display title doesn't match
// the article slug (disambiguation, special characters, etc.).
const WIKI_TITLE = {
  'super-mario-64': 'Super_Mario_64',
  'it-takes-two': 'It_Takes_Two_(video_game)',
  'ghost-of-tsushima': 'Ghost_of_Tsushima',
  'assassins-creed-ii': "Assassin's_Creed_II",
  'black-myth-wukong': 'Black_Myth:_Wukong',
  'assassins-creed-odyssey': "Assassin's_Creed_Odyssey",
  'sniper-elite-5': 'Sniper_Elite_5',
  'sniper-elite-4': 'Sniper_Elite_4',
  'olympic-games-tokyo-2020': 'Tokyo_2020_(video_game)',
  'need-for-speed-heat': 'Need_for_Speed:_Heat',
  'overcooked-all-you-can-eat': 'Overcooked!_All_You_Can_Eat',
  'mortal-kombat-11': 'Mortal_Kombat_11',
  'assassins-creed-altairs-chronicles': "Assassin's_Creed:_Altaïr's_Chronicles",
  'assassins-creed-brotherhood': "Assassin's_Creed:_Brotherhood",
  'need-for-speed-most-wanted': 'Need_for_Speed:_Most_Wanted_(2005_video_game)',
  'max-payne': 'Max_Payne_(video_game)',
  'call-of-duty-4-modern-warfare': 'Call_of_Duty_4:_Modern_Warfare',
  'arcade-archives-circus-charlie': 'Circus_Charlie',
  'contra-arcade': 'Contra_(video_game)',
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

const main = async () => {
  const data = JSON.parse(fs.readFileSync(MOVIES_JSON, 'utf-8'));
  const games = data.filter((m) => m.type === 'game');
  console.log(`Found ${games.length} game(s).`);

  let ok = 0, skipped = 0, failed = 0;
  for (const g of games) {
    const out = path.join(POSTERS_DIR, `${g.slug}.jpg`);
    if (fs.existsSync(out) && fs.statSync(out).size >= 1024) {
      g.poster = `/posters/${g.slug}.jpg`;
      skipped++;
      console.log(`  skip   ${g.slug} (cached)`);
      continue;
    }
    const wikiTitle = WIKI_TITLE[g.slug] || g.title.replace(/\s+/g, '_');
    const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle).replace(/%20/g, '_').replace(/%2C/g, ',')}`;
    try {
      const json = await httpsGetJson(apiUrl);
      const imgUrl = json.originalimage?.source || json.thumbnail?.source;
      if (!imgUrl) throw new Error('no image on Wikipedia page');
      await downloadTo(imgUrl, out);
      g.poster = `/posters/${g.slug}.jpg`;
      ok++;
      console.log(`  ok     ${g.slug}  ←  ${wikiTitle}`);
    } catch (e) {
      failed++;
      console.log(`  FAIL   ${g.slug}: ${e.message}`);
    }
    await sleep(800);
  }

  fs.writeFileSync(MOVIES_JSON, JSON.stringify(data, null, 2) + '\n');
  console.log(`\nDone. downloaded=${ok}  cached=${skipped}  failed=${failed}`);
  console.log('movies.json updated with poster paths.');
  if (failed) {
    console.log('\nFor failures: open the Wikipedia page in a browser, copy the article path');
    console.log("(e.g. en.wikipedia.org/wiki/<THIS>) and add it to WIKI_TITLE in this script.");
  }
};

main().catch((e) => { console.error(e); process.exit(1); });
