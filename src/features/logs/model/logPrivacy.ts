import {
  PRIVACY_MASK,
  findEmails,
  privacyFileName,
  privacyText,
  splitCredentialFileName,
} from '@/utils/privacy';
import type { LogEntry } from './logSelectors';

// Logs are free text: recognize explicitly labelled identities without treating
// ordinary messages, request IDs or timestamps as account names.
const IDENTITY_FIELD =
  /(\b(?:username|user_name|user|account(?:[_ -]?(?:name|label))?|email)["']?(?:[ \t]*[:=]\s*|\s+))(?:"([^"]+)"|'([^']+)'|([^\s"',;|<>]+))/gi;

const FILE_EXTENSION = /\.(?:json|log|txt)$/i;
const FILE_EXTENSIONS = ['.json', '.log', '.txt'];
/** Characters that cannot be part of a bare file name inside a log line or path. */
const FILE_NAME_STOP = /[\s'"`<>()[\]{},;:|/\\=]/u;

type FileToken = { start: number; end: number; stem: string; extension: string };

/**
 * Bare `*.json` / `*.log` / `*.txt` file names in free text, found in linear time: every
 * extension scans back only to the previous token or a path/stop character, so the name
 * of `/home/u/.cli-proxy-api/codex-alice.json` is `codex-alice.json`.
 */
const findFileTokens = (text: string): FileToken[] => {
  const lower = text.toLowerCase();
  const hits: Array<{ dot: number; extension: string }> = [];
  for (const extension of FILE_EXTENSIONS) {
    for (let dot = lower.indexOf(extension); dot !== -1; dot = lower.indexOf(extension, dot + 1)) {
      const end = dot + extension.length;
      if (end < text.length && /[\p{L}\p{N}_-]/u.test(text[end])) continue;
      hits.push({ dot, extension: text.slice(dot, end) });
    }
  }
  hits.sort((a, b) => a.dot - b.dot);
  const tokens: FileToken[] = [];
  let floor = 0;
  for (const { dot, extension } of hits) {
    if (dot < floor) continue;
    let start = dot;
    while (start > floor && !FILE_NAME_STOP.test(text[start - 1])) start -= 1;
    const end = dot + extension.length;
    if (start < dot) tokens.push({ start, end, stem: text.slice(start, dot), extension });
    floor = end;
  }
  return tokens;
};

/** `provider-[hash-]identity[-plan]` credential stems, independent of email syntax. */
const credentialIdentity = (stem: string): string => {
  const { prefix, identity } = splitCredentialFileName(stem);
  return prefix && identity ? identity : '';
};

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
    const identity = credentialIdentity(stem);
    if (identity) identities.add(identity);
  }
  // Non-email credential names (`codex-alice.json`, `claude-5aebc0bd-alice-plus.json`)
  // name the account too; other mentions of it in the same line are masked as well.
  for (const { stem } of findFileTokens(text)) {
    const identity = credentialIdentity(stem);
    if (identity) identities.add(identity);
  }
  return [...identities];
}

/**
 * Credential file names keep their provider, hash and plan segments and only dot out the
 * account (`antigravity-••••••••••••••••.json`), whether or not the account is an email.
 * Runs before the email matcher, which would otherwise swallow the provider/hash prefix.
 */
const maskCredentialFileNames = (text: string, identities: string[]): string => {
  const tokens = findFileTokens(text);
  if (tokens.length === 0) return text;
  let result = '';
  let cursor = 0;
  for (const { start, end, stem, extension } of tokens) {
    const identity = credentialIdentity(stem);
    if (!identity) continue;
    result += text.slice(cursor, start) + privacyFileName(true, stem, [identity, ...identities]);
    result += extension;
    cursor = end;
  }
  return result + text.slice(cursor);
};

export function privacyLogText(
  enabled: boolean,
  text: string,
  identities = logIdentities(enabled ? text : '')
): string {
  if (!enabled) return text;
  return privacyText(true, maskCredentialFileNames(text, identities), identities).replace(
    IDENTITY_FIELD,
    (_match, prefix: string) => `${prefix}${PRIVACY_MASK}`
  );
}

export function privacyLogFileName(enabled: boolean, name: string): string {
  if (!enabled) return name;
  const extension = name.match(/\.(?:log|json|txt)$/i)?.[0] ?? '';
  const stem = extension ? name.slice(0, -extension.length) : name;
  // Derive identities from the complete name: the credential-token finder needs the extension,
  // and the bare stem (`codex-alice`) is itself a credential name.
  const stemIdentity = credentialIdentity(stem);
  const identities = [...logIdentities(name), ...(stemIdentity ? [stemIdentity] : [])];
  return privacyLogText(true, privacyFileName(true, stem, identities), identities) + extension;
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
