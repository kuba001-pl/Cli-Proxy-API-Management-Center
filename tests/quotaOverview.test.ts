import { describe, expect, test } from 'bun:test';
import {
  quotaOverviewWindows,
  representativeQuotaWindow,
  upcomingQuotaResets,
} from '@/features/quota/overview';
import type { QuotaOverviewWindow } from '@/features/quota/overview';
import type { QuotaCardState } from '@/features/quota/providers';
import type { QuotaFileEntry } from '@/features/quota/logic';
import type {
  CodexQuotaState,
  KimiQuotaState,
  MetaQuotaState,
  AntigravityQuotaState,
  XaiQuotaState,
} from '@/types';

const now = 1_800_000_000_000;
const window = (overrides: Partial<QuotaOverviewWindow> = {}): QuotaOverviewWindow => ({
  id: 'weekly',
  label: 'Weekly',
  remaining: 50,
  resetAtMs: now + 1_000,
  periodHours: 168,
  ...overrides,
});
const codex: CodexQuotaState = {
  status: 'success',
  windows: [
    {
      id: 'session',
      label: '5-hour',
      usedPercent: 71,
      resetLabel: '',
      resetAtMs: now + 5_000,
      periodHours: 5,
    },
    {
      id: 'weekly',
      label: 'Weekly',
      usedPercent: 15,
      resetLabel: '',
      resetAtMs: now + 10_000,
      periodHours: 168,
    },
  ],
};

describe('quota overview projections', () => {
  test('reads remaining capacity from normalized windows without changing them', () => {
    const before = JSON.stringify(codex);
    expect(quotaOverviewWindows('codex', codex).map((row) => row.remaining)).toEqual([29, 85]);
    expect(JSON.stringify(codex)).toBe(before);
  });

  test('does not turn unknown or non-finite usage into a full meter', () => {
    for (const usedPercent of [null, NaN, Infinity]) {
      expect(
        quotaOverviewWindows('codex', {
          ...codex,
          windows: [{ ...codex.windows[0], usedPercent }],
        } as CodexQuotaState)[0].remaining
      ).toBeNull();
    }
  });

  test('clamps observations for display', () => {
    expect(
      quotaOverviewWindows('codex', {
        ...codex,
        windows: [{ ...codex.windows[0], usedPercent: 120 }],
      } as CodexQuotaState)[0].remaining
    ).toBe(0);
  });

  test('prefers weekly capacity over a lower session value without reordering input', () => {
    const rows = quotaOverviewWindows('codex', codex);
    expect(representativeQuotaWindow(rows)?.id).toBe('weekly');
    expect(rows[0].id).toBe('session');
    expect(
      representativeQuotaWindow([window({ id: 'a' }), window({ id: 'b', remaining: 20 })])?.id
    ).toBe('b');
  });

  test('keeps model-scoped limits out of Claude and Codex account headlines', () => {
    const windows = [
      window({ id: 'model-weekly', remaining: 0 }),
      window({ id: 'weekly', remaining: 85 }),
    ];
    expect(representativeQuotaWindow(windows, 'codex')?.remaining).toBe(85);
    expect(
      representativeQuotaWindow([window({ id: 'seven-day', remaining: 92 }), windows[0]], 'claude')
        ?.remaining
    ).toBe(92);
  });

  test('does not fabricate a summary for an unloaded or unknown observation', () => {
    expect(quotaOverviewWindows('claude', undefined)).toEqual([]);
    expect(quotaOverviewWindows('codex', { status: 'loading' })).toEqual([]);
    expect(quotaOverviewWindows('kimi', { status: 'error', error: 'offline' })).toEqual([]);
    expect(representativeQuotaWindow([window({ remaining: null })])).toBeUndefined();
  });

  test('converts Meta seconds and durations exactly once, preserving zero usage', () => {
    const quota: MetaQuotaState = {
      status: 'success',
      data: {
        windows: [
          { id: 'weekly', usedPercent: 0, resetAt: (now + 10_000) / 1000, durationMinutes: 10_080 },
        ],
      },
    };
    expect(quotaOverviewWindows('meta', quota)[0]).toMatchObject({
      remaining: 100,
      resetAtMs: now + 10_000,
      periodHours: 168,
    });
  });

  test('uses Kimi usage counts and leaves an absent limit unknown', () => {
    const quota: KimiQuotaState = {
      status: 'success',
      rows: [{ id: 'monthly', used: 20, limit: 80, periodHours: 720 }],
    };
    expect(quotaOverviewWindows('kimi', quota)[0].remaining).toBe(75);
    expect(
      quotaOverviewWindows('kimi', {
        ...quota,
        rows: [{ id: 'unknown', used: 0, limit: 0 }],
      } as KimiQuotaState)[0].remaining
    ).toBeNull();
  });

  test('keeps Antigravity bucket ids unique across groups', () => {
    const quota: AntigravityQuotaState = {
      status: 'success',
      groups: ['a', 'b'].map((id) => ({
        id,
        label: id,
        buckets: [
          {
            id: 'weekly',
            label: 'Weekly',
            remainingFraction: 0.84,
            resetAtMs: now + 1_000,
            periodHours: 168,
          },
        ],
      })),
    };
    const windows = quotaOverviewWindows('antigravity', quota);
    expect(windows.map((row) => row.id)).toEqual(['a:weekly', 'b:weekly']);
    expect(windows[0].remaining).toBe(84);
  });

  test('does not present xAI monthly billing rollover as a quota reset', () => {
    const monthly = {
      status: 'success',
      billing: { mode: 'billing', periodType: 'monthly', resetAtMs: now + 1000 },
    } as XaiQuotaState;
    const paid = {
      status: 'success',
      billing: { mode: 'paid-health', periodType: 'weekly', resetAtMs: now + 1000 },
    } as XaiQuotaState;
    expect(quotaOverviewWindows('xai', monthly)).toEqual([]);
    expect(quotaOverviewWindows('xai', paid)).toEqual([]);
  });
});

describe('upcoming quota resets', () => {
  const entries: QuotaFileEntry[] = [{ file: { name: 'codex.json' }, type: 'codex' }];

  test('sorts all actual reset windows soonest first', () => {
    const reset = upcomingQuotaResets(
      entries,
      () => ({ ...codex, windows: [...codex.windows].reverse() }),
      now
    );
    expect(reset.map((row) => row.window.id)).toEqual(['session', 'weekly']);
  });

  test('excludes past, invalid and exactly-now instants and never projects another reset', () => {
    const quota = {
      ...codex,
      windows: [now - 1, now, NaN, Number.MAX_VALUE, null].map((resetAtMs, index) => ({
        ...codex.windows[0],
        id: String(index),
        resetAtMs,
      })),
    };
    expect(upcomingQuotaResets(entries, () => quota, now)).toEqual([]);
  });

  test('omits subscription renewals and reset-credit expiry', () => {
    const quota: CodexQuotaState = {
      ...codex,
      windows: [],
      subscriptionActiveUntil: now + 1000,
      rateLimitResetCredits: [
        {
          id: 'credit',
          status: 'available',
          grantedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 1000).toISOString(),
        },
      ],
    };
    expect(upcomingQuotaResets(entries, () => quota, now)).toEqual([]);
  });

  test('retains unique identities for multiple credentials in the same physical plugin file', () => {
    const pluginEntries: QuotaFileEntry[] = [1, 2].map((authIndex) => ({
      file: { name: 'shared.json', supportsQuota: true, authIndex },
      type: 'plugin',
    }));
    const quota = {
      status: 'success',
      groups: [
        {
          id: 'a',
          label: 'A',
          buckets: [{ id: 'b', label: 'B', remainingFraction: 0.5, resetAtMs: now + 1000 }],
        },
      ],
    } as QuotaCardState;
    const resets = upcomingQuotaResets(pluginEntries, () => quota, now);
    expect(new Set(resets.map((row) => row.key)).size).toBe(2);
  });
});
