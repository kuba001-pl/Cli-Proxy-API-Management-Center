/**
 * Fix-round regressions for Quota, Dashboard and the shell (B01–B08, A09/A12/A14/A15,
 * C02/C04/C12). Logic is tested directly; one-border/one-divider layout rules are pinned
 * as source contracts because there is no browser DOM harness.
 */

import { beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '@/i18n';
import { resolveNavTarget } from '@/components/layout/navTarget';
import { quotaListErrorIdentities } from '@/features/quota/privacy';
import { AntigravityQuotaBody } from '@/features/quota/providers/antigravity/AntigravityQuotaBody';
import { CodexQuotaBody } from '@/features/quota/providers/codex/CodexQuotaBody';
import { QUOTA_CLASS_KEYS, bindQuotaClasses } from '@/features/quota/types';
import { PRIVACY_MASK, privacyText } from '@/utils/privacy';
import { HOUR_MS } from '@/utils/time/durations';
import type { AntigravityQuotaState, CodexQuotaState } from '@/types';

const classes = bindQuotaClasses(
  Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, key])),
  'test-host'
);
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const rule = (css: string, selector: string) => {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('\n}', start));
};
const now = Date.now();

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

describe('quota body split (B05/B06)', () => {
  const codex: CodexQuotaState = {
    status: 'success',
    planType: 'plus',
    windows: [
      {
        id: 'primary',
        label: '5-hour limit',
        usedPercent: 40,
        resetLabel: '08-02 18:00',
        resetAtMs: now + 3 * HOUR_MS,
      },
    ],
  };
  const render = (part?: 'plan' | 'details') =>
    renderToStaticMarkup(createElement(CodexQuotaBody, { quota: codex, classes, part }));

  test('plan part renders only the plan summary for the identity column', () => {
    const html = render('plan');
    expect(html).toContain('codexPlan');
    expect(html).toContain('Plus');
    expect(html).not.toContain('quotaRow');
  });

  test('details part omits the plan; omitted part keeps the full Auth Files body', () => {
    expect(render('details')).not.toContain('codexPlan');
    expect(render('details')).toContain('quotaRow');
    const full = render();
    expect(full).toContain('codexPlan');
    expect(full).toContain('quotaRow');
  });

  test('Antigravity details flatten groups into group-qualified compact meters', () => {
    const quota: AntigravityQuotaState = {
      status: 'success',
      subscription: { plan: 'pro', tierName: null, tierId: null },
      groups: [
        {
          id: 'gemini',
          label: 'Gemini Pro models',
          buckets: [
            {
              id: 'g-5h',
              label: '5-hour limit',
              remainingFraction: 0.62,
              resetTime: new Date(now + 2 * HOUR_MS).toISOString(),
            },
          ],
        },
      ],
    };
    const details = renderToStaticMarkup(
      createElement(AntigravityQuotaBody, { quota, classes, part: 'details' })
    );
    expect(details).not.toContain('antigravityQuotaGroupTitle');
    expect(details).not.toContain('codexPlan');
    expect(details).toContain(' · ');
    expect(details).toContain('>62% left<');
    expect(details).not.toContain('remaining');
    // Auth Files keeps the grouped layout.
    const full = renderToStaticMarkup(createElement(AntigravityQuotaBody, { quota, classes }));
    expect(full).toContain('antigravityQuotaGroupTitle');
  });
});

describe('privacy (C04 dashboard, C12 quota list errors)', () => {
  test('dashboard proxy readout masks URL userinfo through privacyText', () => {
    expect(privacyText(true, 'socks5://alice:pw@127.0.0.1:1080')).toBe(
      `socks5://${PRIVACY_MASK}@127.0.0.1:1080`
    );
    expect(read('src/features/dashboard/DashboardPage.tsx')).toMatch(
      /privacyText\(privacyEnabled, config\?\.proxyUrl/
    );
  });

  test('quota list errors mask known and filename-only identities', () => {
    const files = [
      { name: 'codex-dbffca66-alice-plus.json', type: 'codex' },
      { name: 'claude-x.json', type: 'claude', email: 'bob@example.test' },
    ];
    const text = privacyText(
      true,
      'read codex-dbffca66-alice-plus.json for bob@example.test failed',
      quotaListErrorIdentities(files)
    );
    expect(text).not.toContain('alice');
    expect(text).not.toContain('bob@');
    const page = read('src/features/quota/QuotaPage.tsx');
    expect(page).toContain('privacyText(privacyEnabled, error, quotaListErrorIdentities(files))');
    expect(page).toContain('{errorText}');
  });
});

describe('dashboard alias nav (A15)', () => {
  test('the Dashboard entry targets the alias while it is the current route', () => {
    expect(resolveNavTarget('/', '/dashboard')).toBe('/dashboard');
    expect(resolveNavTarget('/', '/dashboard/')).toBe('/dashboard');
    expect(resolveNavTarget('/', '/')).toBe('/');
    expect(resolveNavTarget('/', '/quota')).toBe('/');
    expect(resolveNavTarget('/quota', '/dashboard')).toBe('/quota');
  });
});

describe('single borders and dividers (B01–B04, B08, A12)', () => {
  test('Quota tabs row draws no second rule under ProviderTabs', () => {
    expect(rule(read('src/features/quota/QuotaPage.module.scss'), '.tabsRow')).not.toContain(
      'border'
    );
  });

  test('Quota empty state has one dashed outline and no nested EmptyState card', () => {
    const page = read('src/features/quota/QuotaPage.tsx');
    expect(page).not.toContain('<EmptyState');
    expect(rule(read('src/features/quota/QuotaPage.module.scss'), '.emptyState')).toContain(
      'min-height: 118px'
    );
  });

  test('a failed list read never renders the empty or zero state', () => {
    const page = read('src/features/quota/QuotaPage.tsx');
    expect(page).toContain('const isEmpty = !loading && !error');
    expect(page).toContain('countsUnavailable={!loading && Boolean(error)}');
  });

  test('timeline: no nested chart frame, no doubled axis rule, no extra active contour', () => {
    const css = read('src/features/quota/components/QuotaTimeline.module.scss');
    expect(rule(css, '.chart')).not.toContain('border');
    expect(css).not.toMatch(/\n\.axis \{[^}]*border/);
    expect(css).not.toContain('border-color: var(--border-hover)');
  });

  test('provider tab counts are plain text, active included', () => {
    const css = read('src/features/authFiles/components/ProviderTabs.module.scss');
    expect(rule(css, '.tabCount')).not.toContain('background');
  });
});
