import {
  PRIVACY_MASK,
  findEmails,
  privacyFileName,
  privacyText,
  replaceEmails,
  splitCredentialFileName,
} from '@/utils/privacy';
import type { LogEntry } from './logSelectors';

// Logs are free text: recognize explicitly labelled identities without treating
// ordinary messages, request IDs or timestamps as account names.
const IDENTITY_FIELD =
  /(\b(?:username|user_name|user|account(?:[_ -]?(?:name|label))?|email)["']?(?:[ \t]*[:=]\s*|\s+))(?:"([^"]+)"|'([^']+)'|([^\s"',;|<>]+))/gi;

const FILE_EXTENSION = /\.(?:json|log|txt)$/i;

export function logIdentities(text: string): string[] {
  const identities = new Set<string>();
  for (const match of text.matchAll(IDENTITY_FIELD)) {
    identities.add(match[2] ?? match[3] ?? match[4]);
  }
  for (const email of findEmails(text)) {
    // The generic email matcher can include a credential/log file extension.
    const stem = email.replace(FILE_EXTENSION, '');
    identities.add(stem);
    // Credential names (`claude-5aebc0bd-jane@x.test.json`) also expose the bare account.
    const credential = splitCredentialFileName(stem);
    if (credential.prefix && credential.identity) identities.add(credential.identity);
  }
  return [...identities];
}

/**
 * The email matcher swallows a credential file's provider/hash prefix as part of the local
 * part, so mask those tokens as file names first: keep provider, hash and plan segments and
 * dot out only the account (`antigravity-••••••••••••••••.json`).
 */
const maskCredentialFileNames = (text: string): string =>
  replaceEmails(text, (token) => {
    const extension = token.match(FILE_EXTENSION)?.[0] ?? '';
    const stem = extension ? token.slice(0, -extension.length) : token;
    const { prefix, identity } = splitCredentialFileName(stem);
    if (!prefix || !identity) return token;
    return privacyFileName(true, stem, [identity]) + extension;
  });

export function privacyLogText(
  enabled: boolean,
  text: string,
  identities = logIdentities(enabled ? text : '')
): string {
  if (!enabled) return text;
  return privacyText(true, maskCredentialFileNames(text), identities).replace(
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
