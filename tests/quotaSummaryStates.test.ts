import { beforeAll, describe, expect, mock, test } from 'bun:test';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '../src/i18n/index';
import type { QuotaFileEntry } from '../src/features/quota/logic';
import { quotaSummaryState } from '../src/features/quota/overview';
import type { QuotaCardState } from '../src/features/quota/providers';
import type { XaiQuotaState } from '../src/types';

// Bun resolves CSS Modules to a path string; echo class names so the quota class contract binds.
mock.module(
  join(import.meta.dir, '../src/features/quota/components/QuotaBody.module.scss'),
  () => ({
    default: new Proxy({}, { get: (_, key) => (typeof key === 'string' ? key : undefined) }),
  })
);

const { QuotaSummary } = await import('../src/features/quota/components/QuotaOverview');

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

/** Copy as it appears in static markup (React escapes apostrophes). */
const copy = (key: string) => i18n.t(key).replace(/'/g, '&#x27;');

const now = Date.now();
const xai = (name: string): QuotaFileEntry => ({ file: { name, type: 'xai' }, type: 'xai' });

const render = (entries: QuotaFileEntry[], quotaFor: (entry: QuotaFileEntry) => unknown) =>
  renderToStaticMarkup(
    createElement(QuotaSummary, {
      entries,
      quotaFor: quotaFor as (entry: QuotaFileEntry) => QuotaCardState | undefined,
      resolvedTheme: 'dark',
      onLoadAll: () => {},
    })
  );

describe('quota summary state', () => {
  test('separates loaded-without-window from not loaded, loading and failed', () => {
    expect(quotaSummaryState(true, ['success'])).toBe('data');
    expect(quotaSummaryState(false, ['success'])).toBe('unavailable');
    expect(quotaSummaryState(false, ['loading', 'success'])).toBe('loading');
    expect(quotaSummaryState(false, ['error'])).toBe('error');
    expect(quotaSummaryState(false, ['idle', undefined])).toBe('idle');
    expect(quotaSummaryState(false, [])).toBe('idle');
  });

  test('loaded xAI monthly billing and paid-health accounts are not shown as unloaded', () => {
    const monthly = {
      status: 'success',
      billing: { mode: 'billing', periodType: 'monthly', resetAtMs: now + 1000 },
    } as XaiQuotaState;
    const paid = {
      status: 'success',
      billing: { mode: 'paid-health', periodType: 'weekly', resetAtMs: now + 1000 },
    } as XaiQuotaState;
    for (const quota of [monthly, paid]) {
      const markup = render([xai('xai-a.json')], () => quota);
      expect(markup).toContain(copy('quota_management.summary_unavailable'));
      expect(markup).not.toContain(copy('quota_management.not_loaded'));
      expect(markup).not.toContain(copy('quota_management.load_all'));
    }
  });

  test('nothing requested yet collapses into one page-level notice with a load action', () => {
    const markup = render([xai('xai-a.json'), xai('xai-b.json')], () => undefined);
    expect(markup).toContain(copy('quota_management.not_loaded'));
    expect(markup).toContain(copy('quota_management.load_all'));
    expect(markup.split(copy('quota_management.not_loaded')).length - 1).toBe(1);
  });

  test('failed and in-flight loads say so instead of asking for a refresh', () => {
    const failed = render([xai('xai-a.json')], () => ({ status: 'error', error: 'boom' }));
    expect(failed).toContain(copy('quota_management.summary_error'));
    expect(failed).not.toContain(copy('quota_management.not_loaded'));

    const loading = render([xai('xai-a.json')], () => ({ status: 'loading' }));
    expect(loading).toContain(copy('quota_management.summary_loading'));
  });

  test('a weekly xAI window is a headline labelled as remaining', () => {
    const weekly = {
      status: 'success',
      billing: {
        mode: 'billing',
        periodType: 'weekly',
        usagePercent: 30,
        resetAtMs: now + 3_600_000,
      },
    } as XaiQuotaState;
    const markup = render([xai('xai-a.json')], () => weekly);
    expect(markup).toContain('70%');
    expect(markup).toContain(copy('quota_management.remaining_label'));
  });
});
