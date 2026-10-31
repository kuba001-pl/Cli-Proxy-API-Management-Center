import type {
  AntigravityQuotaState,
  ClaudeQuotaState,
  CodexQuotaState,
  DevinQuotaState,
  KimiQuotaState,
  MetaQuotaState,
  XaiQuotaState,
} from '@/types';
export type AuthFileCachedQuota =
  | AntigravityQuotaState
  | ClaudeQuotaState
  | CodexQuotaState
  | DevinQuotaState
  | KimiQuotaState
  | MetaQuotaState
  | XaiQuotaState;

export type AuthFileQuotaSummary = {
  plan: string | null;
  lowest: {
    remaining: number;
    label: string;
    labelKey?: string;
    labelParams?: Record<string, string | number>;
  } | null;
};

/** Summarize already cached quota only; missing observations stay missing. */
export function summarizeAuthFileQuota(
  quota: AuthFileCachedQuota | undefined
): AuthFileQuotaSummary {
  const candidates: NonNullable<AuthFileQuotaSummary['lowest']>[] = [];
  let plan: string | null = null;
  if (!quota) return { plan, lowest: null };
  if ('planType' in quota) plan = quota.planType ?? null;
  if ('planName' in quota) plan = quota.planName ?? null;
  if ('plan' in quota) plan = quota.plan ?? null;
  if ('subscription' in quota)
    plan = quota.subscription?.plan ?? quota.subscription?.tierName ?? null;
  const add = (
    remaining: number | null | undefined,
    label: string,
    labelKey?: string,
    labelParams?: Record<string, string | number>
  ) => {
    if (typeof remaining === 'number' && Number.isFinite(remaining)) {
      candidates.push({
        remaining: Math.max(0, Math.min(100, remaining)),
        label,
        labelKey,
        labelParams,
      });
    }
  };
  if ('windows' in quota) {
    quota.windows.forEach((window) => {
      if ('remainingPercent' in window)
        add(window.remainingPercent, window.label ?? window.id, `devin_quota.${window.id}`);
      else if (window.usedPercent !== null)
        add(
          100 - window.usedPercent,
          window.label,
          'labelKey' in window ? window.labelKey : undefined,
          'labelParams' in window ? window.labelParams : undefined
        );
    });
  }
  if ('groups' in quota)
    quota.groups.forEach((group) =>
      group.buckets.forEach((bucket) => add(bucket.remainingFraction * 100, bucket.label))
    );
  if ('rows' in quota)
    quota.rows.forEach((row) => {
      if (row.limit > 0)
        add((1 - row.used / row.limit) * 100, row.label ?? row.id, row.labelKey, row.labelParams);
    });
  if ('data' in quota && quota.data) {
    plan = quota.data.planName ?? null;
    quota.data.windows.forEach((window) => {
      if (window.usedPercent !== null) {
        const duration = window.id === 'window' ? window.durationMinutes : undefined;
        const labelKey = duration
          ? duration % 60 === 0
            ? 'meta_quota.window_duration_hours'
            : 'meta_quota.window_duration'
          : `meta_quota.${window.id}`;
        const labelParams: Record<string, string | number> | undefined = duration
          ? duration % 60 === 0
            ? { hours: duration / 60 }
            : { minutes: duration }
          : undefined;
        add(100 - window.usedPercent, window.id, labelKey, labelParams);
      }
    });
  }
  if ('billing' in quota && quota.billing) {
    plan = quota.billing.planLabel ?? quota.billing.planType ?? null;
    // A monthly billing/spend cap is not a remaining rate-limit window.
    if (quota.billing.periodType === 'weekly' && quota.billing.usagePercent !== null) {
      add(100 - quota.billing.usagePercent, 'weekly', 'xai_quota.weekly_limit');
      quota.billing.productUsage.forEach((product) => {
        if (product.usagePercent !== null) add(100 - product.usagePercent, product.product);
      });
    }
  }
  return { plan, lowest: candidates.sort((a, b) => a.remaining - b.remaining)[0] ?? null };
}
