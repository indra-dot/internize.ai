import { X } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { twMerge } from 'tailwind-merge';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  /** Width preset. Defaults to 'md'. */
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-xs',
  md: 'max-w-sm',
  lg: 'max-w-md',
};

/**
 * Accessible modal dialog for the internize.ai side panel.
 * Uses the native <dialog> element for built-in focus trapping,
 * backdrop, and accessibility semantics.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  size = 'md',
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [isOpen]);

  // Close on Escape (native <dialog> already handles this, but we sync state)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
  }, [onClose]);

  // Close on backdrop click (click outside the inner panel)
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: native <dialog> handles keyboard natively
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className={twMerge(
        'fixed m-auto p-0 rounded-xl shadow-xl border border-slate-200/80',
        'bg-white backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm',
        'open:animate-in open:fade-in open:zoom-in-95 open:duration-150',
        sizeMap[size],
        className,
      )}
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Header */}
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 id="modal-title" className="text-sm font-semibold text-slate-800">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Close button when no title */}
      {!title && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Body */}
      <div className="p-4">{children}</div>
    </dialog>
  );
};
