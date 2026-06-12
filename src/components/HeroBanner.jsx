import { motion, useReducedMotion } from 'motion/react';
import { Send } from 'lucide-react';
import { HeaderTabs } from './HeaderTabs';

const TITLE_LINK = "Johnvino's";
const TITLE_TAIL = ' Favorites';
const FULL_TITLE = TITLE_LINK + TITLE_TAIL;

// Each letter inflates from a small dot to full size with a spring overshoot,
// staggered so they pop in sequence. Replays on hover for a tactile feel.
const InflatingTitle = () => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <h1 className="hero-title">
        <a
          className="brand-link"
          href="https://johnyvino.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          {TITLE_LINK}
        </a>
        {TITLE_TAIL}
      </h1>
    );
  }

  const letterVariants = {
    rest:    { scale: 0, opacity: 0 },
    inflate: { scale: 1, opacity: 1 },
  };
  const letterTransition = (i) => ({
    delay: i * 0.05,
    type: 'spring',
    stiffness: 260,
    damping: 11,
    mass: 0.6,
  });
  const renderLetter = (ch, i) => (
    <motion.span
      key={i}
      className="brand-letter"
      variants={letterVariants}
      transition={letterTransition(i)}
      aria-hidden="true"
    >
      {ch === ' ' ? ' ' : ch}
    </motion.span>
  );

  return (
    <h1 className="hero-title">
      <motion.span
        className="hero-title-anim"
        initial="rest"
        animate="inflate"
        whileHover="inflate"
        aria-label={FULL_TITLE}
      >
        <a
          className="brand-link"
          href="https://johnyvino.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          {TITLE_LINK.split('').map((ch, i) => renderLetter(ch, i))}
        </a>
        <span className="title-tail" aria-hidden="true">
          {TITLE_TAIL.split('').map((ch, i) => renderLetter(ch, TITLE_LINK.length + i))}
        </span>
      </motion.span>
    </h1>
  );
};

export const HeroBanner = ({ activeTab, onTabChange, counts, onRecommend }) => (
  <div className="hero-banner">
    <div className="hero-content-wrap">
      <div className="header-content">
        <div className="header-top-row">
          <InflatingTitle />
          <motion.button
            className="hero-recommend-btn"
            onClick={onRecommend}
            aria-label="Submit a recommendation"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -2, scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
          >
            <Send size={14} />
            <span className="hero-recommend-label hero-recommend-label-desktop">
              Give me a recommendation
            </span>
            <span className="hero-recommend-label hero-recommend-label-mobile">
              Submit
            </span>
          </motion.button>
        </div>
        <motion.p
          className="hero-blurb"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          Here's a collection of entertainment I love.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <HeaderTabs active={activeTab} counts={counts} onChange={onTabChange} />
        </motion.div>
      </div>
    </div>
  </div>
);
