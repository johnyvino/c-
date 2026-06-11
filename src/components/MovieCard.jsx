import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { Check, Copy, Play } from 'lucide-react';
import { tierLabelFor } from '../lib/tiers';
import { pickPosterBadge } from '../lib/badges';
import { useInViewOnce } from '../hooks/useInViewOnce';
import { PosterImage } from './PosterImage';

// Coarse-pointer (touch) devices: drop the entrance animation entirely. Spring
// + stagger across hundreds of cards is what makes the grid feel sluggish on
// phones; off-screen cards already get `content-visibility: auto`.
const IS_TOUCH = typeof window !== 'undefined'
  && window.matchMedia?.('(hover: none), (pointer: coarse)').matches;

// Max tilt in degrees — kept gentle so the parallax reads as polish, not a toy.
const TILT_MAX = 7;
const TILT_SPRING = { stiffness: 220, damping: 18, mass: 0.6 };

export const MovieCard = memo(({ movie, index = 0, columns = 5, activeTierFilter = null, onOpen, runIntro = true }) => {
  const personal = movie.ratings?.personal;
  const personalTier = tierLabelFor(personal);
  const [copied, setCopied] = useState(false);
  const [hovering, setHovering] = useState(false);

  // Mouse-driven 3D tilt on the poster face. MotionValues + a spring keep the
  // motion smooth without forcing React re-renders on every pointermove.
  const tiltXRaw = useMotionValue(0);
  const tiltYRaw = useMotionValue(0);
  const tiltX = useSpring(tiltXRaw, TILT_SPRING);
  const tiltY = useSpring(tiltYRaw, TILT_SPRING);

  const copyTitle = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(movie.title).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  const [ref, inView] = useInViewOnce('160px');
  // Touch-only: skip the IO entirely and consider it visible immediately —
  // matches the prior IS_TOUCH bypass. The shared observer above also handles
  // this if we let it run, but the explicit short-circuit keeps the first
  // paint snappy.
  const visible = IS_TOUCH || inView;
  const [delay, setDelay] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!visible || delay !== 0) return;
    const row = Math.floor(index / columns);
    const col = index % columns;
    const d = prefersReducedMotion ? 0 : Math.min(row * 0.04 + col * 0.02, 0.24);
    setDelay(d);
  }, [visible, delay, index, columns, prefersReducedMotion]);

  const hideOwnTier = activeTierFilter && personalTier === activeTierFilter;
  const secondaryBadge = pickPosterBadge(movie);
  const showTierPill = personalTier && !hideOwnTier && !secondaryBadge;
  const openDetails = useCallback(() => onOpen?.(movie), [onOpen, movie]);

  const enableTilt = !IS_TOUCH && !prefersReducedMotion;
  const onPointerMove = useCallback((e) => {
    if (!enableTilt) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;   // -0.5 .. 0.5
    const py = (e.clientY - r.top) / r.height - 0.5;
    // rotateX is inverted: cursor near the top should tilt the top of the card
    // *toward* the viewer, which is a negative rotateX in screen-space.
    tiltXRaw.set(-py * TILT_MAX * 2);
    tiltYRaw.set(px * TILT_MAX * 2);
  }, [enableTilt, tiltXRaw, tiltYRaw]);
  const resetTilt = useCallback(() => {
    tiltXRaw.set(0);
    tiltYRaw.set(0);
  }, [tiltXRaw, tiltYRaw]);

  const isGame = movie.type === 'game';
  const rawHero = movie.poster || movie.screenshots?.[0] || null;
  // Append a static version tag to local poster URLs so browsers can't keep
  // serving stale cached failed-load entries from the previous file the path
  // pointed at (the sync script overwrites posters, and some browsers stick
  // to the failed result they cached during the brief replace window).
  const heroImage = rawHero && rawHero.startsWith('/posters/')
    ? `${rawHero}?v=2`
    : rawHero;
  const hasVideo = isGame && (movie.videos?.[0]?.low || movie.videos?.[0]?.high);
  // Cycle through up to 4 screenshots on hover (RAWG-style). Use the entries
  // in order — first one already serves as the static base image, so we skip
  // it in the cycle to avoid a no-op frame. Memoized so the hover-cycle effect
  // below doesn't tear down its interval on every parent render.
  const cycleShots = useMemo(
    () => isGame
      ? (movie.screenshots || []).filter((s) => s !== heroImage).slice(0, 4)
      : [],
    [isGame, movie.screenshots, heroImage],
  );
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!hovering || cycleShots.length === 0) {
      setFrame(0);
      return;
    }
    // Kick off fetch + decode the moment the user hovers — by the time the
    // first cycle tick fires (800ms later), the next frame is decoded and the
    // crossfade can run without the half-loaded blur-and-pop flicker.
    cycleShots.forEach((src) => {
      const img = new Image();
      img.src = src;
      img.decode?.().catch(() => {});
    });
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % cycleShots.length);
    }, 800);
    return () => clearInterval(id);
  }, [hovering, cycleShots]);

  return (
    <motion.div
      ref={ref}
      data-id={movie.id}
      className={`movie-card ${isGame ? 'game-card' : ''}`}
      initial={IS_TOUCH || !runIntro ? false : { opacity: 0, y: 8 }}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      transition={{
        duration: runIntro ? 0.28 : 0,
        ease: [0.22, 1, 0.36, 1],
        delay: runIntro ? delay : 0,
      }}
      // Real spring on hover — overshoots, settles. CSS hover would be
      // overridden by Motion's inline transform, so drive both lift + scale
      // through Motion's `whileHover`.
      whileHover={IS_TOUCH ? undefined : {
        y: -8,
        scale: 1.08,
        transition: { type: 'spring', stiffness: 270, damping: 16, mass: 0.7 },
      }}
      style={{ zIndex: hovering ? 10 : 1 }}
      onMouseEnter={IS_TOUCH ? undefined : () => setHovering(true)}
      onMouseLeave={IS_TOUCH ? undefined : () => { setHovering(false); resetTilt(); }}
      onMouseMove={onPointerMove}
    >
      <motion.div
        className="movie-card-inner"
        onClick={openDetails}
        role="link"
        tabIndex={0}
        whileTap={IS_TOUCH ? undefined : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={enableTilt ? { rotateX: tiltX, rotateY: tiltY } : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDetails();
          }
        }}
      >
        {secondaryBadge && (
          <img
            src={secondaryBadge.src}
            alt={secondaryBadge.alt}
            className="poster-badge badge-twist-solo"
          />
        )}
        <div className={`poster-container ${isGame ? 'horizontal' : ''}`}>
          {showTierPill && (
            <div className={`rating-badge tier-${personalTier.toLowerCase()}`}>
              <span className="badge-dot" />
              <span>{personalTier}</span>
            </div>
          )}
          <PosterImage
            src={heroImage}
            alt={`Poster for ${movie.title}${movie.year ? ` (${movie.year})` : ''}`}
            fallback={movie.title}
            loading={index < columns ? 'eager' : 'lazy'}
            decoding="async"
            fetchpriority={index === 0 ? 'high' : index < columns ? 'auto' : 'low'}
            width="240"
            height="360"
            className="poster-img"
          />
          {cycleShots.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className={`poster-shot-frame ${hovering && frame === i ? 'show' : ''}`}
            />
          ))}
          {hasVideo && (
            <span className="poster-play-badge" aria-hidden="true">
              <Play size={11} fill="currentColor" />
            </span>
          )}
          {cycleShots.length > 1 && (
            <div className="poster-shot-dots" aria-hidden="true">
              {cycleShots.map((_, i) => (
                <span
                  key={i}
                  className={`shot-dot ${hovering && frame === i ? 'active' : ''}`}
                />
              ))}
            </div>
          )}
          {movie.notes && (
            <div className="poster-overlay">
              <div className="poster-notes">{movie.notes}</div>
            </div>
          )}
        </div>
        <div className="movie-info">
          <h3 className="movie-title">{movie.title}</h3>
          <button
            className={`copy-title-btn ${copied ? 'copied' : ''}`}
            onClick={copyTitle}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label={copied ? 'Copied' : `Copy ${movie.title}`}
            title={copied ? 'Copied!' : 'Copy title'}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
          <span className="movie-year">
            {movie.year}{movie.language ? ` · ${movie.language}` : ''}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
});
