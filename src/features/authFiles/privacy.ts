import type { AuthFileItem } from '@/types';
import { privacyFileName, privacyIdentity, privacyText } from '@/utils/privacy';
import { deriveAuthFileIdentity } from './identity';

/** Account may contain an API key: use it only as a redaction target, never as display text. */
export function authFilePrivacyIdentities(file: AuthFileItem): string[] {
  const identity = deriveAuthFileIdentity(file);
  const identities = [
    file.email,
    file.account,
    identity.kind === 'projectId' ? identity.primary : null,
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  // A filename-only credential has no reliable identity split; conceal its whole stem.
  return identities.length > 0 ? identities : [identity.primary].filter(Boolean);
}

export function authFileDisplayIdentity(file: AuthFileItem, enabled: boolean) {
  const identity = deriveAuthFileIdentity(file);
  const identities = authFilePrivacyIdentities(file);
  return {
    ...identity,
    primary:
      identity.kind === 'fileName' && identities.some((id) => id !== identity.primary)
        ? privacyFileName(
            enabled,
            identity.primary,
            identities.filter((id) => id !== identity.primary)
          )
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
