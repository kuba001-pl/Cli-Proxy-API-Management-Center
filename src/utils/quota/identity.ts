import type { AuthFileItem } from '@/types';
import { credentialFileIdentity, privacyFileName, privacyIdentity } from '@/utils/privacy';
import { normalizeRecentRequestAuthIndex } from '@/utils/recentRequests';
import { isDevinFile, isPluginQuotaFile } from './validators';

const QUOTA_IDENTITY_SEPARATOR = '\0';

/**
 * Devin and backend quota providers can expose multiple credential identities
 * from one physical file, distinguished by auth_index.
 */
export function getQuotaCacheKey(file: AuthFileItem): string {
  if (!isDevinFile(file) && !isPluginQuotaFile(file)) return file.name;
  const authIndex = normalizeRecentRequestAuthIndex(file.authIndex);
  return `${file.name}${QUOTA_IDENTITY_SEPARATOR}${authIndex ?? ''}`;
}

/** Disambiguate same-name cards without ever falling back to account (a secret). */
export function getQuotaDisplayName(file: AuthFileItem): string {
  if (!isDevinFile(file) && !isPluginQuotaFile(file)) return file.name;
  const identity = file.email?.trim() || normalizeRecentRequestAuthIndex(file.authIndex);
  return identity ? `${file.name} · ${identity}` : file.name;
}

/** Resolve a cache identity back to the physical filename used by file mutations. */
export function getQuotaCacheFileName(key: string): string {
  const separatorIndex = key.indexOf(QUOTA_IDENTITY_SEPARATOR);
  return separatorIndex === -1 ? key : key.slice(0, separatorIndex);
}

/** One display label for cards, summaries, reset rows and all their tooltips. */
export function getQuotaPrivacyDisplayName(
  file: AuthFileItem,
  enabled: boolean,
  displayNameFor: (name: string) => string = (name) => name
): string {
  if (!enabled) {
    return isDevinFile(file) || isPluginQuotaFile(file)
      ? getQuotaDisplayName(file)
      : displayNameFor(file.name);
  }
  // `account` may be a secret (API key): use it only as a redaction target, never display it.
  // The filename's own identity portion is always a target too (as on Auth Files): metadata may
  // cover only part of it (`codex-alice-bob.json` with account `alice`).
  const identities = [
    file.email,
    file.account,
    file.projectId,
    credentialFileIdentity(file.name),
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  const name = privacyFileName(true, displayNameFor(file.name), identities);
  if (!isDevinFile(file) && !isPluginQuotaFile(file)) return name;
  const identity = file.email?.trim() || normalizeRecentRequestAuthIndex(file.authIndex);
  return identity ? `${name} · ${privacyIdentity(true, identity)}` : name;
}
