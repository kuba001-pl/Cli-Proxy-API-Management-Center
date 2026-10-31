import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getSegmentedControlNextIndex } from '../src/components/ui/segmentedControlNavigation';
import { ProgressBar } from '../src/components/ui/ProgressBar';
import { SegmentedControl } from '../src/components/ui/SegmentedControl';
import { ToggleSwitch } from '../src/components/ui/ToggleSwitch';

describe('foundation segmented control keyboard navigation', () => {
  const options = [{}, { disabled: true }, {}, { disabled: true }];

  test('arrows skip disabled options and wrap at both ends', () => {
    expect(getSegmentedControlNextIndex(options, 0, 'ArrowRight')).toBe(2);
    expect(getSegmentedControlNextIndex(options, 2, 'ArrowRight')).toBe(0);
    expect(getSegmentedControlNextIndex(options, 0, 'ArrowLeft')).toBe(2);
    expect(getSegmentedControlNextIndex(options, 0, 'ArrowDown')).toBe(2);
    expect(getSegmentedControlNextIndex(options, 0, 'ArrowUp')).toBe(2);
  });

  test('Home and End target the first and last enabled options', () => {
    expect(getSegmentedControlNextIndex(options, 2, 'Home')).toBe(0);
    expect(getSegmentedControlNextIndex(options, 0, 'End')).toBe(2);
  });

  test('RTL reverses horizontal arrows while preserving vertical arrows', () => {
    const enabled = [{}, {}, {}];
    expect(getSegmentedControlNextIndex(enabled, 1, 'ArrowRight', true)).toBe(0);
    expect(getSegmentedControlNextIndex(enabled, 1, 'ArrowLeft', true)).toBe(2);
    expect(getSegmentedControlNextIndex(enabled, 1, 'ArrowDown', true)).toBe(2);
  });

  test('handles missing selection, disabled groups, and unrelated keys', () => {
    expect(getSegmentedControlNextIndex(options, -1, 'ArrowRight')).toBe(0);
    expect(getSegmentedControlNextIndex(options, -1, 'ArrowLeft')).toBe(2);
    expect(getSegmentedControlNextIndex([{ disabled: true }], 0, 'End')).toBeNull();
    expect(getSegmentedControlNextIndex([], -1, 'ArrowRight')).toBeNull();
    expect(getSegmentedControlNextIndex(options, 0, 'Tab')).toBeNull();
  });

  test('provides a named radio group with one enabled tab stop', () => {
    const markup = renderToStaticMarkup(
      createElement(SegmentedControl, {
        options: [
          { value: 'all', label: 'All' },
          { value: 'enabled', label: 'Enabled' },
          { value: 'disabled', label: 'Disabled', disabled: true },
        ],
        value: 'enabled',
        onChange: () => {},
        ariaLabel: 'Credential status',
      })
    );
    expect(markup).toContain('role="radiogroup" aria-label="Credential status"');
    expect(markup.match(/role="radio"/g)).toHaveLength(3);
    expect(markup.match(/tabindex="0"/g)).toHaveLength(1);
    expect(markup).toContain('aria-checked="true" tabindex="0"');
    expect(markup).toContain('disabled=""');
  });

  test('falls back to the first enabled tab stop when selection is disabled', () => {
    const markup = renderToStaticMarkup(
      createElement(SegmentedControl, {
        options: [
          { value: 'disabled', label: 'Disabled', disabled: true },
          { value: 'all', label: 'All' },
        ],
        value: 'disabled',
        onChange: () => {},
        ariaLabel: 'Credential status',
      })
    );
    expect(markup).toContain('aria-checked="true" tabindex="-1" disabled=""');
    expect(markup).toContain('aria-checked="false" tabindex="0"');
  });
});

describe('foundation progress accessibility', () => {
  const render = (value?: number) =>
    renderToStaticMarkup(createElement(ProgressBar, { value, ariaLabel: 'Quota remaining' }));

  test('exposes the same bounded value visually and to assistive technology', () => {
    expect(render(120)).toContain('aria-valuenow="100"');
    expect(render(120)).toContain('width:100%');
    expect(render(-10)).toContain('aria-valuenow="0"');
    expect(render(-10)).toContain('width:0%');
    expect(render(42.5)).toContain('aria-valuenow="42.5"');
    expect(render(42.5)).toContain('aria-label="Quota remaining"');
  });

  test('omits the current value for indeterminate and invalid input', () => {
    for (const value of [undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(render(value)).not.toContain('aria-valuenow');
      expect(render(value)).not.toContain('NaN');
    }
  });
});

test('foundation toggle exposes its switch state and accessible name', () => {
  const markup = renderToStaticMarkup(
    createElement(ToggleSwitch, { checked: true, onChange: () => {}, ariaLabel: 'Enable provider' })
  );
  expect(markup).toContain('role="switch"');
  expect(markup).toContain('aria-label="Enable provider"');
  expect(markup).toContain('checked=""');
});
