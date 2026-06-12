import { MY_SCORE_TIERS } from '../lib/tiers';
import { PLATFORM_META, faviconUrl, simpleIconUrl } from '../lib/gamePlatforms';
import { Chip } from './Chip';
import { SearchBox } from './SearchBox';

const DECADE_DISPLAY_ORDER = ['2020s', '2010s', '2000s', '1990s', '1980s', 'Older'];

export const FilterSidebar = ({
  query, setQuery,
  years, toggleYear,
  genres, toggleGenre,
  languages, toggleLanguage,
  platforms, togglePlatform,
  myScoreTier, setMyScoreTier,
  facets,
  onClear,
  hasActive,
  activeTab,
  hideClearAll = false,
  hideSearch = false,
}) => {
  const availableDecades = DECADE_DISPLAY_ORDER.filter((d) => facets.years.includes(d));

  return (
    <aside className="glass-sidebar">
      <div className="sidebar-inner">
        {!hideSearch && (
          <div className="filter-section first">
            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder={`Search ${activeTab.toLowerCase()}…`}
            />
          </div>
        )}

        <div className="filter-section">
          <h4 className="filter-label">Johnyvino Score</h4>
          <div className="tier-slider">
            {MY_SCORE_TIERS.map((t, i) => (
              <button
                key={t.label}
                className={`tier-stop ${myScoreTier === i ? 'active' : ''}`}
                onClick={() => setMyScoreTier(i)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'Games' && facets.platforms?.length > 0 && (
          <div className="filter-section">
            <h4 className="filter-label">Platform</h4>
            <div className="chip-row">
              {facets.platforms.map(({ slug, label }) => {
                const meta = PLATFORM_META[slug] || {};
                const Lucide = meta.Lucide;
                const iconUrl = meta.iconDomain
                  ? faviconUrl(meta.iconDomain)
                  : meta.simpleIcon
                    ? simpleIconUrl(meta.simpleIcon)
                    : null;
                return (
                  <Chip
                    key={slug}
                    active={platforms.includes(slug)}
                    onClick={() => togglePlatform(slug)}
                  >
                    {iconUrl ? (
                      <img
                        src={iconUrl}
                        alt=""
                        width={12}
                        height={12}
                        className="chip-icon"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : Lucide ? (
                      <Lucide size={12} className="chip-icon" />
                    ) : null}
                    {meta.label || label}
                  </Chip>
                );
              })}
            </div>
          </div>
        )}

        {facets.languages.length > 0 && (
          <div className="filter-section">
            <h4 className="filter-label">Language</h4>
            <div className="chip-row">
              {facets.languages.map((l) => (
                <Chip key={l} active={languages.includes(l)} onClick={() => toggleLanguage(l)}>
                  {l}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div className="filter-section">
          <h4 className="filter-label">Year</h4>
          <div className="chip-row">
            {availableDecades.map((d) => (
              <Chip key={d} active={years.includes(d)} onClick={() => toggleYear(d)}>
                {d}
              </Chip>
            ))}
          </div>
        </div>

        {facets.genres.length > 0 && (
          <div className="filter-section">
            <h4 className="filter-label">Genres</h4>
            <div className="chip-row">
              {facets.genres.map((g) => (
                <Chip key={g} active={genres.includes(g)} onClick={() => toggleGenre(g)}>
                  {g}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {hasActive && !hideClearAll && (
          <div className="filter-section clear-section">
            <button className="clear-all-btn" onClick={onClear}>Clear all</button>
          </div>
        )}
      </div>
    </aside>
  );
};
