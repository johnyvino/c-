import { useState } from 'react';

// <img> wrapper that swaps to a text placeholder if the source 404s.
// Browsers otherwise show their broken-image glyph + the alt text — the worst
// possible failure UI on a dark theme.
export const PosterImage = ({ src, alt, fallback, className = '', ...rest }) => {
  const [broken, setBroken] = useState(false);

  if (broken || !src) {
    return <div className="poster-placeholder">{fallback}</div>;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setBroken(true)}
      {...rest}
    />
  );
};
