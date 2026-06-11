import { useEffect, useRef, useState } from 'react';

// Shared IntersectionObserver — one instance per (rootMargin) bucket, instead
// of ~250 individual observers (one per MovieCard) that the per-element pattern
// produced. Each call gets a fresh ref + a "visible once" boolean: the observer
// fires once per element, then untracks it so we don't keep watching items
// that have already rendered.
//
// rootMargin is keyed so different consumers can request different prefetch
// distances and each shares an observer with same-config peers. Most callers
// will hit the default key.
const observers = new Map();

const getObserver = (rootMargin) => {
  if (observers.has(rootMargin)) return observers.get(rootMargin);
  const callbacks = new WeakMap();
  const io = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const cb = callbacks.get(entry.target);
        if (cb) {
          cb();
          observer.unobserve(entry.target);
          callbacks.delete(entry.target);
        }
      }
    },
    { rootMargin }
  );
  const handle = {
    observe(el, cb) {
      callbacks.set(el, cb);
      io.observe(el);
    },
    unobserve(el) {
      callbacks.delete(el);
      io.unobserve(el);
    },
  };
  observers.set(rootMargin, handle);
  return handle;
};

export const useInViewOnce = (rootMargin = '160px') => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible || !ref.current) return;
    const el = ref.current;
    const obs = getObserver(rootMargin);
    obs.observe(el, () => setVisible(true));
    return () => obs.unobserve(el);
  }, [visible, rootMargin]);

  return [ref, visible];
};
