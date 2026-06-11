const KEYS = {
  token:  'jvf_gh_token',
  repo:   'jvf_gh_repo',
  branch: 'jvf_gh_branch',
  edits:  'jvf_admin_edits',
  tmdbKey: 'jvf_tmdb_key',
  rawgKey: 'jvf_rawg_key',
};

export const loadGhConfig = () => ({
  token:  localStorage.getItem(KEYS.token)  || '',
  repo:   localStorage.getItem(KEYS.repo)   || '',
  branch: localStorage.getItem(KEYS.branch) || '',
});

export const saveGhConfig = ({ token, repo, branch }) => {
  localStorage.setItem(KEYS.token,  token);
  localStorage.setItem(KEYS.repo,   repo);
  localStorage.setItem(KEYS.branch, branch);
};

// API keys for the admin's own searches (TMDB titles, RAWG games). Stored in
// the admin's browser only — never inlined into the production bundle, since
// VITE_* env vars are public and would leak the keys to anyone hitting the
// deployed JS chunk.
export const loadApiKeys = () => ({
  tmdb: localStorage.getItem(KEYS.tmdbKey) || '',
  rawg: localStorage.getItem(KEYS.rawgKey) || '',
});

export const saveApiKeys = ({ tmdb, rawg }) => {
  localStorage.setItem(KEYS.tmdbKey, tmdb || '');
  localStorage.setItem(KEYS.rawgKey, rawg || '');
};

export const loadEdits = () => {
  try { return JSON.parse(localStorage.getItem(KEYS.edits) || '{}'); }
  catch { return {}; }
};

export const saveEdits = (edits) =>
  localStorage.setItem(KEYS.edits, JSON.stringify(edits));
