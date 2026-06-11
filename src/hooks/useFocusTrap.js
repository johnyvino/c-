import { useEffect } from 'react';

// Trap keyboard focus inside a modal:
// - On open: store previously-focused element, focus the modal (or its first
//   tabbable descendant).
// - While open: Tab and Shift+Tab cycle focus inside the modal only — Tab from
//   the last tabbable wraps to the first; Shift+Tab from the first wraps to
//   the last.
// - On close: restore focus to the element that was focused before the modal
//   opened, so keyboard users land back where they were.
//
// Pass a ref to the modal's root element. `enabled` lets the same hook be used
// for conditionally-rendered modals.
const TABBABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getTabbable = (root) =>
  Array.from(root.querySelectorAll(TABBABLE)).filter(
    (el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null
  );

export const useFocusTrap = (ref, enabled = true) => {
  useEffect(() => {
    if (!enabled || !ref.current) return;
    const root = ref.current;
    const previouslyFocused = document.activeElement;

    // Defer one frame so motion.div's mount transform is applied before focus
    // moves — avoids a visible jump in some browsers.
    const focusFirst = () => {
      const tabbables = getTabbable(root);
      const target = tabbables[0] || root;
      // Make sure root is focusable as a fallback.
      if (target === root && !root.hasAttribute('tabindex')) {
        root.setAttribute('tabindex', '-1');
      }
      target.focus({ preventScroll: true });
    };
    const raf = requestAnimationFrame(focusFirst);

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const tabbables = getTabbable(root);
      if (tabbables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!root.contains(active)) {
        // Focus escaped the trap — yank it back.
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [ref, enabled]);
};
