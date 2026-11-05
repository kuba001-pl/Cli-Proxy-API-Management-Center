import { describe, expect, test } from 'bun:test';
import { bucketRangeLabel, bucketStartLabel } from '../src/features/dashboard/utils';

const localIso = (hours: number, minutes: number) =>
  new Date(2026, 10, 5, hours, minutes).toISOString();

describe('dashboard bucket labels', () => {
  test('keeps backend clock ranges in server-local time', () => {
    expect(bucketStartLabel('15:04-15:14', 0, 20)).toBe('15:04');
    expect(bucketRangeLabel('15:04-15:14', 0, 20)).toBe('15:04–15:14');
    expect(bucketRangeLabel('23:54-00:04', 0, 20)).toBe('23:54–00:04');
    expect(bucketStartLabel(' 15:04 – 15:14 ', 0, 20)).toBe('15:04');
  });

  test('formats ISO timestamps as local clocks, never as the ISO year', () => {
    expect(bucketStartLabel(localIso(15, 4), 0, 20)).toBe('15:04');
    expect(bucketRangeLabel(localIso(15, 4), 0, 20)).toBe('15:04–15:14');
    expect(bucketStartLabel('2026-11-05T15:04:00', 0, 20)).toBe('15:04');
  });

  test('honors explicit ISO offsets and the ten-minute bucket duration', () => {
    const timestamp = '2026-11-05T15:04:00+05:30';
    const start = new Date(timestamp);
    const end = new Date(start.getTime() + 10 * 60_000);
    const clock = (date: Date) =>
      `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    expect(bucketStartLabel(timestamp, 0, 20)).toBe(clock(start));
    expect(bucketRangeLabel(timestamp, 0, 20)).toBe(`${clock(start)}–${clock(end)}`);
  });

  test('rolls ISO bucket ranges across midnight', () => {
    expect(bucketRangeLabel(localIso(23, 54), 19, 20)).toBe('23:54–00:04');
  });

  test('retains relative labels when timestamps are missing', () => {
    expect(bucketStartLabel(undefined, 0, 20)).toBe('-200m');
    expect(bucketRangeLabel('', 19, 20)).toBe('-10m');
  });

  test('preserves unrecognized labels instead of rendering Invalid Date', () => {
    expect(bucketStartLabel('unavailable', 0, 20)).toBe('unavailable');
    expect(bucketRangeLabel('2026-99-99Tbroken', 0, 20)).toBe('2026-99-99Tbroken');
  });
});
