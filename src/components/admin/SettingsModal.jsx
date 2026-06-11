import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export const DEFAULT_REPO = 'johnyvino/c-';
export const DEFAULT_BRANCH = 'main';

export const SettingsModal = ({ initial, onSave, onClose, dismissable, simple }) => {
  const [token, setToken]   = useState(initial.token  || '');
  const [repo, setRepo]     = useState(initial.repo   || DEFAULT_REPO);
  const [branch, setBranch] = useState(initial.branch || DEFAULT_BRANCH);
  const [tmdbKey, setTmdbKey] = useState(initial.tmdbKey || '');
  const [rawgKey, setRawgKey] = useState(initial.rawgKey || '');
  const [err, setErr] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const modalRef = useRef(null);
  useFocusTrap(modalRef, true);

  const save = () => {
    if (!token.trim()) return setErr('Token is required.');
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo.trim())) return setErr('Repo must be in "owner/name" form.');
    setErr(null);
    onSave({
      token: token.trim(),
      repo: repo.trim(),
      branch: branch.trim() || 'main',
      tmdbKey: tmdbKey.trim(),
      rawgKey: rawgKey.trim(),
    });
  };

  return (
    <motion.div
      className="add-modal-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={dismissable ? onClose : undefined}
    >
      <motion.div
        ref={modalRef}
        className="add-modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        tabIndex={-1}
        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="add-head">
          <h2 id="settings-modal-title">{simple ? 'Sign in' : 'GitHub access'}</h2>
          {dismissable && <button onClick={onClose} aria-label="Close"><X size={18} /></button>}
        </div>
        {!simple && (
          <p className="add-hint">
            Paste your GitHub personal access token. Create one at{' '}
            <a
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/settings/personal-access-tokens
            </a>{' '}
            with <b>Contents: Read &amp; Write</b> on this repo.
          </p>
        )}

        <label className="settings-label" htmlFor="settings-token">
          {simple ? 'Password' : 'Personal access token'}
        </label>
        <input
          id="settings-token"
          type="password"
          value={token}
          autoFocus
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          placeholder={simple ? '' : 'github_pat_...'}
          autoComplete="off"
        />

        {!simple || showAdvanced ? (
          <>
            <label className="settings-label" htmlFor="settings-repo">Repository</label>
            <input
              id="settings-repo"
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="owner/repo"
            />
            <label className="settings-label" htmlFor="settings-branch">Branch</label>
            <input
              id="settings-branch"
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
            />
            <label className="settings-label" htmlFor="settings-tmdb">TMDB API key (admin search only)</label>
            <input
              id="settings-tmdb"
              type="password"
              value={tmdbKey}
              onChange={(e) => setTmdbKey(e.target.value)}
              placeholder="v3 api key"
              autoComplete="off"
            />
            <label className="settings-label" htmlFor="settings-rawg">RAWG API key (admin search only)</label>
            <input
              id="settings-rawg"
              type="password"
              value={rawgKey}
              onChange={(e) => setRawgKey(e.target.value)}
              placeholder="rawg api key"
              autoComplete="off"
            />
          </>
        ) : (
          <button className="settings-advanced" onClick={() => setShowAdvanced(true)}>
            Advanced
          </button>
        )}

        {err && <p className="add-status err">{err}</p>}

        <button className="add-fetch" onClick={save}>{simple ? 'Sign in' : 'Save'}</button>
        {!simple && (
          <p className="settings-foot">
            Stored locally in your browser. Never sent anywhere except GitHub's API and (for admin search) TMDB/RAWG.
          </p>
        )}
      </motion.div>
    </motion.div>
  );
};
