import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react';

// One horizontal media strip per game. Mixes any RAWG videos and screenshots
// into a single row of thumbnails. Click a screenshot for the image lightbox;
// click a video to open the player overlay.
export const GameMedia = ({ game }) => {
  const videos = game.videos || [];
  const screenshots = game.screenshots || [];

  // Build the unified row. Videos first since they're highest-signal.
  const items = [
    ...videos.map((v) => ({
      kind: 'video',
      thumb: v.preview || screenshots[0] || null,
      src: v.high || v.low,
      name: v.name,
    })),
    ...screenshots.map((src) => ({ kind: 'image', thumb: src, src })),
  ];

  const screenshotIdx = (i) => i - videos.length;
  const [activeVideoSrc, setActiveVideoSrc] = useState(null);
  const [lightboxIdx, setLightboxIdx] = useState(null);

  useEffect(() => {
    if (lightboxIdx == null && !activeVideoSrc) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setLightboxIdx(null);
        setActiveVideoSrc(null);
      } else if (lightboxIdx != null && e.key === 'ArrowLeft') {
        setLightboxIdx((i) => (i > 0 ? i - 1 : screenshots.length - 1));
      } else if (lightboxIdx != null && e.key === 'ArrowRight') {
        setLightboxIdx((i) => (i < screenshots.length - 1 ? i + 1 : 0));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, activeVideoSrc, screenshots.length]);

  if (!items.length) return null;

  const showPrev = (e) => {
    e.stopPropagation();
    setLightboxIdx((i) => (i > 0 ? i - 1 : screenshots.length - 1));
  };
  const showNext = (e) => {
    e.stopPropagation();
    setLightboxIdx((i) => (i < screenshots.length - 1 ? i + 1 : 0));
  };

  // Touch swipe between screenshots — 50px threshold, mirrors PhotoStrip.
  const touchStartX = useRef(null);
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null || screenshots.length < 2) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx > 50) showPrev(e);
    else if (dx < -50) showNext(e);
  };

  return (
    <div className="game-media">
      <div className="game-media-shots" role="list">
        {items.map((it, i) => (
          <button
            key={`${it.kind}-${i}`}
            type="button"
            role="listitem"
            className={`game-media-shot ${it.kind === 'video' ? 'is-video' : ''}`}
            style={it.thumb ? { backgroundImage: `url(${it.thumb})` } : undefined}
            aria-label={it.kind === 'video' ? `Play ${it.name || 'trailer'}` : `Open screenshot ${i + 1}`}
            onClick={() => {
              if (it.kind === 'video') setActiveVideoSrc(it.src);
              else setLightboxIdx(screenshotIdx(i));
            }}
          >
            {it.kind === 'video' && (
              <span className="game-media-play-overlay" aria-hidden="true">
                <Play size={18} fill="currentColor" />
              </span>
            )}
          </button>
        ))}
      </div>

      {lightboxIdx != null && (
        <div
          className="lightbox-backdrop"
          onClick={() => setLightboxIdx(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot viewer"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <button
            type="button"
            className="lightbox-btn lightbox-close"
            onClick={(e) => { e.stopPropagation(); setLightboxIdx(null); }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
          {screenshots.length > 1 && (
            <>
              <button
                type="button"
                className="lightbox-btn lightbox-prev"
                onClick={showPrev}
                aria-label="Previous screenshot"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                type="button"
                className="lightbox-btn lightbox-next"
                onClick={showNext}
                aria-label="Next screenshot"
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}
          <img
            src={screenshots[lightboxIdx]}
            alt={`Screenshot ${lightboxIdx + 1}`}
            className="lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
          {screenshots.length > 1 && (
            <div className="lightbox-counter" aria-hidden="true">
              {lightboxIdx + 1} / {screenshots.length}
            </div>
          )}
        </div>
      )}

      {activeVideoSrc && (
        <div
          className="lightbox-backdrop"
          onClick={() => setActiveVideoSrc(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Video player"
        >
          <button
            type="button"
            className="lightbox-btn lightbox-close"
            onClick={(e) => { e.stopPropagation(); setActiveVideoSrc(null); }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <video
            src={activeVideoSrc}
            autoPlay
            controls
            playsInline
            className="lightbox-video"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
