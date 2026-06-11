import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { tierLabelFor } from '../lib/tiers';
import { pickPosterBadge } from '../lib/badges';
import { tmdbDetailsUrl, providerWatchUrl, shortProviderName, sortProvidersByPopularity } from '../lib/tmdb';
import { STORE_META, simpleIconUrl } from '../lib/gamePlatforms';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { usePosterTint } from '../hooks/usePosterTint';
import { useTmdbDetails } from '../hooks/useTmdbDetails';
import { GameMedia } from './GameMedia';
import { PhotoStrip } from './PhotoStrip';
import { PosterImage } from './PosterImage';

const TYPE_LABEL = { movie: 'Movie', show: 'Show', game: 'Game' };

// Cascade the meta-block contents in: title → notes → media → specs →
// platforms. Each child fades+rises in turn so the modal feels assembled, not
// dumped. Numbers are tuned to land just after the modal's scale-in finishes.
const META_PARENT = {
  hidden: { opacity: 1 },
  show: { opacity: 1, transition: { staggerChildren: 0.035, delayChildren: 0.14 } },
};
const META_ITEM = {
  hidden: { opacity: 0, y: 11 },
  show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] } },
};

const formatRuntime = (mins) => {
  if (!mins) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const scoreTier = (score) => (score >= 75 ? 'good' : score >= 50 ? 'mixed' : 'bad');

const IS_TOUCH = typeof window !== 'undefined'
  && window.matchMedia?.('(hover: none), (pointer: coarse)').matches;

export const DetailModal = ({ movie, onClose }) => {
  const tint = usePosterTint(movie?.poster);
  const modalRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  // Single TMDB+Watchmode round-trip on open. Returns empty defaults until the
  // response lands so the modal still renders immediately.
  const fetched = useTmdbDetails(movie);

  useBodyScrollLock(!!movie);
  useFocusTrap(modalRef, !!movie);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!movie) return null;

  // Prefer live-fetched fields when available; fall back to whatever the
  // movies.json row already has (works for old entries with cached cast, and
  // for games which never hit TMDB).
  const providers = sortProvidersByPopularity(fetched.providers.length ? fetched.providers : (movie.providers || []));
  const photos = fetched.photos.length ? fetched.photos : (movie.photos || []);
  const cast = fetched.cast.length ? fetched.cast : (movie.cast || []);
  const genres = fetched.genres.length ? fetched.genres : (movie.genres || []);
  const director = fetched.director ?? movie.director ?? null;
  const runtime = fetched.runtime ?? movie.runtime ?? null;
  const score = fetched.score ?? movie.score ?? null;

  const tier = tierLabelFor(movie.ratings?.personal);
  const typeLabel = TYPE_LABEL[movie.type] || 'Title';
  const badge = pickPosterBadge(movie);

  // A touch of poster vibrancy fades into the dark surface — the modal still
  // reads as "dark" but feels connected to the title.
  const tintStyle = tint
    ? {
        background: `linear-gradient(180deg, rgba(${tint.r},${tint.g},${tint.b},0.32) 0%, rgba(22,22,24,0.96) 65%)`,
        borderColor: `rgba(${tint.r},${tint.g},${tint.b},0.35)`,
      }
    : undefined;

  return (
    <>
      <motion.div
        className="detail-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <div className="detail-center-wrap" onClick={onClose}>
        <motion.div
          ref={modalRef}
          className="detail-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-modal-title"
          tabIndex={-1}
          style={tintStyle}
          onClick={(e) => e.stopPropagation()}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 20 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
          drag={IS_TOUCH && !prefersReducedMotion ? 'y' : false}
          dragDirectionLock
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            if (info.offset.y > 120 || info.velocity.y > 600) onClose();
          }}
        >
          {IS_TOUCH && <div className="detail-drag-handle" aria-hidden="true" />}
          <button className="detail-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>

          <div className="detail-poster-wrap">
            {(movie.posterVertical || movie.poster) && (
              <div
                className="detail-poster-glow"
                style={{ backgroundImage: `url(${movie.posterVertical || movie.poster})` }}
                aria-hidden="true"
              />
            )}
            {badge && (
              <img src={badge.src} alt={badge.alt} className="poster-badge badge-twist-solo detail-badge" />
            )}
            <div className="detail-poster">
              <PosterImage
                src={movie.posterVertical || movie.poster}
                alt={`Poster for ${movie.title}`}
                fallback={movie.title}
              />
            </div>
          </div>

          <motion.div
            className="detail-meta-block"
            variants={prefersReducedMotion ? undefined : META_PARENT}
            initial={prefersReducedMotion ? false : 'hidden'}
            animate={prefersReducedMotion ? false : 'show'}
          >
            <motion.h2 className="detail-title" id="detail-modal-title" variants={META_ITEM}>{movie.title}</motion.h2>
            <motion.p className="detail-meta" variants={META_ITEM}>
              {typeLabel}{movie.year ? `. ${movie.year}` : ''}{tier ? ` · ${tier}` : ''}
            </motion.p>

            {movie.notes && <motion.p className="detail-notes" variants={META_ITEM}>&ldquo;{movie.notes}&rdquo;</motion.p>}

            {movie.type === 'game' && <motion.div className="meta-stagger-row" variants={META_ITEM}><GameMedia game={movie} /></motion.div>}
            {movie.type !== 'game' && (photos.length > 0 || (fetched.loading && !movie.photos?.length)) && (
              <motion.div className="meta-stagger-row" variants={META_ITEM}>
                <PhotoStrip photos={photos} loading={fetched.loading && photos.length === 0} />
              </motion.div>
            )}

            {movie.type !== 'game' && (director || cast.length > 0 || runtime || genres.length > 0 || score != null) && (
              <motion.dl className="game-specs" variants={META_ITEM}>
                {director && (
                  <>
                    <dt>{movie.type === 'show' ? 'Creator' : 'Director'}</dt>
                    <dd title={director}>{director}</dd>
                  </>
                )}
                {cast.length > 0 && (
                  <>
                    <dt>Starring</dt>
                    <dd title={cast.join(', ')}>{cast.join(', ')}</dd>
                  </>
                )}
                {genres.length > 0 && (
                  <>
                    <dt>Genre</dt>
                    <dd title={genres.join(', ')}>{genres.slice(0, 3).join(', ')}</dd>
                  </>
                )}
                {runtime && (
                  <>
                    <dt>{movie.type === 'show' ? 'Episode' : 'Runtime'}</dt>
                    <dd>{formatRuntime(runtime)}</dd>
                  </>
                )}
                {score != null && (
                  <>
                    <dt>TMDB</dt>
                    <dd>
                      <span className={`mc-score mc-${scoreTier(score)}`}>{score}</span>
                    </dd>
                  </>
                )}
              </motion.dl>
            )}

            {movie.type === 'game' && (movie.developers?.length || movie.publishers?.length || movie.metacritic != null || movie.esrbRating || movie.playtime) && (
              <motion.dl className="game-specs" variants={META_ITEM}>
                {movie.developers?.length > 0 && (
                  <>
                    <dt>Developer</dt>
                    <dd title={movie.developers.join(', ')}>{movie.developers.join(', ')}</dd>
                  </>
                )}
                {movie.publishers?.length > 0 && (
                  <>
                    <dt>Publisher</dt>
                    <dd title={movie.publishers.join(', ')}>{movie.publishers.join(', ')}</dd>
                  </>
                )}
                {movie.metacritic != null && (
                  <>
                    <dt>Metacritic</dt>
                    <dd>
                      <span className={`mc-score mc-${scoreTier(movie.metacritic)}`}>
                        {movie.metacritic}
                      </span>
                    </dd>
                  </>
                )}
                {movie.esrbRating && (
                  <>
                    <dt>ESRB</dt>
                    <dd>{movie.esrbRating.name}</dd>
                  </>
                )}
                {movie.playtime && (
                  <>
                    <dt>Avg play</dt>
                    <dd>{movie.playtime}h</dd>
                  </>
                )}
              </motion.dl>
            )}

            {movie.type !== 'game' && providers.length > 0 && (
              <motion.div className="detail-platforms" aria-label="Watch on" variants={META_ITEM}>
                <div className="detail-platform-row is-scroll">
                  {providers.slice(0, 5).map((p) => {
                    const href = p.directUrl || providerWatchUrl(p, movie);
                    const iconSrc = p.logo_path
                      ? `https://image.tmdb.org/t/p/w92${p.logo_path}`
                      : (p.domain ? `https://www.google.com/s2/favicons?domain=${p.domain}&sz=64` : null);
                    return (
                      <a
                        key={p.provider_id}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="platform-chip store-chip"
                        title={`Watch "${movie.title}" on ${p.provider_name}`}
                      >
                        {iconSrc && (
                          <img
                            src={iconSrc}
                            alt=""
                            width={16}
                            height={16}
                            style={{ borderRadius: 4 }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                        {shortProviderName(p.provider_name)}
                      </a>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {movie.type !== 'game' && providers.length === 0 && movie.tmdbId && (
              <motion.div className="detail-platforms" aria-label="More info" variants={META_ITEM}>
                <div className="detail-platform-row is-scroll">
                  <a
                    href={tmdbDetailsUrl(movie)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="platform-chip store-chip"
                    title="View on TMDB"
                  >
                    <img
                      src="https://www.google.com/s2/favicons?domain=themoviedb.org&sz=64"
                      alt=""
                      width={16}
                      height={16}
                      style={{ borderRadius: 4 }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    TMDB
                  </a>
                </div>
              </motion.div>
            )}

            {movie.type === 'game' && movie.stores?.filter((s) => s.url && !STORE_META[s.slug]?.hidden).length > 0 && (
              <motion.div className="detail-platforms" aria-label="Get it on" variants={META_ITEM}>
                <div className="detail-platform-row is-scroll">
                  {movie.stores.filter((s) => s.url && !STORE_META[s.slug]?.hidden).slice(0, 5).map((s) => {
                    const meta = STORE_META[s.slug] || {};
                    const label = meta.label || s.name;
                    const iconUrl = s.domain
                      ? `https://www.google.com/s2/favicons?domain=${s.domain}&sz=64`
                      : (meta.simpleIcon ? simpleIconUrl(meta.simpleIcon) : null);
                    return (
                      <a
                        key={s.slug}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="platform-chip store-chip"
                        title={`Open on ${label}`}
                      >
                        {iconUrl ? (
                          <img
                            src={iconUrl}
                            alt=""
                            width={14}
                            height={14}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : null}
                        {label}
                      </a>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </>
  );
};
