/**
 * Privacy-mode masking helpers. React-free so they can be unit tested.
 *
 * Rules (from the CPAMC redesign, Figma "Auth Files · Privacy Mode (Masked)"):
 * - Emails / usernames / account names are replaced by a fixed-length run of
 *   dots. Nothing of the original leaks: no first/last letter, no @domain, and
 *   no length information.
 * - Credential file names keep their provider prefix, hash and suffix, but every
 *   identity portion (known identities + anything email-shaped) is dotted out,
 *   e.g. `antigravity-••••••••••••••••.json`.
 */

export const PRIVACY_MASK = '•'.repeat(16);

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Mask a personal identifier (email, username, account label) completely. */
export const maskIdentity = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim() ? PRIVACY_MASK : '';
};

/**
 * Variants under which an identity may appear inside a file name. Backends
 * sometimes sanitize `@` and `.` to `_` or `-` when building credential names.
 */
const identityVariants = (identity: string): string[] => {
  const trimmed = identity.trim();
  if (trimmed.length < 3) return [];
  const variants = new Set<string>([trimmed]);
  for (const sep of ['_', '-']) {
    variants.add(trimmed.replace(/[@.]/g, sep));
    variants.add(trimmed.replace(/@/g, sep));
  }
  return [...variants].sort((a, b) => b.length - a.length);
};

/** Replace every identity portion of free text (file names, log lines…) with dots. */
export const maskSensitiveText = (
  text: string | null | undefined,
  identities: Array<string | null | undefined> = []
): string => {
  if (text === null || text === undefined) return '';
  let result = String(text);
  for (const identity of identities) {
    if (!identity) continue;
    for (const variant of identityVariants(identity)) {
      result = result.replace(new RegExp(escapeRegExp(variant), 'gi'), PRIVACY_MASK);
    }
  }
  return result.replace(EMAIL_PATTERN, PRIVACY_MASK);
};

/** Mask the identity portion of a credential file name, keeping prefix/hash/suffix. */
export const maskFileName = (
  fileName: string | null | undefined,
  identities: Array<string | null | undefined> = []
): string => maskSensitiveText(fileName, identities);

/** Convenience: apply masking only when privacy mode is enabled. */
export const privacyIdentity = (enabled: boolean, value: string | null | undefined): string =>
  enabled ? maskIdentity(value) : (value ?? '');

export const privacyFileName = (
  enabled: boolean,
  fileName: string | null | undefined,
  identities: Array<string | null | undefined> = []
): string => (enabled ? maskFileName(fileName, identities) : (fileName ?? ''));

export const privacyText = (
  enabled: boolean,
  text: string | null | undefined,
  identities: Array<string | null | undefined> = []
): string => (enabled ? maskSensitiveText(text, identities) : (text ?? ''));
