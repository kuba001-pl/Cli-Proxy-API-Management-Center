import type { StatusBlockDetail } from '@/utils/recentRequests';

export type StatusBlockTone = 'idle' | 'success' | 'failure';

/**
 * Presentational tone for a recent-request block: neutral ticks for healthy buckets,
 * a danger tick for any bucket containing failures, and a muted track when idle.
 */
export function statusBlockTone(detail: Pick<StatusBlockDetail, 'success' | 'failure' | 'rate'>) {
  if (detail.rate === -1 || detail.success + detail.failure <= 0) return 'idle' as const;
  return detail.failure > 0 ? ('failure' as const) : ('success' as const);
}
