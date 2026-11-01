import type { AuthFileItem } from '@/types';
import {
  PRIVACY_MASK,
  credentialFileIdentity,
  maskSensitiveText,
  privacyFileName,
  privacyIdentity,
  privacyText,
} from '@/utils/privacy';
import { deriveAuthFileIdentity } from './identity';

/**
 * Redaction targets for one credential. Account may contain an API key: use it only as a
 * redaction target, never as display text. The filename's own identity portion (everything
 * between a recognized provider/hash prefix and plan suffix, or the whole stem) is always a
 * target too: uploaded filenames need not contain the email/account the metadata reports.
 */
export function authFilePrivacyIdentities(file: AuthFileItem): string[] {
  const identity = deriveAuthFileIdentity(file);
  const fileIdentity = identity.fullName ? credentialFileIdentity(identity.fullName) : '';
  return [
    file.email,
    file.account,
    identity.kind === 'projectId' ? identity.primary : null,
    fileIdentity,
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
}

export function authFileDisplayIdentity(file: AuthFileItem, enabled: boolean) {
  const identity = deriveAuthFileIdentity(file);
  const identities = authFilePrivacyIdentities(file);
  return {
    ...identity,
    primary:
      identity.kind === 'fileName'
        ? privacyFileName(enabled, identity.primary, identities)
        : privacyIdentity(enabled, identity.primary),
    secondary: identity.secondary ? privacyFileName(enabled, file.name, identities) : null,
    fullName: privacyFileName(enabled, file.name, identities),
  };
}

/** Read privacy state at action time so long-running requests cannot expose stale identities. */
export function authFilesDisplayText(
  text: string,
  files: AuthFileItem[],
  enabled: boolean
): string {
  return privacyText(enabled, text, files.flatMap(authFilePrivacyIdentities));
}

/** Collect only known identity fields for redacting a credential JSON preview. */
export function authFileJsonIdentities(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(authFileJsonIdentities);
  return Object.entries(value).flatMap(([key, entry]) =>
    /^(email|account|username|user_name|display_name|full_name)$/i.test(key) &&
    typeof entry === 'string'
      ? [entry]
      : authFileJsonIdentities(entry)
  );
}

/**
 * Display copy of a credential JSON document with identities redacted. Works on the parsed
 * value (before serialization) so escaping cannot hide a match, e.g. `DOMAIN\\alice`.
 */
export function redactAuthFileJson(value: unknown, identities: string[]): unknown {
  const known = new Set(identities.map((identity) => identity.trim().toLowerCase()));
  const redact = (entry: unknown): unknown => {
    if (typeof entry === 'string') {
      return known.has(entry.trim().toLowerCase()) && entry.trim()
        ? PRIVACY_MASK
        : maskSensitiveText(entry, identities);
    }
    if (Array.isArray(entry)) return entry.map(redact);
    if (entry && typeof entry === 'object') {
      return Object.fromEntries(
        Object.entries(entry).map(([key, child]) => [
          maskSensitiveText(key, identities),
          redact(child),
        ])
      );
    }
    return entry;
  };
  return redact(value);
}

/** Pretty JSON preview text, redacted when privacy is enabled; invalid JSON is masked as text. */
export function authFileJsonPreview(text: string, identities: string[], enabled: boolean): string {
  if (!text) return '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return privacyText(enabled, text, identities);
  }
  return JSON.stringify(enabled ? redactAuthFileJson(parsed, identities) : parsed, null, 2);
}
