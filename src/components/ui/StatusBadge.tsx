import type { HTMLAttributes, PropsWithChildren } from 'react';

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status?: 'success' | 'warning' | 'danger' | 'neutral';
}

export function StatusBadge({
  status = 'neutral',
  className,
  children,
  ...rest
}: PropsWithChildren<StatusBadgeProps>) {
  return (
    <span className={['status-badge', status, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </span>
  );
}
