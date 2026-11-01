import { describe, expect, test } from 'bun:test';
import { summarizeAuthFileQuota } from '@/features/authFiles/quotaSummary';

describe('auth file cached quota summary', () => {
  test('keeps unavailable quota empty instead of inventing a percentage or plan', () => {
    expect(summarizeAuthFileQuota(undefined)).toEqual({ plan: null, lowest: null });
    expect(summarizeAuthFileQuota({ status: 'success', windows: [], planType: null })).toEqual({
      plan: null,
      lowest: null,
    });
  });
  test('finds the lowest remaining window and retains its translated label', () => {
    const result = summarizeAuthFileQuota({
      status: 'success',
      planType: 'Pro',
      windows: [
        {
          id: 'five-hour',
          label: '5h',
          labelKey: 'claude_quota.five_hour',
          usedPercent: 5,
          resetLabel: '',
        },
        { id: 'weekly', label: '7d', usedPercent: 54, resetLabel: '' },
        { id: 'unknown', label: 'Unknown', usedPercent: null, resetLabel: '' },
      ],
    });
    expect(result.plan).toBe('Pro');
    expect(result.lowest?.remaining).toBe(46);
    expect(result.lowest?.label).toBe('7d');
  });
  test('handles fraction buckets and ratio quotas, clamps percentages', () => {
    expect(
      summarizeAuthFileQuota({
        status: 'success',
        groups: [
          {
            id: 'g',
            label: 'Gemini',
            buckets: [{ id: 'b', label: 'Weekly Gemini', remainingFraction: 0.84 }],
          },
        ],
      }).lowest?.remaining
    ).toBe(84);
    expect(
      summarizeAuthFileQuota({ status: 'success', rows: [{ id: 'r', used: 15, limit: 10 }] }).lowest
        ?.remaining
    ).toBe(0);
    expect(
      summarizeAuthFileQuota({ status: 'success', rows: [{ id: 'r', used: 0, limit: 0 }] }).lowest
    ).toBeNull();
  });
  test('uses translated Meta and Devin window labels', () => {
    const meta = summarizeAuthFileQuota({
      status: 'success',
      data: { planName: 'Pro', windows: [{ id: 'window', durationMinutes: 120, usedPercent: 80 }] },
    });
    expect(meta.lowest?.labelKey).toBe('meta_quota.window_duration_hours');
    expect(meta.lowest?.labelParams).toEqual({ hours: 2 });
    const devin = summarizeAuthFileQuota({
      status: 'success',
      plan: 'Pro',
      planStartMs: null,
      planEndMs: null,
      observedAtMs: null,
      windows: [{ id: 'weekly', remainingPercent: 12, periodHours: 168, resetAtMs: null }],
    });
    expect(devin.lowest?.labelKey).toBe('devin_quota.weekly');
    expect(devin.lowest?.remaining).toBe(12);
  });
});
