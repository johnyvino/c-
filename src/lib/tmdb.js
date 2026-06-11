// Pure helpers for working with TMDB-shaped provider/brand data. No runtime
// fetching: every field rendered by the public site is baked into movies.json
// by scripts/enrich-static.mjs. This file is imported by both the React bundle
// (DetailModal) and the enrichment script (Node), so it must stay free of
// Vite-specific syntax like `import.meta.env`.

export const tmdbDetailsUrl = (movie) =>
  `https://www.themoviedb.org/${movie.type === 'show' ? 'tv' : 'movie'}/${movie.tmdbId}/watch`;

// Pick the first watch-providers region that actually has streaming content.
// Tries common English-speaking regions first, then any region with content.
export const pickWatchRegion = (results) => {
  const ordered = ['US', 'IN', 'GB', 'CA', 'AU', 'NZ'];
  const hasContent = (r) =>
    r && (r.link || r.flatrate?.length || r.free?.length || r.ads?.length || r.rent?.length || r.buy?.length);
  for (const code of ordered) if (hasContent(results?.[code])) return results[code];
  for (const r of Object.values(results || {})) if (hasContent(r)) return r;
  return null;
};

// TMDB lists sub-brands as separate providers (Netflix + "Netflix Standard with
// Ads", Prime Video + "Prime Video with Ads", BritBox + "BritBox Apple TV
// Channel"). Map each name to a canonical key so we render one tile per brand.
const BRAND_PATTERNS = [
  { test: /netflix/i,                    key: 'netflix' },
  { test: /(hotstar|disney\+ hotstar)/i, key: 'hotstar' },
  { test: /disney/i,                     key: 'disney' },
  { test: /(amazon|prime video)/i,       key: 'prime' },
  { test: /apple tv/i,                   key: 'apple-tv' },
  { test: /britbox/i,                    key: 'britbox' },
  { test: /hulu/i,                       key: 'hulu' },
  { test: /(hbo|^max\b)/i,               key: 'max' },
  { test: /paramount/i,                  key: 'paramount' },
  { test: /peacock/i,                    key: 'peacock' },
  { test: /jiocinema/i,                  key: 'jiocinema' },
  { test: /sonyliv/i,                    key: 'sonyliv' },
  { test: /zee5/i,                       key: 'zee5' },
  { test: /mubi/i,                       key: 'mubi' },
  { test: /crunchyroll/i,                key: 'crunchyroll' },
  { test: /youtube/i,                    key: 'youtube' },
  { test: /google play/i,                key: 'google-play' },
  { test: /(fandango at home|vudu)/i,    key: 'vudu' },
  { test: /microsoft store/i,            key: 'microsoft' },
];

// Channel-passthrough entries ("Starz Apple TV Channel", "BritBox Amazon
// Channel", "Max Amazon Channel") are subscriptions billed through another
// store. Drop them outright — the base brand row still appears, and the
// passthrough only adds noise (often as a duplicate "Max" or "BritBox" chip).
const isPassthroughChannel = (name) => {
  if (!name) return false;
  if (/\bpremium channel\b/i.test(name)) return true;
  if (/\b(apple tv|amazon|roku|google play|verizon|fios|spectrum|xfinity)\s+channel\b/i.test(name)) return true;
  // Catch loose "X Amazon" / "Amazon X" passthrough variants for brands that
  // aren't Amazon Prime Video themselves.
  if (/amazon/i.test(name)) {
    const brand = canonicalBrandRaw(name);
    if (brand && brand !== 'prime') return true;
  }
  return false;
};

// Bare brand resolver used by `isPassthroughChannel` — kept separate so we
// avoid any risk of mutual-recursion with the suffix-stripping logic below.
const canonicalBrandRaw = (name) => {
  const found = BRAND_PATTERNS.find((p) => p.test.test(name || ''));
  return found?.key || null;
};

const canonicalBrand = (name) => {
  if (!name) return '';
  const found = BRAND_PATTERNS.find((p) => p.test.test(name));
  if (found) return found.key;
  // Strip channel-passthrough suffixes ("Starz Apple TV Channel", "Starz Roku
  // Premium Channel") so they all dedupe to the base brand.
  return name
    .toLowerCase()
    .replace(/\s+(apple tv|amazon|roku|google play|verizon|fios|spectrum|xfinity)\s+channel\b/g, '')
    .replace(/\s+premium channel\b/g, '')
    .replace(/\s+with ads\b/g, '')
    .trim();
};

// TMDB doesn't return per-provider deep links — only one aggregated `link`
// pointing back to TMDB itself. We layered Watchmode on top of this to get
// real per-title deep URLs (see useTmdbDetails). When neither source has a
// direct URL we just send the user to TMDB's watch page rather than a
// generic search-on-the-provider page — those routinely return no results
// (especially for regional services like JioCinema, Sun NXT, Zee5) and feel
// like dead ends. TMDB's page at least lists verified availability.
//
// YouTube is the lone exception: its search reliably surfaces full movies
// (free + rentals), so we keep its search-redirect template.
const YT_SEARCH = (q, type) =>
  `https://www.youtube.com/results?search_query=${q}+${type === 'show' ? 'series' : 'movie'}`;

export const providerWatchUrl = (provider, movie) => {
  if (provider?.directUrl) return provider.directUrl;
  if (canonicalBrand(provider?.provider_name) === 'youtube') {
    const q = encodeURIComponent(movie.originalTitle || movie.title || '');
    return YT_SEARCH(q, movie.type);
  }
  return tmdbDetailsUrl(movie);
};

// Short labels for the chip row. Watch-provider names from TMDB/Watchmode get
// long ("Amazon Prime Video", "Disney+ Hotstar", "Sun NXT") and overflow the
// pill. The full name still lives on the chip's `title` attribute.
const SHORT_NAME_PATTERNS = [
  { test: /(amazon prime video|prime video|amazon video|^amazon$)/i, label: 'Prime' },
  { test: /apple tv\+?/i,                                             label: 'Apple TV' },
  { test: /netflix/i,                                                 label: 'Netflix' },
  { test: /disney\+? hotstar|^hotstar/i,                              label: 'Hotstar' },
  { test: /disney/i,                                                  label: 'Disney+' },
  { test: /(hbo ?)?max\b/i,                                           label: 'Max' },
  { test: /paramount/i,                                               label: 'Paramount+' },
  { test: /peacock/i,                                                 label: 'Peacock' },
  { test: /hulu/i,                                                    label: 'Hulu' },
  { test: /youtube/i,                                                 label: 'YouTube' },
  { test: /google play/i,                                             label: 'Google' },
  { test: /sun ?nxt/i,                                                label: 'Sun' },
  { test: /jiocinema|jiohotstar/i,                                    label: 'Jio' },
  { test: /sonyliv/i,                                                 label: 'SonyLIV' },
  { test: /zee ?5/i,                                                  label: 'Zee5' },
  { test: /mubi/i,                                                    label: 'MUBI' },
  { test: /crunchyroll/i,                                             label: 'Crunchyroll' },
  { test: /britbox/i,                                                 label: 'BritBox' },
  { test: /(fandango at home|vudu)/i,                                 label: 'Vudu' },
  { test: /microsoft/i,                                               label: 'Microsoft' },
];

export const shortProviderName = (name) => {
  if (!name) return '';
  const found = SHORT_NAME_PATTERNS.find((p) => p.test.test(name));
  if (found) return found.label;
  return name.replace(/\s+(with ads|standard|premium|plus)\b/i, '').trim();
};

// TMDB's category list → one entry per canonical brand, sorted by display priority.
export const dedupeProviders = (list) => {
  const sorted = [...(list || [])]
    .filter((p) => !isPassthroughChannel(p.provider_name))
    .sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999));
  const seen = new Set();
  const out = [];
  for (const p of sorted) {
    const key = canonicalBrand(p.provider_name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
};

const hostnameOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return null; }
};

// Preferred favicon domain per canonical brand. Watchmode `web_url`s often
// point at storefront hostnames whose favicons aren't on-brand (Prime Video
// chips ending up with the Amazon-shopping smile, etc.). When we have a
// recognized brand, prefer its dedicated streaming domain.
const BRAND_FAVICON_DOMAINS = {
  'prime':       'primevideo.com',
  'netflix':     'netflix.com',
  'apple-tv':    'tv.apple.com',
  'disney':      'disneyplus.com',
  'hotstar':     'hotstar.com',
  'hulu':        'hulu.com',
  'max':         'max.com',
  'paramount':   'paramountplus.com',
  'peacock':     'peacocktv.com',
  'youtube':     'youtube.com',
  'google-play': 'play.google.com',
  'mubi':        'mubi.com',
  'crunchyroll': 'crunchyroll.com',
  'britbox':     'britbox.com',
  'jiocinema':   'jiocinema.com',
  'sonyliv':     'sonyliv.com',
  'zee5':        'zee5.com',
  'vudu':        'vudu.com',
  'microsoft':   'microsoft.com',
};

const brandFaviconDomain = (name) => BRAND_FAVICON_DOMAINS[canonicalBrand(name)] || null;

// Display rank for the streaming chip row — lower number = shown first. TMDB
// returns providers in its own per-region "display_priority" order, which
// surfaces obscure regional services above household-name globals on niche
// titles. This rank pins the platforms most users have to the front, with
// India-popular services (Hotstar, Jio, Sony, Zee, Sun) ahead of the long tail.
// Anything not in the map sorts after — keyed by canonical brand.
const PROVIDER_POPULARITY_RANK = {
  'netflix':     1,
  'prime':       2,
  'disney':      3,
  'hotstar':     4,
  'max':         5,
  'apple-tv':    6,
  'hulu':        7,
  'paramount':   8,
  'peacock':     9,
  'jiocinema':   10,
  'sonyliv':     11,
  'zee5':        12,
  'sun':         13,
  'mubi':        14,
  'crunchyroll': 15,
  'britbox':     16,
  'youtube':     17,
  'google-play': 18,
  'vudu':        19,
  'microsoft':   20,
};

export const sortProvidersByPopularity = (providers) =>
  [...(providers || [])].sort((a, b) => {
    const ra = PROVIDER_POPULARITY_RANK[canonicalBrand(a.provider_name)] ?? 999;
    const rb = PROVIDER_POPULARITY_RANK[canonicalBrand(b.provider_name)] ?? 999;
    if (ra !== rb) return ra - rb;
    // Same rank (or both unknown) — fall back to TMDB's display_priority so the
    // ordering stays stable for everything off the curated list.
    return (a.display_priority ?? 999) - (b.display_priority ?? 999);
  });

// Merge Watchmode sources into the TMDB provider list. Where brands match by
// canonical key, we attach the Watchmode `web_url` as `directUrl` (a real deep
// link to the title's page on that provider). Watchmode-only brands get
// appended as synthetic entries with a favicon stand-in for the missing TMDB
// logo. The result keeps TMDB's display ordering for matched brands so the
// chip row stays visually stable.
export const mergeWatchmodeIntoProviders = (tmdbProviders, watchmodeSources, typePriority) => {
  // Best (lowest-cost) Watchmode source per canonical brand.
  const wmByBrand = new Map();
  for (const s of watchmodeSources || []) {
    const key = canonicalBrand(s.name);
    if (!key) continue;
    const existing = wmByBrand.get(key);
    const score = (typePriority[s.type] ?? 9);
    if (!existing || score < (typePriority[existing.type] ?? 9)) {
      wmByBrand.set(key, s);
    }
  }

  const merged = [];
  const seenBrands = new Set();
  for (const p of tmdbProviders) {
    const brand = canonicalBrand(p.provider_name);
    if (seenBrands.has(brand)) continue;
    seenBrands.add(brand);
    const wm = wmByBrand.get(brand);
    merged.push({ ...p, directUrl: wm?.web_url || null });
  }
  // Watchmode-only brands — render with a favicon since we don't have a TMDB logo.
  for (const [brand, s] of wmByBrand) {
    if (seenBrands.has(brand)) continue;
    seenBrands.add(brand);
    merged.push({
      provider_id: `wm-${brand}`,
      provider_name: s.name,
      logo_path: null,
      directUrl: s.web_url,
      domain: BRAND_FAVICON_DOMAINS[brand] || hostnameOf(s.web_url),
    });
  }
  return merged;
};

export { brandFaviconDomain };
