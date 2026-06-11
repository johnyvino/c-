export const yearBucket = (year) => {
  if (!year) return null;
  if (year >= 2020) return '2020s';
  if (year >= 2010) return '2010s';
  if (year >= 2000) return '2000s';
  if (year >= 1990) return '1990s';
  if (year >= 1980) return '1980s';
  return 'Older';
};

// Per-page-load shuffle order. Lazy: assign a stable random key the first time
// we see each id, so items added after the initial fetch still get a real key
// instead of clustering at the fallback.
export const SHUFFLE_KEY = (() => {
  const map = new Map();
  return {
    get(id) {
      if (!map.has(id)) map.set(id, Math.random());
      return map.get(id);
    },
  };
})();
