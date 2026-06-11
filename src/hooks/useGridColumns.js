import { useEffect, useRef, useState } from 'react';

// Track the actual rendered grid column count so the stagger wave matches
// what's on screen. Returns [ref, columns] — attach the ref to the grid.
// Pass a `key` (e.g. activeTab) to force a re-measure when the layout class
// changes — the resize listener alone misses class-driven column changes.
export const useGridColumns = (initial = 5, key = null) => {
  const ref = useRef(null);
  const [columns, setColumns] = useState(initial);

  useEffect(() => {
    const update = () => {
      if (!ref.current) return;
      const cols = getComputedStyle(ref.current)
        .getPropertyValue('grid-template-columns')
        .split(' ')
        .filter(Boolean).length;
      if (cols > 0) setColumns((prev) => (prev === cols ? prev : cols));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [key]);

  return [ref, columns];
};
