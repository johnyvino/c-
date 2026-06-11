import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// A horizontal strip of still photos (TMDB backdrops, etc.) with a click-to-open
// lightbox and arrow-key navigation. Pure-image variant of GameMedia — no video
// affordances and no per-item thumbnail differentiation.
//
// While the parent is awaiting photos from TMDB (`loading={true}`), render
// `skeletonCount` grey shimmer slots in the same shape so the modal's stagger
// animation has something to fade in at open-time. When real photos land they
// swap into the slots with a quick fade.
export const PhotoStrip = ({ photos, loading = false, skeletonCount = 6 }) => {
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const touchStartX = useRef(null);

  useEffect(() => {
    if (lightboxIdx == null) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightboxIdx(null);
      else if (e.key === 'ArrowLeft') setLightboxIdx((i) => (i > 0 ? i - 1 : photos.length - 1));
      else if (e.key === 'ArrowRight') setLightboxIdx((i) => (i < photos.length - 1 ? i + 1 : 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, photos?.length]);

  const showingSkeletons = !photos?.length && loading;
  if (!photos?.length && !loading) return null;

  const showPrev = (e) => {
    e.stopPropagation();
    setLightboxIdx((i) => (i > 0 ? i - 1 : photos.length - 1));
  };
  const showNext = (e) => {
    e.stopPropagation();
    setLightboxIdx((i) => (i < photos.length - 1 ? i + 1 : 0));
  };

  // Touch swipe between photos in the lightbox. Threshold of 50px feels right
  // — anything tighter triggers on accidental scrolls.
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx > 50) showPrev(e);
    else if (dx < -50) showNext(e);
  };

  return (
    <div className="game-media">
      <div className="game-media-shots" role="list">
        {showingSkeletons
          ? Array.from({ length: skeletonCount }, (_, i) => (
              <div key={`skeleton-${i}`} className="game-media-shot photo-skeleton" aria-hidden="true" />
            ))
          : photos.map((src, i) => (
              <button
                key={src}
                type="button"
                role="listitem"
                className="game-media-shot photo-fade-in"
                style={{ backgroundImage: `url(${src})` }}
                aria-label={`Open photo ${i + 1}`}
                onClick={() => setLightboxIdx(i)}
              />
            ))}
      </div>

      {lightboxIdx != null && (
        <div
          className="lightbox-backdrop"
          onClick={() => setLightboxIdx(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
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
          {photos.length > 1 && (
            <>
              <button
                type="button"
                className="lightbox-btn lightbox-prev"
                onClick={showPrev}
                aria-label="Previous photo"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                type="button"
                className="lightbox-btn lightbox-next"
                onClick={showNext}
                aria-label="Next photo"
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}
          <img
            src={photos[lightboxIdx]}
            alt={`Photo ${lightboxIdx + 1}`}
            className="lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
          {photos.length > 1 && (
            <div className="lightbox-counter" aria-hidden="true">
              {lightboxIdx + 1} / {photos.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
