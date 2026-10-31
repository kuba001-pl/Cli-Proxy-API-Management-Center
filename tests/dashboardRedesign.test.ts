import { beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import i18n from '@/i18n';

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

describe('dashboard redesign', () => {
  test('renders the page heading, route actions and all five live-data stat labels', () => {
    const markup = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(DashboardPage))
    );
    expect(markup).toMatch(/<h1[^>]*>Dashboard<\/h1>/);
    for (const label of [
      'hero_requests_label',
      'success_rate',
      'stat_credentials',
      'stat_provider_keys',
      'stat_models',
    ] as const) {
      expect(markup).toContain(i18n.t(`dashboard.${label}`));
    }
    expect(markup).toContain('href="/logs"');
    expect(markup).toContain('href="/ai-providers"');
    // Additional existing features remain reachable through the disclosure.
    expect(markup).toContain('<details');
    expect(markup).toContain(i18n.t('dashboard.runtime_title'));
    expect(markup).toContain(i18n.t('dashboard.fleet_title'));
  });

  test('retains shared reveal/count-up helpers and neutral stat typography', () => {
    const source = readFileSync('src/features/dashboard/DashboardPage.tsx', 'utf8');
    expect(source).toContain('useCountUp(traffic.total, connected)');
    expect(source).toContain('useRevealGroup<HTMLElement>');
    expect(source).toContain('useRevealOnScroll<HTMLElement>');
    const styles = readFileSync('src/features/dashboard/dashboard.module.scss', 'utf8');
    expect(styles).toMatch(/\.statValue\s*\{[^}]*font-size: 28px;/);
    expect(styles).toMatch(/\.statLabel,[\s\S]*?text-transform: uppercase;/);
    expect(styles).not.toMatch(/gradient|backdrop-filter|box-shadow|#[a-f0-9]{3,8}\b/i);
  });
});
