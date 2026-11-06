import { beforeAll, describe, expect, mock, test } from 'bun:test';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '../src/i18n/index';
import type { QuotaFileEntry } from '../src/features/quota/logic';
import { isQuotaLow, quotaSummaryState } from '../src/features/quota/overview';
import { quotaRowDomId } from '../src/features/quota/logic';
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
const { QuotaHeader } = await import('../src/features/quota/components/QuotaHeader');

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

  const weekly = (usagePercent: number) =>
    ({
      status: 'success',
      billing: {
        mode: 'billing',
        periodType: 'weekly',
        usagePercent,
        resetAtMs: now + 3_600_000,
      },
    }) as XaiQuotaState;

  test('a healthy headline states its coverage and links to the failed credential', () => {
    const a = xai('xai-a.json');
    const b = xai('xai-b.json');
    const c = xai('xai-c.json');
    const markup = render([a, b, c], (entry) =>
      entry === b ? { status: 'error', error: 'expired' } : entry === c ? undefined : weekly(16)
    );
    expect(markup).toContain('84%');
    expect(markup).toContain(i18n.t('quota_management.summary_coverage', { loaded: 1, count: 3 }));
    expect(markup).toContain(i18n.t('quota_management.summary_failed', { count: 1 }));
    expect(markup).toContain(copy('quota_management.summary_view_failed'));
    expect(markup).toContain('data-partial="true"');
  });

  test('a fully loaded provider keeps its plain credential count', () => {
    const markup = render([xai('xai-a.json'), xai('xai-b.json')], () => weekly(30));
    expect(markup).not.toContain('data-partial');
    expect(markup).not.toContain(copy('quota_management.summary_view_failed'));
    expect(markup).toContain(i18n.t('quota_management.meta_credentials', { count: 2 }));
  });

  test('amber and the Low label are reserved for readings under 20% left', () => {
    expect(isQuotaLow(19)).toBe(true);
    expect(isQuotaLow(1)).toBe(true);
    expect(isQuotaLow(20)).toBe(false);
    expect(isQuotaLow(58)).toBe(false);
    expect(isQuotaLow(0)).toBe(false);
    expect(isQuotaLow(null)).toBe(false);
    expect(render([xai('xai-a.json')], () => weekly(85))).toContain(
      `>${i18n.t('quota_management.low_state')}<`
    );
    expect(render([xai('xai-a.json')], () => weekly(42))).not.toContain(
      `>${i18n.t('quota_management.low_state')}<`
    );
  });

  test('row ids are stable DOM ids for jump links', () => {
    expect(quotaRowDomId(xai('a b@x.json'))).toBe('quota-row-xai-a%20b%40x.json');
  });

  test('the header action loads first and refreshes afterwards, with singular attention', () => {
    const header = (loadedCount: number, attentionCount: number) =>
      renderToStaticMarkup(
        createElement(QuotaHeader, {
          totalCount: 2,
          loadedCount,
          attentionCount,
          refreshing: false,
          disableControls: false,
          onRefreshAll: () => {},
        })
      );
    expect(header(0, 0)).toContain(i18n.t('quota_management.load_all'));
    const loaded = header(1, 1);
    expect(loaded).toContain(i18n.t('quota_management.refresh_all_credentials'));
    expect(loaded).toContain('1 needs attention');
  });
});
