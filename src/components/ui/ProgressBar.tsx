import type { CSSProperties } from 'react';

export interface ProgressBarProps {
  /** Percentage, clamped to 0–100. Non-finite values render an indeterminate bar. */
  value?: number;
  ariaLabel: string;
  status?: 'success' | 'warning' | 'danger' | 'neutral';
  className?: string;
}

const STATUS_COLORS = {
  success: 'var(--status-success)',
  warning: 'var(--status-warning)',
  danger: 'var(--status-danger)',
  neutral: 'var(--text-primary)',
} satisfies Record<NonNullable<ProgressBarProps['status']>, string>;

export function ProgressBar({ value, ariaLabel, status = 'neutral', className }: ProgressBarProps) {
  const percentage =
    value !== undefined && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : undefined;
  const style: CSSProperties = {
    width: percentage === undefined ? '35%' : `${percentage}%`,
    background: STATUS_COLORS[status],
  };

  return (
    <div
      className={['progress-bar', className].filter(Boolean).join(' ')}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
    >
      <span style={style} />
    </div>
  );
}
