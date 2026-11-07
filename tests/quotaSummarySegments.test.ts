import { beforeAll, describe, expect, mock, test } from 'bun:test';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '../src/i18n/index';
import type { QuotaFileEntry } from '../src/features/quota/logic';
import type { QuotaCardState } from '../src/features/quota/providers';
import type { CodexQuotaState } from '../src/types';

// Bun resolves CSS Modules to a path string; echo class names so selectors can be counted.
const echo = () => ({
  default: new Proxy({}, { get: (_, key) => (typeof key === 'string' ? key : undefined) }),
});
mock.module(join(import.meta.dir, '../src/features/quota/components/QuotaBody.module.scss'), echo);
mock.module(
  join(import.meta.dir, '../src/features/quota/components/QuotaOverview.module.scss'),
  echo
);

const { QuotaSummary } = await import('../src/features/quota/components/QuotaOverview');

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

const now = Date.now();
const codexAt = (weeklyUsed: number): CodexQuotaState => ({
  status: 'success',
  windows: [
    {
      id: 'weekly',
      label: 'Weekly',
      usedPercent: weeklyUsed,
      resetLabel: '',
      resetAtMs: now + 60_000,
      periodHours: 168,
    },
  ],
});

describe('quota summary bar', () => {
  test('splits the provider bar into one segment per credential, not just the lowest', () => {
    const entries: QuotaFileEntry[] = ['a.json', 'b.json', 'c.json'].map((name) => ({
      file: { name, type: 'codex', email: `${name}@example.com` },
      type: 'codex',
    }));
    const quotas: Record<string, CodexQuotaState> = {
      'a.json': codexAt(20),
      'b.json': codexAt(70),
      'c.json': codexAt(50),
    };
    const html = renderToStaticMarkup(
      createElement(QuotaSummary, {
        entries,
        quotaFor: (entry: QuotaFileEntry) =>
          quotas[entry.file.name as string] as unknown as QuotaCardState,
        resolvedTheme: 'dark',
        onLoadAll: () => {},
      })
    );

    const segments = html.match(/<div class="meters">([\s\S]*?)<\/div><p class="reset">/);
    expect(segments).not.toBeNull();
    // Three credentials -> three titled segments, each naming its own level.
    const titles = [...segments![1].matchAll(/title="([^"]+)"/g)].map((match) => match[1]);
    expect(titles).toHaveLength(3);
    expect(titles.map((title) => title.split(' · ')[1])).toEqual(['80%', '30%', '50%']);
    // The headline still states the lowest credential.
    expect(html).toContain('<strong>30%</strong>');
  });
});
