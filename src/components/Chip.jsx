import { memo } from 'react';
import { motion } from 'motion/react';

// Tactile chip: hover lifts slightly, tap presses down with spring overshoot
// so it feels like a real button being pushed in. Spring stiffness chosen so
// the bounce settles fast on rapid clicks.
const TAP_SPRING = { type: 'spring', stiffness: 500, damping: 28, mass: 0.5 };

export const Chip = memo(({ active, onClick, children }) => (
  <motion.button
    className={`glass-chip ${active ? 'active' : ''}`}
    onClick={onClick}
    whileHover={{ scale: 1.04 }}
    whileTap={{ scale: 0.93 }}
    transition={TAP_SPRING}
  >
    {children}
  </motion.button>
));
