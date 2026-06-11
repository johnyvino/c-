const GH_API = 'https://api.github.com';

// btoa() chokes on non-Latin1 — encode as UTF-8 bytes first.
const utf8ToBase64 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

const getFileSha = async ({ token, repo, branch, path }) => {
  // Cache-bust the URL so we don't hit a stale replica right after a write.
  const url = `${GH_API}/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`;
  const r = await fetch(url, { headers: headers(token), cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub ${r.status} ${await r.text()}`);
  return (await r.json()).sha;
};

const putFile = async ({ token, repo, branch, path, content, sha, message }) => {
  const url = `${GH_API}/repos/${repo}/contents/${encodeURIComponent(path)}`;
  const body = { message, content, branch, ...(sha ? { sha } : {}) };
  const r = await fetch(url, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r;
};

// Commit a JSON document to a path on the given repo+branch.
// Retries once on 409 (stale-SHA race: read replicas can briefly serve the
// pre-commit SHA right after a write lands on the primary).
export const commitJson = async ({ gh, path, data, message }) => {
  const text = JSON.stringify(data, null, 2) + '\n';
  const content = utf8ToBase64(text);

  for (let attempt = 0; attempt < 2; attempt++) {
    const sha = await getFileSha({ ...gh, path });
    const r = await putFile({ ...gh, path, content, sha, message });
    if (r.ok) return r.json();
    if (r.status === 409 && attempt === 0) continue;
    throw new Error(`GitHub ${r.status} ${await r.text()}`);
  }
};
