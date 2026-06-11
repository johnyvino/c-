// Parse all source JSONs in "Movies List/" into a single normalized raw list.
// Output: scripts/.cache/01-raw.json
// Schema per item: { rawTitle, title, year, type, slug, sourceFile, sourceUrl, posterHint }
//
// Format detection is by row shape, not filename — drop any source export in
// the folder and the parser picks the right shape automatically.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCES_DIR = path.join(ROOT, 'Movies List');
const OUT = path.join(__dirname, '.cache', '01-raw.json');

const slugify = (s) =>
  s.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const parseTitleYear = (s) => {
  const m = s?.match(/^(.+?)\s*\((\d{4})\)\s*$/);
  if (m) return { title: m[1].trim(), year: parseInt(m[2], 10) };
  return { title: s?.trim(), year: null };
};

// Format A: tall list of single-poster rows
//   { "image src", "frame href", "frame-title" }
// Always movies.
const parseImageRowFormat = (data, sourceFile) => {
  const out = [];
  for (const row of data) {
    const titleField = row['frame-title'];
    const href = row['frame href'];
    const img = row['image src'];
    if (!titleField || !href) continue;
    const { title, year } = parseTitleYear(titleField);
    if (!title) continue;
    out.push({
      rawTitle: titleField,
      title,
      year,
      type: 'movie',
      slug: slugify(`${title}-${year ?? ''}`),
      sourceFile,
      sourceUrl: href,
      posterHint: img || null,
    });
  }
  return out;
};

// Format B: wide-row exports with css-prefixed columns
//   "css-0 href", "css-0 href (2)", ...
//   "css-15jdd67 src", "css-15jdd67 src (2)", ...
//   "css-59o5f8" (title with year), alternating across (N) suffixes.
// Type (movie vs show) is inferred from the href path.
const parseWideRowFormat = (data, sourceFile) => {
  const out = [];
  for (const row of data) {
    const keys = Object.keys(row);
    const hrefKeys = keys.filter((k) => /^css-0 href( \(\d+\))?$/.test(k));

    const titleKeys = keys.filter((k) => /^css-59o5f8( \(\d+\))?$/.test(k));
    const titlesInOrder = titleKeys
      .map((k) => row[k])
      .filter((v) => typeof v === 'string' && /\(\d{4}\)/.test(v));

    let titleIdx = 0;
    for (const hrefKey of hrefKeys) {
      const suffix = hrefKey.replace('css-0 href', '');
      const href = row[hrefKey];
      const src = row[`css-15jdd67 src${suffix}`];
      const titleField = titlesInOrder[titleIdx++];
      if (!href || !titleField) continue;

      const { title, year } = parseTitleYear(titleField);
      if (!title) continue;
      const isShow = /\/show\//.test(href);
      out.push({
        rawTitle: titleField,
        title,
        year,
        type: isShow ? 'show' : 'movie',
        slug: slugify(`${title}-${year ?? ''}`),
        sourceFile,
        sourceUrl: href,
        posterHint: src || null,
      });
    }
  }
  return out;
};

// Pick the right parser by inspecting the first row's keys.
const detectAndParse = (data, sourceFile) => {
  if (!Array.isArray(data) || data.length === 0) return [];
  const sample = data[0];
  if (sample['frame-title'] && sample['frame href']) {
    return { kind: 'image-row', items: parseImageRowFormat(data, sourceFile) };
  }
  if (Object.keys(sample).some((k) => k.startsWith('css-0 href'))) {
    return { kind: 'wide-row', items: parseWideRowFormat(data, sourceFile) };
  }
  return { kind: 'unknown', items: [] };
};

const main = () => {
  const files = fs.readdirSync(SOURCES_DIR).filter((f) => f.endsWith('.json'));
  console.log(`Found ${files.length} source JSON files`);

  const all = [];
  for (const f of files) {
    const full = path.join(SOURCES_DIR, f);
    const raw = JSON.parse(fs.readFileSync(full, 'utf-8'));
    const { kind, items } = detectAndParse(raw, f);
    console.log(`  ${f}: ${items.length} (${kind})`);
    all.push(...items);
  }

  // Dedup by (type + slug). Prefer non-null poster hint.
  const byKey = new Map();
  for (const item of all) {
    const key = `${item.type}:${item.slug}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...item });
    } else if (!prev.posterHint && item.posterHint) {
      prev.posterHint = item.posterHint;
    }
  }
  const deduped = [...byKey.values()];

  fs.writeFileSync(OUT, JSON.stringify(deduped, null, 2));
  console.log(`\nTotal raw: ${all.length}`);
  console.log(`After dedup: ${deduped.length}`);
  console.log(`  movies: ${deduped.filter((d) => d.type === 'movie').length}`);
  console.log(`  shows:  ${deduped.filter((d) => d.type === 'show').length}`);
  console.log(`Wrote ${OUT}`);
};

main();
