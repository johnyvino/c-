import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Check, ExternalLink, X } from 'lucide-react';

const LIVE_URL = 'https://favorites.johnyvino.com/';
const DEPLOY_ETA_SECONDS = 90;

export const CommitResultToast = ({ result, onClose }) => {
  const [remaining, setRemaining] = useState(DEPLOY_ETA_SECONDS);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const actionsUrl = `https://github.com/${result.repo}/actions`;

  return (
    <motion.div
      className="commit-toast"
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
    >
      <div className="ct-head">
        <Check size={18} />
        <strong>Saved to GitHub.</strong>
        <button className="ct-close" onClick={onClose} aria-label="Dismiss"><X size={16} /></button>
      </div>
      <div className="ct-body">
        <div className="ct-row">
          <a href={result.commitUrl} target="_blank" rel="noopener noreferrer">
            View commit <ExternalLink size={12} />
          </a>
          <span className="dot">·</span>
          <a href={actionsUrl} target="_blank" rel="noopener noreferrer">
            Watch deploy <ExternalLink size={12} />
          </a>
          <span className="dot">·</span>
          <a href={LIVE_URL} target="_blank" rel="noopener noreferrer">
            Live site <ExternalLink size={12} />
          </a>
        </div>
        <div className="ct-eta">
          {remaining > 0
            ? <>Estimated live in <b>{remaining}s</b> (GitHub Pages build + deploy)</>
            : <>Should be live now — refresh the site to confirm.</>}
        </div>
      </div>
    </motion.div>
  );
};
