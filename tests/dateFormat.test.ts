import { describe, expect, test } from 'bun:test';
import {
  formatDisplayDate,
  formatDisplayDateTime,
  formatDisplayDay,
  formatDisplayTime,
  formatDisplayTimestamp,
  resolveDisplayLocale,
} from '@/utils/dateFormat';
import { parseUnixTimestamp } from '@/utils/format';
import { formatInstantShort } from '@/utils/quota';

// Local-time instant so the expectations don't depend on the runner's timezone.
const instant = new Date(2026, 10, 6, 23, 2).getTime();

describe('shared display date format', () => {
  test('spells the month and uses a 24-hour clock in the UI language', () => {
    expect(formatDisplayDay(instant, 'en')).toBe('Fri, Nov 6');
    expect(formatDisplayTime(instant, 'en')).toBe('23:02');
    expect(formatDisplayDateTime(instant, 'en')).toBe('Nov 6, 23:02');
    expect(formatDisplayDate(instant, 'en')).toBe('Nov 6, 2026');
    expect(formatDisplayTimestamp(instant, 'en')).toBe('Nov 6, 2026, 23:02');
    expect(formatDisplayDateTime(instant, 'zh-CN')).toBe('11月6日 23:02');
  });

  test('never uses ambiguous numeric day/month orders', () => {
    for (const locale of ['en', 'ru', 'tr', 'vi', 'ko', 'zh-TW']) {
      expect(formatDisplayDateTime(instant, locale)).not.toMatch(/\b(11[./-]0?6|0?6[./-]11)\b/);
    }
  });

  test('invalid input renders a dash and unknown locales fall back', () => {
    expect(formatDisplayDateTime(Number.NaN)).toBe('-');
    expect(formatDisplayDay(new Date('nope'))).toBe('-');
    expect(formatDisplayTime(instant, 'not a locale!!')).toMatch(/23/);
  });

  test('quota reset labels share the same shape', () => {
    expect(formatInstantShort(instant)).toBe(formatDisplayDateTime(instant));
    expect(resolveDisplayLocale('vi')).toBe('vi');
  });

  test('unix timestamps in any unit parse to the same instant', () => {
    const seconds = Math.floor(instant / 1000);
    expect(parseUnixTimestamp(seconds)?.getTime()).toBe(seconds * 1000);
    expect(parseUnixTimestamp(seconds * 1000)?.getTime()).toBe(seconds * 1000);
    expect(parseUnixTimestamp(seconds * 1_000_000)?.getTime()).toBe(seconds * 1000);
    expect(parseUnixTimestamp('')).toBeNull();
    expect(parseUnixTimestamp('not a date')).toBeNull();
  });
});
