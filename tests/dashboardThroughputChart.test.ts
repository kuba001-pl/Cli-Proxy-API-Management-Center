import { beforeAll, describe, expect, mock, test } from 'bun:test';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '@/i18n';
import type { TrafficWindow } from '@/features/dashboard/types';
import { axisMax } from '@/features/dashboard/utils';

// Bun resolves CSS Modules to a path string; echo class names so markup can be inspected.
mock.module(
  join(import.meta.dir, '../src/features/dashboard/components/ThroughputChart.module.scss'),
  () => ({
    default: new Proxy({}, { get: (_, key) => (typeof key === 'string' ? key : undefined) }),
  })
);

const { ThroughputChart } = await import('@/features/dashboard/components/ThroughputChart');

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

const start = Date.UTC(2026, 10, 6, 12, 0);
const traffic = (rows: Array<[number, number]>): TrafficWindow => {
  const buckets = rows.map(([success, failed], index) => ({
    time: new Date(start + index * 600_000).toISOString(),
    success,
    failed,
  }));
  const totals = buckets.map((bucket) => bucket.success + bucket.failed);
  const peakTotal = Math.max(...totals);
  const totalSuccess = rows.reduce((sum, [success]) => sum + success, 0);
  const totalFailure = rows.reduce((sum, [, failed]) => sum + failed, 0);
  return {
    buckets,
    totalSuccess,
    totalFailure,
    total: totalSuccess + totalFailure,
    successRate: (totalSuccess / (totalSuccess + totalFailure)) * 100,
    peakTotal,
    peakIndex: totals.indexOf(peakTotal),
    windowMinutes: rows.length * 10,
  };
};

const render = (window: TrafficWindow) =>
  renderToStaticMarkup(createElement(ThroughputChart, { traffic: window }));

describe('throughput chart', () => {
  test('labels the success peak at its plotted height, not the unplotted bucket total', () => {
    // Bucket 1 has the largest total (100 + 100) but bucket 2 has the highest success line.
    const window = traffic([
      [40, 0],
      [100, 100],
      [150, 0],
      [20, 5],
    ]);
    const markup = render(window);
    const label = markup.match(
      /<span class="peakLabel" style="bottom:([\d.]+)%"[^>]*>([^<]+)<\/span>/
    );
    expect(label).not.toBeNull();
    expect(label![2]).toBe('150');
    const expected = (150 / axisMax(window.peakTotal, 4)) * 100;
    expect(Number(label![1])).toBeCloseTo(expected, 3);
    expect(markup.match(/class="peakLabel"/g)).toHaveLength(1);
  });

  test('buckets form one Tab stop, defaulting to the most recent bucket', () => {
    const markup = render(
      traffic([
        [10, 1],
        [12, 0],
        [9, 2],
      ])
    );
    expect(markup.match(/tabindex="0"/g)).toHaveLength(1);
    expect(markup.match(/tabindex="-1"/g)).toHaveLength(2);
    const buttons = [...markup.matchAll(/<button[^>]*tabindex="(-?\d)"/g)].map((m) => m[1]);
    expect(buttons).toEqual(['-1', '-1', '0']);
  });

  test('keeps the visible scope short and the keyboard hint for assistive tech', () => {
    // Visible copy states the unit and window only; how to explore the chart is an aria hint.
    const copy = i18n.t('dashboard.traffic_description', { window: '3h 20m' });
    expect(copy).toContain('3h 20m');
    expect(copy).not.toMatch(/hover|arrow keys/i);
    const hint = i18n.t('dashboard.traffic_keyboard_hint');
    expect(hint).not.toMatch(/column/i);
    expect(hint).toMatch(/arrow keys/);
    const markup = render(
      traffic([
        [10, 1],
        [12, 0],
      ])
    );
    const describedBy = markup.match(/role="group"[^>]*aria-describedby="([^"]+)"/)?.[1];
    expect(describedBy).toBeTruthy();
    expect(markup).toContain(`id="${describedBy}"`);
    expect(markup).toContain(hint);
  });
});
