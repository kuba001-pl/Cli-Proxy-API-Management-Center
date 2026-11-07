import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuotaMeter } from '@/features/quota/components/QuotaMeter';
import { bindQuotaClasses, QUOTA_CLASS_KEYS } from '@/features/quota/types';
import en from '@/i18n/locales/en.json';
import zhCN from '@/i18n/locales/zh-CN.json';
import zhTW from '@/i18n/locales/zh-TW.json';
import ru from '@/i18n/locales/ru.json';
import vi from '@/i18n/locales/vi.json';
import ko from '@/i18n/locales/ko.json';
import tr from '@/i18n/locales/tr.json';

const classes = bindQuotaClasses(
  Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, key])),
  'test'
);
const read = (path: string) => readFileSync(path, 'utf8');

describe('quota meter status presentation', () => {
  test.each([
    // Amber ("Medium") is reserved for the stated low threshold (< 20% left).
    [100, 'High'],
    [70, 'High'],
    [46, 'High'],
    [20, 'High'],
    [19, 'Medium'],
    [1, 'Medium'],
    [0, 'Low'],
  ])('renders %s remaining with %s status', (percent, tone) => {
    const markup = renderToStaticMarkup(
      createElement(QuotaMeter, { percent: Number(percent), classes })
    );
    expect(markup).toContain(`quotaBarFill${tone}`);
    expect(markup).toContain(`width:${percent}%`);
  });
  test.each([null, NaN, Infinity])('renders unknown/non-finite %s as an empty track', (percent) => {
    const markup = renderToStaticMarkup(createElement(QuotaMeter, { percent, classes }));
    expect(markup).toContain('width:0%');
    expect(markup).not.toMatch(/NaN|Infinity/);
  });
  test('clamps percentages without changing the caller value', () => {
    expect(renderToStaticMarkup(createElement(QuotaMeter, { percent: 120, classes }))).toContain(
      'width:100%'
    );
    expect(renderToStaticMarkup(createElement(QuotaMeter, { percent: -2, classes }))).toContain(
      'width:0%'
    );
  });
});

describe('quota redesign state and locale contracts', () => {
  test('keeps loading skeletons, error alerts, idle refresh and provider-owned unsupported states', () => {
    const card = read('src/features/quota/components/QuotaCard.tsx');
    expect(card).toContain('aria-busy="true"');
    expect(card).toContain('styles.skeletonReset');
    expect(card).toContain('role="alert"');
    expect(card).toContain('IconAlertTriangle size={16}');
    expect(card).toContain("status === 'idle'");
    expect(card).toContain('<adapter.Body');
    expect(card).toContain(
      'isQuotaRefreshDisabled(canRefresh, loading, resetting || claudeReset.busy)'
    );
    const page = read('src/features/quota/QuotaPage.tsx');
    expect(page).toContain("t('quota_management.search_empty_title')");
    expect(page).toContain("t('quota_management.empty_title')");
  });

  test('uses semantic tracks and status colors on a neutral surface', () => {
    const body = read('src/features/quota/components/QuotaBody.module.scss');
    for (const token of [
      '--meter-track',
      '--status-success',
      '--status-warning',
      '--status-danger',
    ]) {
      expect(body).toContain(`var(${token})`);
    }
    const card = read('src/features/quota/components/QuotaCard.module.scss');
    expect(card).not.toMatch(/gradient|box-shadow|#[a-f0-9]{3,8}\b/i);
    expect(card).toContain('@media (prefers-reduced-motion: reduce)');
  });

  test('all new copy and accessible filter labels exist in every locale', () => {
    const keys = [
      'summary_label',
      'lowest',
      'upcoming_title',
      'upcoming_description',
      'upcoming_filter',
      'upcoming_empty',
      'upcoming_show_all',
      'upcoming_show_less',
    ] as const;
    for (const locale of [en, zhCN, zhTW, ru, vi, ko, tr]) {
      for (const key of keys) expect(locale.quota_management[key].trim().length).toBeGreaterThan(0);
      expect(locale.quota_management.upcoming_show_all).toContain('{{count}}');
    }
  });
});
