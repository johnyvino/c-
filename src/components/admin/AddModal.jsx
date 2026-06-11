import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Film, Gamepad2, Search, Tv, X } from 'lucide-react';
import { RAWG_BASE } from '../../lib/rawg';
import { useFocusTrap } from '../../hooks/useFocusTrap';

// Admin-only TMDB + RAWG search. API keys come in via props from the admin's
// own localStorage — they are NOT bundled into the deployed JS, so deploying
// the admin chunk doesn't leak credentials to public visitors.
const TMDB_BASE = 'https://api.themoviedb.org/3';

// Two-letter ISO → human label. Fallback is the uppercased code.
const LANG_NAMES = {
  en: 'English', ta: 'Tamil', hi: 'Hindi', te: 'Telugu', ml: 'Malayalam',
  kn: 'Kannada', ko: 'Korean', ja: 'Japanese', zh: 'Chinese', cn: 'Chinese',
  fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese',
  ru: 'Russian', tr: 'Turkish', ar: 'Arabic', th: 'Thai', vi: 'Vietnamese',
};

const slugify = (s) =>
  s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const TYPE_TABS = [
  { key: 'movie', label: 'Movie', Icon: Film },
  { key: 'show',  label: 'Show',  Icon: Tv },
  { key: 'game',  label: 'Game',  Icon: Gamepad2 },
];

const tmdbToEntry = (d, ourType) => {
  const tmdbType = ourType === 'show' ? 'tv' : 'movie';
  const title = d.title || d.name;
  const dateField = tmdbType === 'tv' ? 'first_air_date' : 'release_date';
  const year = d[dateField] ? parseInt(d[dateField].slice(0, 4), 10) : null;
  const slug = slugify(`${title}-${year ?? ''}`);
  return {
    id: `${ourType}-${slug}`,
    slug,
    title,
    originalTitle: d.original_title || d.original_name || null,
    year,
    type: ourType,
    poster: d.poster_path ? `https://image.tmdb.org/t/p/w342${d.poster_path}` : null,
    genres: d.genres?.map((g) => g.name) || [],
    language: d.original_language ? (LANG_NAMES[d.original_language] || d.original_language.toUpperCase()) : null,
    runtime: d.runtime ?? null,
    seasons: d.number_of_seasons ?? null,
    episodes: d.number_of_episodes ?? null,
    overview: d.overview || '',
    ratings: {
      tmdb: d.vote_average != null ? Number(d.vote_average.toFixed(1)) : null,
      voteCount: d.vote_count || 0,
      personal: null,
    },
    popularity: d.popularity || 0,
    tmdbId: d.id,
    twist: false, scary: false, intense: false, mindbending: false, clever: false,
    _isNew: true,
  };
};

const rawgToEntry = (d) => {
  const year = d.released ? parseInt(d.released.slice(0, 4), 10) : null;
  const slug = d.slug || slugify(`${d.name}-${year ?? ''}`);
  return {
    id: `game-${slug}`,
    slug,
    title: d.name,
    originalTitle: d.name,
    year,
    type: 'game',
    poster: d.background_image || null,
    genres: (d.genres || []).map((g) => g.name),
    language: null,
    runtime: null,
    seasons: null,
    episodes: null,
    overview: d.description_raw || null,
    ratings: { tmdb: null, voteCount: d.ratings_count || 0, personal: null },
    popularity: d.added || 0,
    tmdbId: null,
    detailsUrl: `https://rawg.io/games/${slug}`,
    twist: false, scary: false, intense: false, mindbending: false, clever: false,
    _isNew: true,
  };
};

const buildGameEntry = ({ title, year, genres, detailsUrl }) => {
  const slug = slugify(`${title}-${year ?? ''}`);
  return {
    id: `game-${slug}`,
    slug,
    title,
    originalTitle: title,
    year: year ?? null,
    type: 'game',
    poster: null,
    genres: genres
      ? genres.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    language: null,
    runtime: null,
    seasons: null,
    episodes: null,
    overview: null,
    ratings: { tmdb: null, voteCount: 0, personal: null },
    popularity: 0,
    tmdbId: null,
    detailsUrl: detailsUrl || null,
    twist: false, scary: false, intense: false, mindbending: false, clever: false,
    _isNew: true,
  };
};

// Accept full TMDb URL, partial path, or just a numeric id.
const extractTmdbId = (input) => {
  const urlMatch = input.match(/(?:movie|tv)\/(\d+)/);
  if (urlMatch) return urlMatch[1];
  const numMatch = input.trim().match(/^\d+$/);
  if (numMatch) return numMatch[0];
  return null;
};

export const AddModal = ({ onClose, onAdded, defaultType = 'movie', apiKeys, openSettings }) => {
  const tmdbKey = apiKeys?.tmdb || '';
  const rawgKey = apiKeys?.rawg || '';
  const [type, setType] = useState(defaultType);
  // tmdb (movie/show)
  const [input, setInput] = useState('');
  // rawg search (game)
  const [gameQuery, setGameQuery] = useState('');
  const [gameResults, setGameResults] = useState([]);
  const [gameSearching, setGameSearching] = useState(false);
  const [gamePicking, setGamePicking] = useState(false);
  // manual fallback (game)
  const [manual, setManual] = useState(false);
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [genres, setGenres] = useState('');
  const [detailsUrl, setDetailsUrl] = useState('');

  const [status, setStatus] = useState(null);
  const fetching = status?.ok === null;
  const modalRef = useRef(null);
  useFocusTrap(modalRef, true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Debounced RAWG search.
  useEffect(() => {
    if (type !== 'game' || manual) return;
    const q = gameQuery.trim();
    if (q.length < 2) { setGameResults([]); setGameSearching(false); return; }
    if (!rawgKey) { setGameResults([]); setGameSearching(false); return; }
    let cancelled = false;
    setGameSearching(true);
    const t = setTimeout(async () => {
      try {
        const url = new URL(`${RAWG_BASE}/games`);
        url.searchParams.set('key', rawgKey);
        url.searchParams.set('search', q);
        url.searchParams.set('page_size', '8');
        const res = await fetch(url);
        if (!res.ok) throw new Error(`RAWG ${res.status}`);
        const json = await res.json();
        if (!cancelled) setGameResults(json.results || []);
      } catch {
        if (!cancelled) setGameResults([]);
      } finally {
        if (!cancelled) setGameSearching(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [type, manual, gameQuery, rawgKey]);

  const switchType = (t) => {
    if (t === type) return;
    setType(t);
    setStatus(null);
  };

  const pickGame = async (slugOrId) => {
    if (gamePicking) return;
    if (!rawgKey) {
      setStatus({ ok: false, msg: 'Add your RAWG API key in Settings → Advanced.' });
      return;
    }
    setGamePicking(true);
    setStatus({ ok: null, msg: 'Fetching…' });
    try {
      const url = new URL(`${RAWG_BASE}/games/${slugOrId}`);
      url.searchParams.set('key', rawgKey);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`RAWG ${res.status}`);
      const entry = rawgToEntry(await res.json());
      onAdded(entry);
      setStatus({ ok: true, msg: `Added: ${entry.title}${entry.year ? ` (${entry.year})` : ''}` });
      setGameQuery('');
      setGameResults([]);
    } catch (e) {
      setStatus({ ok: false, msg: e.message });
    } finally {
      setGamePicking(false);
    }
  };

  const submit = async () => {
    if (fetching) return;

    if (type === 'game') {
      if (!manual) return; // search picks via list
      if (!title.trim()) {
        setStatus({ ok: false, msg: 'Title is required.' });
        return;
      }
      let yr = null;
      if (year.trim()) {
        const parsed = parseInt(year, 10);
        if (Number.isNaN(parsed)) {
          setStatus({ ok: false, msg: 'Year must be a number.' });
          return;
        }
        yr = parsed;
      }
      const entry = buildGameEntry({
        title: title.trim(),
        year: yr,
        genres,
        detailsUrl: detailsUrl.trim() || null,
      });
      onAdded(entry);
      setStatus({ ok: true, msg: `Added: ${entry.title}${entry.year ? ` (${entry.year})` : ''}` });
      setTitle(''); setYear(''); setGenres(''); setDetailsUrl('');
      return;
    }

    const id = extractTmdbId(input);
    if (!id) {
      setStatus({ ok: false, msg: 'Need a TMDb URL or numeric id.' });
      return;
    }
    if (!tmdbKey) {
      setStatus({ ok: false, msg: 'Add your TMDB API key in Settings → Advanced.' });
      return;
    }
    const tmdbType = type === 'show' ? 'tv' : 'movie';
    setStatus({ ok: null, msg: 'Fetching…' });
    try {
      const url = new URL(`${TMDB_BASE}/${tmdbType}/${id}`);
      url.searchParams.set('api_key', tmdbKey);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`TMDb ${res.status}`);
      const entry = tmdbToEntry(await res.json(), type);
      onAdded(entry);
      setStatus({ ok: true, msg: `Added: ${entry.title} (${entry.year || '?'})` });
      setInput('');
    } catch (e) {
      setStatus({ ok: false, msg: e.message });
    }
  };

  const heading = type === 'game' ? 'Add Game' : type === 'show' ? 'Add Show' : 'Add Movie';
  const showSubmit = type !== 'game' || manual;
  const submitLabel = type === 'game' ? 'Add game' : (fetching ? 'Fetching…' : 'Fetch');
  const submitDisabled = type === 'game' ? !title.trim() : (fetching || !input.trim());

  return (
    <motion.div
      className="add-modal-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        ref={modalRef}
        className="add-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-modal-title"
        tabIndex={-1}
        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="add-head">
          <h2 id="add-modal-title">{heading}</h2>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="add-type-tabs" role="tablist" aria-label="Entry type">
          {TYPE_TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={type === key}
              className={`add-type-tab ${type === key ? 'active' : ''}`}
              onClick={() => switchType(key)}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {type === 'game' && !manual && (
          <>
            <p className="add-hint">Search RAWG — pick a result to autofill everything.</p>
            <div className="rawg-search-wrap">
              <Search size={14} />
              <input
                type="text"
                autoFocus
                aria-label="Search RAWG"
                placeholder="e.g. Hollow Knight"
                value={gameQuery}
                onChange={(e) => setGameQuery(e.target.value)}
              />
              {gameSearching && <span className="rawg-spinner" aria-hidden="true" />}
            </div>

            {gameResults.length > 0 && (
              <ul className="rawg-results" role="listbox">
                {gameResults.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      className="rawg-result"
                      onClick={() => pickGame(g.slug || g.id)}
                      disabled={gamePicking}
                    >
                      <span
                        className="rawg-thumb"
                        style={g.background_image ? { backgroundImage: `url(${g.background_image})` } : undefined}
                      />
                      <span className="rawg-meta">
                        <span className="rawg-title">{g.name}</span>
                        <span className="rawg-sub">
                          {g.released ? g.released.slice(0, 4) : '—'}
                          {g.genres?.length ? ` · ${g.genres.slice(0, 2).map((x) => x.name).join(', ')}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {gameQuery.trim().length >= 2 && !gameSearching && gameResults.length === 0 && (
              <p className="add-status">No matches on RAWG.</p>
            )}

            <button
              type="button"
              className="settings-advanced"
              onClick={() => { setManual(true); setStatus(null); }}
            >
              Can't find it? Add manually →
            </button>
          </>
        )}

        {type === 'game' && manual && (
          <>
            <p className="add-hint">
              Manual entry. Run <code>npm run fetch-game-posters</code> later to grab cover art.
            </p>
            <input
              type="text"
              autoFocus
              aria-label="Title"
              placeholder="Title (required)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
            <input
              type="text"
              inputMode="numeric"
              aria-label="Year"
              placeholder="Year (optional)"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
            <input
              type="text"
              aria-label="Genres"
              placeholder="Genres, comma-separated (optional)"
              value={genres}
              onChange={(e) => setGenres(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
            <input
              type="text"
              aria-label="Details URL"
              placeholder="IGDB / details URL (optional)"
              value={detailsUrl}
              onChange={(e) => setDetailsUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
            <button
              type="button"
              className="settings-advanced"
              onClick={() => { setManual(false); setStatus(null); }}
            >
              ← Back to RAWG search
            </button>
          </>
        )}

        {type !== 'game' && (
          <>
            <p className="add-hint">
              Paste a TMDb {type === 'show' ? 'TV' : 'movie'} URL (or just the id). The selected tab decides the type — pick <strong>Show</strong> here to file it as a show even if the URL says <code>/movie/</code>.
            </p>
            <input
              type="text"
              autoFocus
              aria-label="TMDb URL or id"
              placeholder={type === 'show'
                ? 'https://www.themoviedb.org/tv/456'
                : 'https://www.themoviedb.org/movie/123'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
          </>
        )}

        {showSubmit && (
          <button className="add-fetch" onClick={submit} disabled={submitDisabled}>
            {submitLabel}
          </button>
        )}

        {status && (
          <p className={`add-status ${status.ok === true ? 'ok' : status.ok === false ? 'err' : ''}`}>
            {status.msg}
          </p>
        )}
      </motion.div>
    </motion.div>
  );
};
