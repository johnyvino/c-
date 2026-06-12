import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SlidersHorizontal } from 'lucide-react';
import './styles/tokens.css';
import './styles/app.css';
import { TYPE_FOR_TAB, computeTabCounts } from './lib/tabs';
import { tierLabelFor, MY_SCORE_TIERS } from './lib/tiers';
import { yearBucket, SHUFFLE_KEY } from './lib/filters';
import { pickPosterBadge } from './lib/badges';
import { HIDDEN_PLATFORM_SLUGS } from './lib/gamePlatforms';
import { searchAndScore } from './lib/search';
import { useBodyScrollLock } from './hooks/useBodyScrollLock';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { useGridColumns } from './hooks/useGridColumns';
import { useMoviesData } from './hooks/useMoviesData';
import { DetailModal } from './components/DetailModal';
import { FilterSidebar } from './components/FilterSidebar';
import { Footer } from './components/Footer';
import { HeroBanner } from './components/HeroBanner';
import { MobileFilterSheet } from './components/MobileFilterSheet';
import { MovieCard } from './components/MovieCard';
import { SearchBox } from './components/SearchBox';
import { SubmitModal } from './components/SubmitModal';

// Build the chip facets for the current tab. Genres: ≥3 titles, top 10 by count.
const computeFacets = (activeTab, moviesData) => {
  const yearOrder = ['2020s', '2010s', '2000s', '1990s', '1980s', 'Older'];
  const ySet = new Set();
  const genreCount = new Map();
  const langCount = new Map();
  const platformCount = new Map();
  const platformLabel = new Map();
  const typeKey = TYPE_FOR_TAB[activeTab];

  for (const m of moviesData) {
    if (m.type !== typeKey) continue;
    const b = yearBucket(m.year);
    if (b) ySet.add(b);
    for (const g of m.genres || []) genreCount.set(g, (genreCount.get(g) || 0) + 1);
    if (m.language) langCount.set(m.language, (langCount.get(m.language) || 0) + 1);
    for (const p of m.platforms || []) {
      platformCount.set(p.slug, (platformCount.get(p.slug) || 0) + 1);
      if (!platformLabel.has(p.slug)) platformLabel.set(p.slug, p.name);
    }
  }

  const MIN_GENRE = 3, MAX_GENRES = 10, MIN_LANG = 2;
  const genres = [...genreCount.entries()]
    .filter(([, n]) => n >= MIN_GENRE)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_GENRES)
    .map(([k]) => k);
  const languages = [...langCount.entries()]
    .filter(([, n]) => n >= MIN_LANG)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
  const platforms = [...platformCount.entries()]
    .filter(([slug]) => !HIDDEN_PLATFORM_SLUGS.has(slug))
    .sort((a, b) => b[1] - a[1])
    .map(([slug]) => ({ slug, label: platformLabel.get(slug) }));

  return {
    years: yearOrder.filter((y) => ySet.has(y)),
    genres,
    languages,
    platforms,
  };
};

export default function App() {
  const { data: moviesData, loading: moviesLoading } = useMoviesData();
  const [activeTab, setActiveTab] = useState('Movies');
  const [query, setQuery] = useState('');
  // Filter/sort/spread is O(n) over ~250 items — running it on every keystroke
  // makes typing feel laggy. Debounce so it only runs after the user pauses.
  const debouncedQuery = useDebouncedValue(query, 120);
  const [years, setYears] = useState([]);
  const [genres, setGenres] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [myScoreTier, setMyScoreTier] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);

  const [gridRef, columns] = useGridColumns(5, activeTab);
  useBodyScrollLock(sheetOpen);

  // Per-card lift+stagger entrance should only fire on tab switches, not on
  // every filter chip tap (otherwise filtering feels like the tab just opened).
  // `runIntro` is true for ~600ms after `activeTab` flips; cards mounting
  // outside that window do a plain quick fade.
  const [introTab, setIntroTab] = useState(activeTab);
  useEffect(() => {
    setIntroTab(activeTab);
    const t = setTimeout(() => setIntroTab(null), 600);
    return () => clearTimeout(t);
  }, [activeTab]);
  const runIntro = introTab === activeTab;

  const toggleYear = useCallback((v) =>
    setYears((arr) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])), []);
  const toggleGenre = useCallback((v) =>
    setGenres((arr) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])), []);
  const toggleLanguage = useCallback((v) =>
    setLanguages((arr) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])), []);
  const togglePlatform = useCallback((v) =>
    setPlatforms((arr) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])), []);
  const openMovie = useCallback((m) => setSelectedMovie(m), []);
  const closeMovie = useCallback(() => setSelectedMovie(null), []);

  const facets = useMemo(() => computeFacets(activeTab, moviesData), [activeTab, moviesData]);
  const tabCounts = useMemo(() => computeTabCounts(moviesData), [moviesData]);

  const filtered = useMemo(() => {
    const typeKey = TYPE_FOR_TAB[activeTab];
    let data = moviesData.filter((m) => m.type === typeKey);

    if (debouncedQuery.trim()) {
      data = searchAndScore(data, debouncedQuery);
    }
    if (years.length) data = data.filter((m) => years.includes(yearBucket(m.year)));
    if (genres.length) data = data.filter((m) => m.genres?.some((g) => genres.includes(g)));
    if (languages.length) data = data.filter((m) => languages.includes(m.language));
    if (platforms.length) data = data.filter((m) => m.platforms?.some((p) => platforms.includes(p.slug)));
    // Score filter matches the exact tier (not >= min) so picking "Great" shows
    // only Great titles — not Great + Amazing.
    if (myScoreTier > 0) {
      const wantedTier = MY_SCORE_TIERS[myScoreTier].label;
      data = data.filter((m) => tierLabelFor(m.ratings?.personal) === wantedTier);
    }
    // Stable shuffle — same deck for the whole session, regardless of filters.
    // Skipped during search so the relevance ordering from searchAndScore wins.
    const sorted = debouncedQuery.trim()
      ? data.slice()
      : data.slice().sort((a, b) => (SHUFFLE_KEY.get(a.id) ?? 0) - (SHUFFLE_KEY.get(b.id) ?? 0));
    // Spread badged titles so two are never adjacent in the flat list (which
    // also prevents same-row neighbors at any column count). Greedy: walk the
    // list; if consecutive items are both badged, swap the second with the
    // next non-badged item ahead. Falls through cleanly if it can't separate
    // (unlikely with ~28% badge density).
    for (let i = 0; i < sorted.length - 1; i++) {
      if (pickPosterBadge(sorted[i]) && pickPosterBadge(sorted[i + 1])) {
        let j = i + 2;
        while (j < sorted.length && pickPosterBadge(sorted[j])) j++;
        if (j >= sorted.length) break;
        [sorted[i + 1], sorted[j]] = [sorted[j], sorted[i + 1]];
      }
    }
    return sorted;
  }, [activeTab, debouncedQuery, years, genres, languages, platforms, myScoreTier, moviesData]);

  const hasActive = !!(query || years.length || genres.length || languages.length || platforms.length || myScoreTier > 0);
  // FAB dot is a "filters applied" indicator — search is now a sibling row
  // on mobile (not inside the sheet), so a typed query shouldn't paint the
  // dot. Keep `hasActive` (includes query) for the Clear-all visibility,
  // which legitimately resets the whole state.
  const hasActiveFilters = !!(years.length || genres.length || languages.length || platforms.length || myScoreTier > 0);

  const onClear = useCallback(() => {
    setQuery(''); setYears([]); setGenres([]); setLanguages([]); setPlatforms([]); setMyScoreTier(0);
  }, []);

  // Switching tabs drops filters that wouldn't make sense on the new tab.
  const handleTabSwitch = useCallback((newTab) => {
    if (newTab === activeTab) return;
    setQuery('');
    setYears([]);
    setGenres([]);
    setLanguages([]);
    setPlatforms([]);
    setMyScoreTier(0);
    setActiveTab(newTab);
  }, [activeTab]);

  const sidebarProps = {
    query, setQuery,
    years, toggleYear,
    genres, toggleGenre,
    languages, toggleLanguage,
    platforms, togglePlatform,
    myScoreTier, setMyScoreTier,
    facets, onClear, hasActive,
    activeTab,
  };

  return (
    <div className="app-container">
      {moviesLoading && <div className="data-loading" role="status">Syncing…</div>}
      <HeroBanner
        activeTab={activeTab}
        counts={tabCounts}
        onTabChange={handleTabSwitch}
        onRecommend={() => setSubmitOpen(true)}
      />

      <div className="mobile-search-bar">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder={`Search ${activeTab.toLowerCase()}…`}
        />
      </div>

      <div className="layout">
        <main className="main-content">
          <div ref={gridRef} className={`movie-grid ${activeTab === 'Games' ? 'games-grid' : ''}`}>
            {filtered.map((movie, i) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                index={i}
                columns={columns}
                activeTierFilter={myScoreTier > 0 ? MY_SCORE_TIERS[myScoreTier].label : null}
                onOpen={openMovie}
                runIntro={runIntro}
              />
            ))}
          </div>

          {filtered.length === 0 && !moviesLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="empty-state"
            >
              No {activeTab.toLowerCase()} match these filters.
            </motion.div>
          )}
        </main>

        <FilterSidebar {...sidebarProps} />
      </div>

      <motion.button
        className={`mobile-filter-fab ${hasActiveFilters ? 'has-active' : ''}`}
        onClick={() => setSheetOpen(true)}
        aria-label="Open filters"
        animate={{ rotate: sheetOpen ? 90 : 0 }}
        whileHover={{ scale: 1.06, y: -2 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      >
        <SlidersHorizontal size={20} />
      </motion.button>

      <AnimatePresence>
        {sheetOpen && <MobileFilterSheet key="sheet" {...sidebarProps} onClose={() => setSheetOpen(false)} />}
        {submitOpen && <SubmitModal key="submit" onClose={() => setSubmitOpen(false)} />}
        {selectedMovie && <DetailModal key="detail" movie={selectedMovie} onClose={closeMovie} />}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
