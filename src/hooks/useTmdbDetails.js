import { useEffect, useState } from 'react';
import { TMDB_API_KEY, TMDB_BASE } from '../lib/tmdbKey';
import { pickWatchRegion, dedupeProviders, mergeWatchmodeIntoProviders } from '../lib/tmdb';
import { fetchWatchmodeSources, WATCHMODE_TYPE_PRIORITY } from '../lib/watchmode';

// Touch screens can't visually distinguish a 780px backdrop from a 500px one
// at the photo-strip size — but the decoded RGBA difference is ~40 % per
// image, which adds up across the 6 we keep around per modal. Keep the
// higher-res variants for desktop where the lightbox upscales them.
const TMDB_PHOTO_WIDTH = (typeof window !== 'undefined'
  && window.matchMedia?.('(hover: none), (pointer: coarse)').matches)
  ? 'w500'
  : 'w780';

const EMPTY = {
  providers: [],
  director: null,
  cast: [],
  runtime: null,
  genres: [],
  score: null,
  photos: [],
};

// One TMDB call to populate the entire detail panel for a movie/show. Uses
// `append_to_response` so providers, credits, and images all come back in a
// single round-trip instead of three separate fetches. Watchmode runs in
// parallel and we splice its `web_url`s into the provider list so each chip
// links straight to the title's actual page on that platform.
export const useTmdbDetails = (movie) => {
  const [data, setData] = useState(EMPTY);
  // `loading` lets the caller render a placeholder skeleton (e.g. PhotoStrip
  // with grey slots) while we wait, so the modal's stagger animation has
  // something to animate at open-time instead of an empty slot that snaps in
  // a second later when the photos arrive.
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setData(EMPTY);
    setLoading(false);
    if (!movie?.tmdbId || movie.type === 'game') return;
    if (!TMDB_API_KEY) return;
    const path = movie.type === 'show' ? 'tv' : 'movie';
    const ctrl = new AbortController();
    let cancelled = false;
    setLoading(true);
    const tmdbUrl = `${TMDB_BASE}/${path}/${movie.tmdbId}`
      + `?api_key=${TMDB_API_KEY}`
      + `&append_to_response=credits,images,watch/providers`
      + `&include_image_language=en,null`;

    Promise.all([
      fetch(tmdbUrl, { signal: ctrl.signal }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetchWatchmodeSources(movie.tmdbId, movie.type, 'US', ctrl.signal),
    ]).then(([d, wmSources]) => {
      if (cancelled) return;
      if (!d) { setLoading(false); return; }

      const region = pickWatchRegion(d['watch/providers']?.results);
      const subs = region ? [...(region.flatrate || []), ...(region.free || []), ...(region.ads || [])] : [];
      const list = subs.length ? subs : (region ? [...(region.rent || []), ...(region.buy || [])] : []);
      const tmdbProviders = dedupeProviders(list);
      const providers = mergeWatchmodeIntoProviders(tmdbProviders, wmSources, WATCHMODE_TYPE_PRIORITY);

      const director = movie.type === 'show'
        ? (d.created_by?.[0]?.name || null)
        : (d.credits?.crew?.find((c) => c.job === 'Director')?.name || null);

      const cast = (d.credits?.cast || []).slice(0, 3).map((c) => c.name);

      const runtime = movie.type === 'show'
        ? (d.episode_run_time?.[0] || null)
        : (d.runtime || null);

      const genres = (d.genres || []).map((g) => g.name);
      const score = typeof d.vote_average === 'number' && d.vote_average > 0
        ? Math.round(d.vote_average * 10)
        : null;

      const photos = pickDiversePhotos(d.images?.backdrops || [], 6);

      setData({ providers, director, cast, runtime, genres, score, photos });
      setLoading(false);
    });

    return () => { cancelled = true; ctrl.abort(); };
  }, [movie]);

  return { ...data, loading };
};

// TMDB sorts backdrops by vote, which clusters the same promotional shoot at
// the top — five near-duplicate photos of the lead actor in the same outfit.
// Two cheap heuristics dramatically improve diversity without per-pixel image
// analysis:
//
//   1. Drop language-tagged images (iso_639_1 != null). Those are usually
//      title cards or posters-with-text — text-free backdrops are far more
//      likely to be unique scene captures.
//   2. Stride-sample the remaining pool. Instead of slicing the top N (which
//      are all clustered in the same vote tier from the same press kit),
//      walk the whole pool with an even step so picks span the popularity
//      curve. The deeper-in-list backdrops are usually candid stills,
//      behind-the-scenes, alt-angle shots — exactly what we want.
const pickDiversePhotos = (backdrops, n = 6) => {
  if (!backdrops?.length) return [];
  const textFree = backdrops.filter((b) => !b.iso_639_1);
  const pool = textFree.length >= n ? textFree : backdrops;
  if (pool.length <= n) {
    return pool.map((b) => `https://image.tmdb.org/t/p/${TMDB_PHOTO_WIDTH}${b.file_path}`);
  }
  // Stride-sample. e.g. pool of 30 picking 6 → indices 0, 5, 10, 15, 20, 25.
  const stride = pool.length / n;
  const picks = [];
  for (let i = 0; i < n; i++) {
    picks.push(pool[Math.floor(i * stride)]);
  }
  return picks.map((b) => `https://image.tmdb.org/t/p/${TMDB_PHOTO_WIDTH}${b.file_path}`);
};
