import { clsx } from 'clsx';
import type React from 'react';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'bordered';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className,
  ...props
}) => {
  const variants = {
    default: 'bg-white rounded-xl border border-slate-200/80 shadow-sm',
    flat: 'bg-slate-50 rounded-xl border border-slate-200/60',
    bordered: 'bg-white rounded-xl border-2 border-slate-200',
  };

  return (
    <div
      className={twMerge(clsx(variants[variant], 'overflow-hidden transition-all', className))}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={twMerge(
        clsx('px-4 py-3 border-b border-slate-100 flex items-center justify-between', className),
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <h3
      className={twMerge(clsx('text-sm font-semibold text-slate-800 tracking-tight', className))}
      {...props}
    >
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <p className={twMerge(clsx('text-xs text-slate-500 mt-0.5', className))} {...props}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div className={twMerge(clsx('p-4 space-y-3', className))} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2',
          className,
        ),
      )}
      {...props}
    >
      {children}
    </div>
  );
};
