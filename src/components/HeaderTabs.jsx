import { motion, LayoutGroup } from 'motion/react';
import { TABS, ICON_FOR_TAB } from '../lib/tabs';

// Tab bar with an animated active background that slides between tabs.
// `layoutId` keeps the public site and the admin from sharing the same
// motion identity (which would cause the indicator to fly across pages).
export const HeaderTabs = ({ active, counts, onChange, layoutId = 'header-tab-bg' }) => (
  <LayoutGroup>
    <div className="header-tabs">
      {TABS.map((id) => {
        const Icon = ICON_FOR_TAB[id];
        const isActive = active === id;
        return (
          <button
            key={id}
            className={`header-tab ${isActive ? 'active' : ''}`}
            onClick={() => onChange(id)}
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                // Only run the slide animation when the active tab changes —
                // NOT on every layout change. Without this, opening any modal
                // triggers `useBodyScrollLock` (position:fixed + top:-scrollY)
                // which shifts every element's measured position by scrollY,
                // and Motion animates the pill across the page from its
                // "before-fix" position to its "after-fix" position.
                layoutDependency={active}
                className="header-tab-bg"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <span className="header-tab-content">
              <Icon size={15} />
              {id}
              <span className="type-count">{counts[id]}</span>
            </span>
          </button>
        );
      })}
    </div>
  </LayoutGroup>
);
