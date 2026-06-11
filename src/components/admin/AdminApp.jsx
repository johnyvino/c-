import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { Loader2, Plus, Save, Search, Settings, X } from 'lucide-react';
import { BADGE_FIELDS_FILM, BADGE_FIELDS_GAMES, badgeFieldsFor } from '../../lib/badges';
import { TABS, TYPE_FOR_TAB, ICON_FOR_TAB } from '../../lib/tabs';
import { commitJson } from '../../lib/github';
import { loadEdits, saveEdits } from '../../lib/storage';
import { useMoviesData } from '../../hooks/useMoviesData';
import { AdminCard } from './AdminCard';
import { AddModal } from './AddModal';
import { BadgeTray } from './BadgeTray';
import { CommitResultToast } from './CommitResultToast';
import { ConfirmDialog } from './ConfirmDialog';
import { searchAndScore } from '../../lib/search';

const REMOTE_PATH = 'src/data/movies.json';

export const AdminApp = ({ gh, apiKeys, openSettings }) => {
  const { data: moviesData, loading: moviesLoading, refetch } = useMoviesData({ gh });
  const [edits, setEdits] = useState(loadEdits);
  const [activeTab, setActiveTab] = useState('Movies');
  const [query, setQuery] = useState('');
  const [trayMovie, setTrayMovie] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [commitResult, setCommitResult] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => { saveEdits(edits); }, [edits]);

  const workingSet = useMemo(() => {
    const merged = moviesData.map((m) => ({ ...m, ...(edits[m.id] || {}) }));
    for (const id of Object.keys(edits)) {
      if (edits[id]?._isNew && !merged.find((m) => m.id === id)) {
        merged.push(edits[id]);
      }
    }
    return merged;
  }, [edits, moviesData]);

  const filtered = useMemo(() => {
    const typeKey = TYPE_FOR_TAB[activeTab];
    let data = workingSet.filter((m) => m.type === typeKey);
    if (query.trim()) data = searchAndScore(data, query);
    return query.trim() ? data : data.sort((a, b) => a.title.localeCompare(b.title));
  }, [workingSet, activeTab, query]);

  const editCount = Object.keys(edits).length;

  const patch = (id, fields) => {
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...fields } }));
  };

  const deleteOne = (id) => {
    if (edits[id]?._isNew) {
      setEdits((prev) => { const n = { ...prev }; delete n[id]; return n; });
    } else {
      patch(id, { _deleted: true });
    }
  };

  const resetAll = () => setDiscardOpen(true);
  const confirmDiscard = () => {
    setEdits({});
    setTrayMovie(null);
  };

  const addEntry = (entry) => {
    patch(entry.id, entry);
    setActiveTab(entry.type === 'movie' ? 'Movies' : entry.type === 'show' ? 'Shows' : 'Games');
  };

  // FB-reaction-style: only one badge active at a time. Tap the active one to clear.
  // Use the right set for the movie type so a game can't be tagged with film badges
  // and vice-versa — clearing all sets every previously-active key to false.
  const pickBadge = (id, key) => {
    const movie = workingSet.find((m) => m.id === id);
    if (!movie) return;
    const wasActive = !!movie[key];
    const fields = {};
    for (const b of [...BADGE_FIELDS_FILM, ...BADGE_FIELDS_GAMES]) {
      if (movie[b.key]) fields[b.key] = false;
    }
    if (!wasActive) fields[key] = true;
    patch(id, fields);
    setTrayMovie(null);
  };

  const setScoreFor = (id, value) => {
    const movie = workingSet.find((m) => m.id === id);
    patch(id, { ratings: { ...(movie?.ratings || {}), personal: value } });
  };

  const openTray = (id, e) => {
    setTrayMovie({ id, anchor: e.currentTarget.getBoundingClientRect() });
  };

  const saveToGitHub = async () => {
    setSaving(true);
    setSaveError(null);
    setCommitResult(null);
    try {
      const merged = workingSet
        .filter((m) => !m._deleted)
        .map((m) => {
          const clean = { ...m };
          delete clean._isNew;
          delete clean._deleted;
          return clean;
        });
      const message = `admin: update favorites (${editCount} change${editCount === 1 ? '' : 's'})`;
      const result = await commitJson({ gh, path: REMOTE_PATH, data: merged, message });
      setCommitResult({
        repo: gh.repo,
        commitUrl: result.commit?.html_url,
        fileUrl: result.content?.html_url,
      });
      setEdits({});
      refetch();
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-container admin-mode">
      {moviesLoading && (
        <div className="data-loading" role="status" aria-live="polite">
          <Loader2 size={14} className="spin" />
          <span>Syncing</span>
        </div>
      )}
      <div className="hero-banner">
        <div className="hero-content-wrap">
          <div className="header-content">
            <h1>
              <a
                className="brand-link"
                href="https://johnyvino.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Johnvino
              </a>
              's Admin
            </h1>
            <LayoutGroup>
              <div className="header-tabs">
                {TABS.map((id) => {
                  const count = workingSet.filter((m) => m.type === TYPE_FOR_TAB[id]).length;
                  const active = activeTab === id;
                  const Icon = ICON_FOR_TAB[id];
                  return (
                    <button
                      key={id}
                      className={`header-tab ${active ? 'active' : ''}`}
                      onClick={() => setActiveTab(id)}
                    >
                      {active && (
                        <motion.span
                          layoutId="header-tab-bg-admin"
                          className="header-tab-bg"
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        />
                      )}
                      <span className="header-tab-content">
                        <Icon size={15} />{id}
                        <span className="type-count">{count}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>
          </div>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-toolbar-inner">
          <div className="admin-search-wrap">
            <Search size={14} />
            <input
              type="text"
              aria-label="Search admin items"
              placeholder={`Search ${activeTab.toLowerCase()}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="admin-tool-actions">
            {editCount > 0 && (
              <span className="edit-count">
                {editCount} edit{editCount === 1 ? '' : 's'}
                <button className="reset-link" onClick={resetAll}>Discard</button>
              </span>
            )}
            <button
              className="admin-btn icon"
              onClick={openSettings}
              aria-label="Settings"
              title={`GitHub: ${gh.repo}`}
            >
              <Settings size={16} />
            </button>
            <button className="admin-btn ghost" onClick={() => setAddOpen(true)}>
              <Plus size={15} /> Add
            </button>
            <button
              className="admin-btn primary save"
              onClick={saveToGitHub}
              disabled={editCount === 0 || saving}
            >
              <Save size={15} />
              {saving ? 'Saving…' : `Save changes${editCount > 0 ? ` (${editCount})` : ''}`}
            </button>
          </div>
        </div>
      </div>

      {saveError && (
        <div className="admin-toast err">
          Save failed: {saveError}
          <button className="reset-link" onClick={() => setSaveError(null)}>Dismiss</button>
        </div>
      )}

      {commitResult && (
        <CommitResultToast result={commitResult} onClose={() => setCommitResult(null)} />
      )}

      <div className="layout admin-layout">
        <main className="main-content">
          <div className={`movie-grid ${activeTab === 'Games' ? 'games-grid' : ''}`}>
            {filtered.map((movie) => (
              <div key={movie.id} data-id={movie.id} className="movie-card-wrap">
                <AdminCard
                  movie={movie}
                  edited={!!edits[movie.id]}
                  onPosterClick={(e) => openTray(movie.id, e)}
                  onScore={(v) => setScoreFor(movie.id, v)}
                  onNotes={(v) => patch(movie.id, { notes: v })}
                  onDelete={() => deleteOne(movie.id)}
                  onRestore={() => patch(movie.id, { _deleted: false })}
                />
              </div>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="empty-state">No {activeTab.toLowerCase()} match.</div>
          )}
        </main>
      </div>

      <AnimatePresence>
        {trayMovie && (() => {
          const m = workingSet.find((x) => x.id === trayMovie.id);
          if (!m) return null;
          return (
            <BadgeTray
              key={trayMovie.id}
              movie={m}
              anchor={trayMovie.anchor}
              onPick={(key) => pickBadge(trayMovie.id, key)}
              onClose={() => setTrayMovie(null)}
            />
          );
        })()}
        {addOpen && (
          <AddModal
            defaultType={TYPE_FOR_TAB[activeTab]}
            apiKeys={apiKeys}
            openSettings={openSettings}
            onClose={() => setAddOpen(false)}
            onAdded={addEntry}
          />
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={discardOpen}
        title="Discard all edits?"
        message={`${editCount} local change${editCount === 1 ? '' : 's'} will be lost. This can't be undone.`}
        confirmLabel="Discard"
        destructive
        onConfirm={confirmDiscard}
        onClose={() => setDiscardOpen(false)}
      />
    </div>
  );
};
