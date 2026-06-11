// One-shot orchestrator. Runs steps 1-4 in order.
// Each step is idempotent — re-running uses caches.
//
// Usage: node scripts/build-data.mjs

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const run = (script) =>
  new Promise((resolve, reject) => {
    const full = path.join(__dirname, script);
    console.log(`\n━━━ ${script} ━━━`);
    const proc = spawn(process.execPath, [full], { stdio: 'inherit' });
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with code ${code}`));
    });
  });

const main = async () => {
  await run('01-parse-sources.mjs');
  await run('02-enrich-tmdb.mjs');
  await run('03-download-posters.mjs');
  await run('04-build-final.mjs');
  console.log('\n✓ Build complete. src/data/movies.json + src/data/filters.json are ready.');
};

main().catch((e) => { console.error('\n✗', e.message); process.exit(1); });
