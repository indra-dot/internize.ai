import { clsx } from 'clsx';
import { AlertCircle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type React from 'react';
import { twMerge } from 'tailwind-merge';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastProps {
  id?: string;
  type?: ToastType;
  title?: string;
  message: string;
  onClose?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  type = 'info',
  title,
  message,
  onClose,
  className,
}) => {
  const icons = {
    info: <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />,
    warning: <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />,
    error: <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />,
  };

  const borderStyles = {
    info: 'border-sky-200 bg-sky-50/90 text-sky-900',
    success: 'border-emerald-200 bg-emerald-50/90 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50/90 text-amber-900',
    error: 'border-rose-200 bg-rose-50/90 text-rose-900',
  };

  return (
    <div
      className={twMerge(
        clsx(
          'flex items-start gap-2.5 p-3 rounded-xl border shadow-sm text-xs transition-all animate-in fade-in slide-in-from-top-2 duration-200',
          borderStyles[type],
          className,
        ),
      )}
    >
      {icons[type]}
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-xs leading-none mb-1">{title}</p>}
        <p className="leading-relaxed break-words">{message}</p>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 -mr-1 -mt-1 rounded-md opacity-70 hover:opacity-100 hover:bg-black/5 transition-opacity"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
