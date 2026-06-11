// RAWG API base URL. The admin user's API key is stored in localStorage
// (loadApiKeys in lib/storage.js) and threaded into the fetch at request time —
// never inlined into the public bundle, where VITE_* env vars would be visible
// to any visitor.
export const RAWG_BASE = 'https://api.rawg.io/api';
