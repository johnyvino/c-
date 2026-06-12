import { motion } from 'motion/react';
import { FilterSidebar } from './FilterSidebar';

export const MobileFilterSheet = ({ onClose, ...sidebarProps }) => (
  <>
    <motion.div
      className="sheet-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    />
    <motion.div
      className="sheet"
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="sheet-handle" />
      <div className="sheet-header">
        <button
          className="sheet-clear"
          onClick={sidebarProps.onClear}
          disabled={!sidebarProps.hasActive}
        >
          Clear
        </button>
        <h2 className="sheet-title">Filters</h2>
        <button className="sheet-apply" onClick={onClose}>Apply</button>
      </div>
      <FilterSidebar {...sidebarProps} hideClearAll hideSearch />
    </motion.div>
  </>
);
