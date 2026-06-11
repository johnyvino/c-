// Combine enriched data + poster results into final canonical files.
// Inputs:
//   scripts/.cache/02-enriched.json
//   scripts/.cache/03-posters.json
// Outputs:
//   src/data/movies.json   — array of canonical titles
//   src/data/filters.json  — { genres, years, languages, sources, types } derived facets

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENRICHED = path.join(__dirname, '.cache', '02-enriched.json');
const POSTERS = path.join(__dirname, '.cache', '03-posters.json');
const OUT_MOVIES = path.join(ROOT, 'src', 'data', 'movies.json');
const OUT_FILTERS = path.join(ROOT, 'src', 'data', 'filters.json');

const LANG_NAMES = {
  en: 'English', ta: 'Tamil', hi: 'Hindi', te: 'Telugu', ml: 'Malayalam',
  kn: 'Kannada', ko: 'Korean', ja: 'Japanese', zh: 'Chinese', cn: 'Chinese',
  fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese',
  ru: 'Russian', tr: 'Turkish', ar: 'Arabic', th: 'Thai', vi: 'Vietnamese',
};

const yearBucket = (year) => {
  if (!year) return 'Unknown';
  if (year >= 2020) return '2020s';
  if (year >= 2010) return '2010s';
  if (year >= 2000) return '2000s';
  if (year >= 1990) return '1990s';
  return 'Older';
};

const main = () => {
  const enriched = JSON.parse(fs.readFileSync(ENRICHED, 'utf-8'));
  const posters = JSON.parse(fs.readFileSync(POSTERS, 'utf-8'));
  const postersBySlug = new Map(posters.map((p) => [p.slug, p]));

  const titles = enriched
    .map((item) => {
      const p = postersBySlug.get(item.slug);
      const t = item.tmdb;
      return {
        id: `${item.type}-${item.slug}`,
        slug: item.slug,
        title: t?.title || item.title,
        originalTitle: t?.originalTitle || null,
        year: t?.year || item.year || null,
        type: item.type,
        poster: p?.poster || null,
        posterSource: p?.posterSource || null,
        genres: t?.genres || [],
        language: t?.language ? (LANG_NAMES[t.language] || t.language.toUpperCase()) : null,
        languageCode: t?.language || null,
        runtime: t?.runtime ?? null,
        seasons: t?.seasons ?? null,
        episodes: t?.episodes ?? null,
        overview: t?.overview || '',
        ratings: {
          tmdb: t?.tmdbRating != null ? Number(t.tmdbRating.toFixed(1)) : null,
          voteCount: t?.voteCount || 0,
          personal: null,
        },
        popularity: t?.popularity || 0,
        tmdbId: t?.tmdbId || null,
        imdbId: t?.imdbId || null,
        sources: item.sources || [],
        sourceUrl: item.sourceUrl || null,
      };
    })
    .filter((m) => m.poster) // drop items with no poster
    .sort((a, b) => b.popularity - a.popularity);

  // Derive facets from real data
  const genreSet = new Set();
  const yearSet = new Set();
  const langSet = new Set();
  const sourceSet = new Set();
  for (const t of titles) {
    for (const g of t.genres) genreSet.add(g);
    yearSet.add(yearBucket(t.year));
    if (t.language) langSet.add(t.language);
    for (const s of t.sources) sourceSet.add(s);
  }

  const yearOrder = ['2020s', '2010s', '2000s', '1990s', 'Older', 'Unknown'];
  const filters = {
    genres: [...genreSet].sort(),
    years: yearOrder.filter((y) => yearSet.has(y)),
    languages: [...langSet].sort(),
    sources: [...sourceSet].sort(),
    types: ['Movies', 'Shows'],
    sorts: ['Popular', 'Top Rated', 'Newest', 'A–Z'],
  };

  fs.mkdirSync(path.dirname(OUT_MOVIES), { recursive: true });
  fs.writeFileSync(OUT_MOVIES, JSON.stringify(titles, null, 2));
  fs.writeFileSync(OUT_FILTERS, JSON.stringify(filters, null, 2));

  console.log(`Wrote ${titles.length} titles → ${OUT_MOVIES}`);
  console.log(`  movies: ${titles.filter((t) => t.type === 'movie').length}`);
  console.log(`  shows:  ${titles.filter((t) => t.type === 'show').length}`);
  console.log(`Wrote facets → ${OUT_FILTERS}`);
  console.log(`  ${filters.genres.length} genres, ${filters.languages.length} languages, ${filters.years.length} year buckets`);
};

main();
