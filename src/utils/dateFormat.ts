/**
 * One human date/time convention for the whole UI.
 *
 * Reset times, observation times and file metadata used to mix `11/06`, `10.11, 23:02` and
 * `6.11.2026`: numeric day/month orders that read differently per browser locale. These helpers
 * always spell the month (`Fri, Nov 6` / `Nov 10, 23:02` / `Nov 6, 2026` in English,
 * `11月10日 23:02` in Chinese), use a 24-hour clock and follow the UI language rather than the
 * browser's regional default. Raw ISO timestamps in logs and source stay untouched.
 */

type DateInput = number | Date;

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The UI language (`<html lang>` is kept in sync by App), falling back to the runtime default. */
export function resolveDisplayLocale(locale?: string): string | undefined {
  if (locale) return locale;
  if (typeof document !== 'undefined') {
    const lang = document.documentElement?.lang?.trim();
    if (lang) return lang;
  }
  return undefined;
}

function getFormatter(locale: string | undefined, options: Intl.DateTimeFormatOptions) {
  const resolved = resolveDisplayLocale(locale);
  const key = `${resolved ?? ''}|${JSON.stringify(options)}`;
  const cached = formatters.get(key);
  if (cached) return cached;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat(resolved, options);
  } catch {
    // An unexpected language tag throws RangeError; a date in the default locale beats none.
    formatter = new Intl.DateTimeFormat(undefined, options);
  }
  formatters.set(key, formatter);
  return formatter;
}

function toValidDate(value: DateInput): Date | null {
  const date = typeof value === 'number' ? new Date(value) : value;
  return Number.isFinite(date.getTime()) ? date : null;
}

const DAY_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
};
const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
};
const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  ...TIME_OPTIONS,
};
const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};
const TIMESTAMP_OPTIONS: Intl.DateTimeFormatOptions = {
  ...DATE_OPTIONS,
  ...TIME_OPTIONS,
};

/** Day heading, e.g. `Fri, Nov 6`. */
export function formatDisplayDay(value: DateInput, locale?: string): string {
  const date = toValidDate(value);
  return date ? getFormatter(locale, DAY_OPTIONS).format(date) : '-';
}

/** Clock time, e.g. `23:02`. */
export function formatDisplayTime(value: DateInput, locale?: string): string {
  const date = toValidDate(value);
  return date ? getFormatter(locale, TIME_OPTIONS).format(date) : '-';
}

/** Date and time without the year, e.g. `Nov 10, 23:02` (reset times, observations). */
export function formatDisplayDateTime(value: DateInput, locale?: string): string {
  const date = toValidDate(value);
  return date ? getFormatter(locale, DATE_TIME_OPTIONS).format(date) : '-';
}

/** Calendar date with the year, e.g. `Nov 6, 2026` (file metadata, builds). */
export function formatDisplayDate(value: DateInput, locale?: string): string {
  const date = toValidDate(value);
  return date ? getFormatter(locale, DATE_OPTIONS).format(date) : '-';
}

/** Full timestamp with the year, e.g. `Nov 6, 2026, 23:02` (file modification times). */
export function formatDisplayTimestamp(value: DateInput, locale?: string): string {
  const date = toValidDate(value);
  return date ? getFormatter(locale, TIMESTAMP_OPTIONS).format(date) : '-';
}
