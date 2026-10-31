import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { statusBlockTone } from '@/components/providers/statusBlockTone';
import { ProviderStatusBar } from '@/components/providers/ProviderStatusBar';
import { Input } from '@/components/ui/Input';

const block = (success: number, failure: number) => ({
  success,
  failure,
  rate: success + failure > 0 ? success / (success + failure) : -1,
  startTime: 0,
  endTime: 1,
});

describe('status bar block tone', () => {
  test('idle, success and failure buckets map to semantic tones', () => {
    expect(statusBlockTone(block(0, 0))).toBe('idle');
    expect(statusBlockTone(block(12, 0))).toBe('success');
    expect(statusBlockTone(block(12, 1))).toBe('failure');
    expect(statusBlockTone(block(0, 3))).toBe('failure');
  });

  test('renders tone classes instead of inline RGB colors', () => {
    const html = renderToStaticMarkup(
      createElement(ProviderStatusBar, {
        statusData: {
          blockDetails: [block(0, 0), block(4, 0), block(3, 2)],
          successRate: 77,
          totalSuccess: 7,
          totalFailure: 2,
        },
        styles: {
          statusBlockIdle: 'idle',
          statusBlockSuccess: 'ok',
          statusBlockFailure: 'bad',
        },
      })
    );
    expect(html).not.toContain('rgb(');
    expect(html).toContain('data-tone="idle"');
    expect(html).toContain('data-tone="success"');
    expect(html).toContain('data-tone="failure"');
    expect(html).toContain('bad');
  });
});

describe('shared Input leading slot', () => {
  test('leading element is decorative and pads the input', () => {
    const html = renderToStaticMarkup(
      createElement(Input, { 'aria-label': 'Search', leftElement: createElement('svg') })
    );
    expect(html).toContain('class="input-leading" aria-hidden="true"');
    expect(html).toContain('input-has-leading');
  });

  test('without a leading element the class list is unchanged', () => {
    const html = renderToStaticMarkup(createElement(Input, { 'aria-label': 'Search' }));
    expect(html).toContain('class="input"');
    expect(html).not.toContain('input-leading');
  });
});
