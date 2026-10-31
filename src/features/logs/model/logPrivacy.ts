import { PRIVACY_MASK, findEmails, privacyFileName, privacyText } from '@/utils/privacy';
import type { LogEntry } from './logSelectors';

// Logs are free text: recognize explicitly labelled identities without treating
// ordinary messages, request IDs or timestamps as account names.
const IDENTITY_FIELD =
  /(\b(?:username|user_name|user|account(?:[_ -]?(?:name|label))?|email)["']?(?:[ \t]*[:=]\s*|\s+))(?:"([^"]+)"|'([^']+)'|([^\s"',;|<>]+))/gi;

export function logIdentities(text: string): string[] {
  const identities = new Set<string>();
  for (const match of text.matchAll(IDENTITY_FIELD)) {
    identities.add(match[2] ?? match[3] ?? match[4]);
  }
  for (const email of findEmails(text)) {
    // The generic email matcher can include a credential/log file extension.
    identities.add(email.replace(/\.(?:json|log|txt)$/i, ''));
  }
  return [...identities];
}

export function privacyLogText(
  enabled: boolean,
  text: string,
  identities = logIdentities(enabled ? text : '')
): string {
  if (!enabled) return text;
  return privacyText(true, text, identities).replace(
    IDENTITY_FIELD,
    (_match, prefix: string) => `${prefix}${PRIVACY_MASK}`
  );
}

export function privacyLogFileName(enabled: boolean, name: string): string {
  if (!enabled) return name;
  const extension = name.match(/\.(?:log|json|txt)$/i)?.[0] ?? '';
  const stem = extension ? name.slice(0, -extension.length) : name;
  return privacyLogText(true, privacyFileName(true, stem, logIdentities(stem))) + extension;
}

/** Parsed entries are stable across polls. Weak keys release evicted/session rows. */
export function createLogDisplayCache() {
  const cache = new WeakMap<LogEntry, LogEntry>();
  return (entry: LogEntry, enabled: boolean): LogEntry => {
    if (!enabled) return entry;
    const cached = cache.get(entry);
    if (cached) return cached;
    const identities = logIdentities(entry.raw);
    const mask = (value: string | undefined) =>
      value === undefined ? undefined : privacyLogText(true, value, identities);
    const display = {
      ...entry,
      raw: privacyLogText(true, entry.raw, identities),
      source: mask(entry.source),
      requestId: mask(entry.requestId),
      path: mask(entry.path),
      message: privacyLogText(true, entry.message, identities),
      ip: mask(entry.ip),
    };
    cache.set(entry, display);
    return display;
  };
}
