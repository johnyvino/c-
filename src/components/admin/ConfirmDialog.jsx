import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

// Replaces the browser `confirm()` dialog with one that matches the rest of
// the app's modal aesthetic. Usage: render conditionally with `open`, pass a
// title + message + confirm callback. The "Cancel" button receives initial
// focus so destructive actions never get fired by accident on Enter.
export const ConfirmDialog = ({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onClose,
}) => {
  if (!open) return null;
  return (
    <>
      <motion.div
        className="confirm-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <div className="confirm-center" onClick={onClose}>
        <motion.div
          className="confirm-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.94, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 6 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className={`confirm-icon ${destructive ? 'destructive' : ''}`}>
            <AlertTriangle size={20} />
          </div>
          <h3 id="confirm-dialog-title" className="confirm-title">{title}</h3>
          {message && <p className="confirm-message">{message}</p>}
          <div className="confirm-actions">
            <button type="button" className="admin-btn ghost" onClick={onClose} autoFocus>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`admin-btn ${destructive ? 'danger' : 'primary'}`}
              onClick={() => { onConfirm?.(); onClose?.(); }}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
};
