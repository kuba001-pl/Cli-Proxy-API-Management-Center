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
    <span
      className={['status-badge', 'status-badge--dot', status, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <span className="status-badge__dot" aria-hidden="true" />
      {children}
    </span>
  );
}
