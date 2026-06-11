import { useEffect } from 'react';

// Lock body scroll while a modal/sheet is open. iOS Safari ignores
// `overflow:hidden` on the body — the page still rubber-bands and the URL bar
// can disappear behind a fixed modal — so we use the scroll-position pattern:
// freeze the body in place via `position:fixed; top:-scrollY`, then restore on
// unlock. Composes cleanly with anything else that touched body styles by
// snapshotting prior values and restoring them.
export const useBodyScrollLock = (enabled) => {
  useEffect(() => {
    if (!enabled) return;
    const body = document.body;
    const html = document.documentElement;

    const scrollY = window.scrollY;
    const prev = {
      bodyPosition: body.style.position,
      bodyTop:      body.style.top,
      bodyLeft:     body.style.left,
      bodyRight:    body.style.right,
      bodyWidth:    body.style.width,
      bodyOverflow: body.style.overflow,
      htmlScroll:   html.style.scrollBehavior,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    // Marker class so CSS can disable decorative loops on cards behind the
    // modal — e.g. the S-tier sheen, which otherwise streaks red across the
    // backdrop blur and reads as something flying through the background.
    body.classList.add('is-modal-open');
    // Stop the smooth-scroll style from animating the position restore below.
    html.style.scrollBehavior = 'auto';

    return () => {
      body.style.position = prev.bodyPosition;
      body.style.top      = prev.bodyTop;
      body.style.left     = prev.bodyLeft;
      body.style.right    = prev.bodyRight;
      body.style.width    = prev.bodyWidth;
      body.style.overflow = prev.bodyOverflow;
      body.classList.remove('is-modal-open');
      window.scrollTo(0, scrollY);
      html.style.scrollBehavior = prev.htmlScroll;
    };
  }, [enabled]);
};
