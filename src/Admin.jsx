import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import './styles/tokens.css';
import './styles/app.css';
import './styles/admin.css';
import { loadGhConfig, saveGhConfig, loadApiKeys, saveApiKeys } from './lib/storage';
import { AdminApp } from './components/admin/AdminApp';
import { SettingsModal, DEFAULT_REPO, DEFAULT_BRANCH } from './components/admin/SettingsModal';

export default function Admin() {
  const initialGh = loadGhConfig();
  const initialKeys = loadApiKeys();
  const [token, setToken]   = useState(initialGh.token);
  const [repo, setRepo]     = useState(initialGh.repo   || DEFAULT_REPO);
  const [branch, setBranch] = useState(initialGh.branch || DEFAULT_BRANCH);
  const [apiKeys, setApiKeys] = useState(initialKeys);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const configured = !!token;

  const handleSave = (next) => {
    saveGhConfig({ token: next.token, repo: next.repo, branch: next.branch });
    saveApiKeys({ tmdb: next.tmdbKey, rawg: next.rawgKey });
    setToken(next.token);
    setRepo(next.repo);
    setBranch(next.branch);
    setApiKeys({ tmdb: next.tmdbKey, rawg: next.rawgKey });
    setSettingsOpen(false);
  };

  return (
    <>
      {configured && (
        <AdminApp
          gh={{ token, repo, branch }}
          apiKeys={apiKeys}
          openSettings={() => setSettingsOpen(true)}
        />
      )}
      <AnimatePresence>
        {(!configured || settingsOpen) && (
          <SettingsModal
            initial={{ token, repo, branch, tmdbKey: apiKeys.tmdb, rawgKey: apiKeys.rawg }}
            onSave={handleSave}
            onClose={() => setSettingsOpen(false)}
            dismissable={configured}
            simple={!configured}
          />
        )}
      </AnimatePresence>
    </>
  );
}
