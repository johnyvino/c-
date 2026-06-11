import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Send, X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

const FORM_ENDPOINT = 'https://formspree.io/f/xpqeqyao';

export const SubmitModal = ({ onClose }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const modalRef = useRef(null);
  useFocusTrap(modalRef, true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async (e) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message: text.trim(), _subject: 'Favorite suggestion' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDone(true);
      setText('');
      setTimeout(onClose, 1600);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <motion.div
        className="submit-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <div className="submit-center-wrap">
        <motion.form
          ref={modalRef}
          className="submit-modal tiny"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-modal-title"
          tabIndex={-1}
          onSubmit={send}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="submit-head">
            <h2 id="submit-modal-title">Give me a recommendation</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="submit-close">
              <X size={16} />
            </button>
          </div>
          <p className="submit-helper">
            Enter movie, show, or game name — then include your name with a hyphen.
          </p>
          <textarea
            autoFocus
            aria-label="Your recommendation"
            rows={3}
            placeholder="e.g. Predestination, The Bear, Returnal — Arjun"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send(e);
            }}
            disabled={done}
          />
          {error && <p className="submit-error">Couldn't send: {error}. Try again?</p>}
          <button type="submit" className="submit-send" disabled={!text.trim() || sending || done}>
            {done
              ? <><Check size={14} /> Sent — thanks!</>
              : sending
              ? <>Sending…</>
              : <><Send size={14} /> Send to Johnvino</>}
          </button>
        </motion.form>
      </div>
    </>
  );
};
