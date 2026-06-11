import { useCallback, useEffect, useState } from 'react';

const DEFAULT_REPO = 'johnyvino/c-';
const DEFAULT_BRANCH = 'main';
const FILE_PATH = 'src/data/movies.json';

// Lazy import so the 350KB bundled JSON stays out of the main entry chunk.
// In dev (no GitHub token) we use the bundled JSON directly. In production
// we hit raw.githubusercontent.com — there is no bundled fallback because
// shipping a 320KB chunk that prod almost never uses is wasted bandwidth.
const loadBundled = () => import('../data/movies.json').then((m) => m.default);

// Public fetch: raw.githubusercontent.com is CDN-cached, so we append a
// cache-busting query string to dodge the edge cache (~5 min otherwise).
const fetchRaw = async (repo, branch) => {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${FILE_PATH}?t=${Date.now()}`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`raw.githubusercontent ${r.status}`);
  return r.json();
};

// Authed fetch via the Contents API. Works for private repos and is not
// edge-cached, so it always sees the latest commit on the branch.
const fetchAuthed = async ({ token, repo, branch }) => {
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(FILE_PATH)}?ref=${encodeURIComponent(branch)}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.raw',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`GitHub ${r.status} ${await r.text()}`);
  return JSON.parse(await r.text());
};

export const useMoviesData = ({ gh } = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const load = async () => {
      // In dev with no GitHub token, the bundled JSON is the source of truth —
      // skip the network fetch so local sync-games changes show immediately.
      // (Admin always passes a token, so it still hits the live repo.)
      if (import.meta.env.DEV && !gh?.token) {
        const bundled = await loadBundled();
        if (!cancelled) {
          setData(bundled);
          setLoading(false);
        }
        return;
      }
      try {
        const json = gh?.token
          ? await fetchAuthed(gh)
          : await fetchRaw(DEFAULT_REPO, DEFAULT_BRANCH);
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setError(e);
          // GitHub fetch failed (offline, rate-limited, etc.) — in dev we can
          // still fall back to the bundled JSON. In prod the bundled chunk is
          // tree-shaken away (see loadBundled comment), so just surface the
          // error and render an empty grid.
          if (import.meta.env.DEV) {
            try {
              const bundled = await loadBundled();
              if (!cancelled) setData(bundled);
            } catch { /* ignore — already in error state */ }
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [gh?.token, gh?.repo, gh?.branch, version]);

  return { data, loading, error, refetch };
};
