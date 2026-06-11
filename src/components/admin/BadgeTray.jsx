import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { badgeFieldsFor } from '../../lib/badges';

const TRAY_GUESS_HEIGHT = 220;
const SAFE_MARGIN = 12;

export const BadgeTray = ({ movie, anchor, onPick, onClose }) => {
  const trayRef = useRef(null);
  const fields = badgeFieldsFor(movie.type);
  const activeKey = fields.find((b) => movie[b.key])?.key ?? null;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onOutside = (e) => {
      if (trayRef.current && !trayRef.current.contains(e.target)) onClose();
    };
    window.addEventListener('keydown', onKey);
    // Defer outside-click binding so the tap that opened the tray doesn't
    // immediately close it. rAF is more reliable than setTimeout(0) on iOS,
    // which can fire synthetic mousedown after the timeout queue drains.
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        document.addEventListener('pointerdown', onOutside);
      });
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onOutside);
      cancelAnimationFrame(raf);
    };
  }, [onClose]);

  // Prefer below the card; flip above if there's not enough room.
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const placeBelow = vh - anchor.bottom >= TRAY_GUESS_HEIGHT + SAFE_MARGIN;
  const top = placeBelow ? anchor.bottom + 10 : Math.max(SAFE_MARGIN, anchor.top - TRAY_GUESS_HEIGHT - 10);
  const cardCenter = anchor.left + anchor.width / 2;
  const maxWidth = Math.min(960, vw - 24);
  const left = Math.max(12, Math.min(cardCenter - maxWidth / 2, vw - maxWidth - 12));

  return (
    <motion.div
      ref={trayRef}
      className="badge-tray"
      style={{ top, left, maxWidth }}
      initial={{ opacity: 0, scale: 0.85, y: placeBelow ? -6 : 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: placeBelow ? -6 : 6 }}
      transition={{ type: 'spring', stiffness: 480, damping: 32 }}
    >
      {fields.map((b) => (
        <button
          key={b.key}
          type="button"
          className={`badge-pick ${activeKey === b.key ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onPick(b.key); }}
          aria-label={b.label}
          title={b.label}
        >
          <img src={b.img} alt="" />
        </button>
      ))}
    </motion.div>
  );
};
