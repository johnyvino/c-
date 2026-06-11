import { useEffect, useState } from 'react';

// Returns `value` after it has been stable for `delay` ms. Use to keep an
// input field snappy (controlled by raw state) while heavy derived work
// (filter + sort + spread) only runs after typing pauses.
export const useDebouncedValue = (value, delay = 120) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
};
