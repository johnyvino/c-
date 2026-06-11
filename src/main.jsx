/* eslint-disable react-refresh/only-export-components */
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import App from './App.jsx';

const Admin = lazy(() => import('./Admin.jsx'));

const isAdminRoute = () => window.location.pathname.replace(/\/$/, '') === '/admin';

const Root = () => (
  isAdminRoute() ? (
    <Suspense fallback={<div style={{ padding: 40, color: '#999' }}>Loading admin…</div>}>
      <Admin />
    </Suspense>
  ) : (
    <App />
  )
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
