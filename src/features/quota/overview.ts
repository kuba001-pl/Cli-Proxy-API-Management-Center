import type {
  AntigravityQuotaState,
  ClaudeQuotaState,
  CodexQuotaState,
  DevinQuotaState,
  KimiQuotaState,
  MetaQuotaState,
  XaiQuotaState,
} from '@/types';
import { getQuotaCacheKey } from '@/utils/quota/identity';
import type { QuotaFileEntry } from './logic';
import type { QuotaCardState } from './providers';
import type { QuotaProviderType } from './providers/types';

/** Display projection of normalized observations; never stored or sent to the API. */
export interface QuotaOverviewWindow {
  id: string;
  label: string;
  labelKey?: string;
  labelParams?: Record<string, string | number>;
  remaining: number | null;
  resetAtMs: number | null;
  periodHours: number | null;
}

const percent = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
const remainingOf = (used: number | null | undefined) =>
  typeof used === 'number' && Number.isFinite(used) ? percent(100 - used) : null;
const instant = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(new Date(value).getTime()) ? value : null;

export function quotaOverviewWindows(
  provider: QuotaProviderType,
  quota: QuotaCardState | undefined
): QuotaOverviewWindow[] {
  if (quota?.status !== 'success') return [];
  if (provider === 'claude' || provider === 'codex') {
    const state = quota as ClaudeQuotaState | CodexQuotaState;
    return (state.windows ?? []).map((window) => ({
      id: window.id,
      label: window.label,
      labelKey: window.labelKey,
      labelParams: 'labelParams' in window ? window.labelParams : undefined,
      remaining: remainingOf(window.usedPercent),
      resetAtMs: instant(window.resetAtMs),
      periodHours: window.periodHours ?? null,
    }));
  }
  if (provider === 'devin') {
    return ((quota as DevinQuotaState).windows ?? []).map((window) => ({
      ...window,
      label: window.label ?? window.id,
      labelKey: `devin_quota.${window.id}`,
      remaining: percent(window.remainingPercent),
      resetAtMs: instant(window.resetAtMs),
    }));
  }
  if (provider === 'antigravity' || provider === 'plugin') {
    return ((quota as AntigravityQuotaState).groups ?? []).flatMap((group) =>
      group.buckets.map((bucket) => ({
        id: `${group.id}:${bucket.id}`,
        label: `${group.label} · ${bucket.label}`,
        remaining: percent(bucket.remainingFraction * 100),
        resetAtMs: instant(bucket.resetAtMs),
        periodHours: bucket.periodHours ?? null,
      }))
    );
  }
  if (provider === 'kimi') {
    return ((quota as KimiQuotaState).rows ?? []).map((row) => ({
      id: row.id,
      label: row.label ?? row.id,
      labelKey: row.labelKey,
      labelParams: row.labelParams,
      remaining: row.limit > 0 ? remainingOf((row.used / row.limit) * 100) : null,
      resetAtMs: instant(row.resetAtMs),
      periodHours: row.periodHours ?? null,
    }));
  }
  if (provider === 'meta') {
    return ((quota as MetaQuotaState).data?.windows ?? []).map((window) => ({
      id: window.id,
      label: window.id,
      labelKey: `meta_quota.${window.id}`,
      remaining: remainingOf(window.usedPercent),
      resetAtMs: typeof window.resetAt === 'number' ? instant(window.resetAt * 1000) : null,
      periodHours: typeof window.durationMinutes === 'number' ? window.durationMinutes / 60 : null,
    }));
  }
  const billing = (quota as XaiQuotaState).billing;
  if (!billing || billing.mode === 'paid-health' || billing.periodType !== 'weekly') return [];
  return [
    {
      id: 'weekly',
      label: 'weekly',
      labelKey: 'xai_quota.weekly_limit',
      remaining: remainingOf(billing.usagePercent),
      resetAtMs: instant(billing.resetAtMs),
      periodHours: billing.periodHours ?? 168,
    },
  ];
}

/** Prefer the longest reported window, then the lowest remaining capacity. */
export function representativeQuotaWindow(
  windows: QuotaOverviewWindow[],
  provider?: QuotaProviderType
) {
  // Keep model-scoped limits (e.g. Spark/Opus) out of the account headline.
  // They remain visible in their own rows and upcoming resets.
  const accountId = provider === 'codex' ? 'weekly' : provider === 'claude' ? 'seven-day' : null;
  const accountWindow = windows.find(
    (window) => window.id === accountId && window.remaining !== null
  );
  if (accountWindow) return accountWindow;
  return [...windows]
    .filter((window) => window.remaining !== null)
    .sort((a, b) => (b.periodHours ?? 0) - (a.periodHours ?? 0) || a.remaining! - b.remaining!)[0];
}

export interface UpcomingQuotaReset {
  key: string;
  entry: QuotaFileEntry;
  window: QuotaOverviewWindow & { resetAtMs: number };
}

/** Actual upcoming resets only: no projected refills, billing renewals or credit expiries. */
export function upcomingQuotaResets(
  entries: QuotaFileEntry[],
  quotaFor: (entry: QuotaFileEntry) => QuotaCardState | undefined,
  now: number
): UpcomingQuotaReset[] {
  return entries
    .flatMap((entry) =>
      quotaOverviewWindows(entry.type, quotaFor(entry)).flatMap((window) =>
        window.resetAtMs !== null && window.resetAtMs > now
          ? [
              {
                key: `${entry.type}:${getQuotaCacheKey(entry.file)}:${window.id}`,
                entry,
                window: { ...window, resetAtMs: window.resetAtMs },
              },
            ]
          : []
      )
    )
    .sort((a, b) => a.window.resetAtMs - b.window.resetAtMs || a.key.localeCompare(b.key));
}
