import { useEffect, useState } from 'react';

// Sample a saturated color from a poster so the modal can pick up a hint of
// the title's palette while staying mostly dark. Returns null until ready,
// or if the image is CORS-locked / lacks vibrant pixels.
export const usePosterTint = (src) => {
  const [tint, setTint] = useState(null);

  useEffect(() => {
    setTint(null);
    if (!src) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let cancelled = false;
    img.onload = () => {
      if (cancelled) return;
      try {
        const w = 32, h = 48;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i], pg = data[i + 1], pb = data[i + 2];
          const max = Math.max(pr, pg, pb), min = Math.min(pr, pg, pb);
          const sat = max === 0 ? 0 : (max - min) / max;
          // Skip near-black, near-white, washed-out pixels — we want vibrancy.
          if (max < 40 || min > 220 || sat < 0.3) continue;
          r += pr; g += pg; b += pb; count++;
        }
        if (count > 8) {
          setTint({ r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) });
        }
      } catch {
        // CORS / decoding error — leave tint null, modal stays plain dark.
      }
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);

  return tint;
};
