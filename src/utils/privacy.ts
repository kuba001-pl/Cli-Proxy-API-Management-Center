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
  if (!trimmed) return [];
  const variants = new Set<string>([trimmed]);
  for (const sep of ['_', '-']) {
    variants.add(trimmed.replace(/[@.]/g, sep));
    variants.add(trimmed.replace(/@/g, sep));
  }
  return [...variants].sort((a, b) => b.length - a.length);
};

const maskKnownIdentities = (
  text: string,
  identities: Array<string | null | undefined>
): string => {
  let result = text;
  // Longest first: a username may also be the start of an email or sanitized filename.
  const variants = [
    ...new Set(identities.flatMap((identity) => (identity ? identityVariants(identity) : []))),
  ].sort((a, b) => b.length - a.length);
  for (const variant of variants) {
    result = result.replace(new RegExp(escapeRegExp(variant), 'gi'), () => PRIVACY_MASK);
  }
  return result;
};

const knownEmails = (identities: Array<string | null | undefined>) =>
  identities.filter((identity) => {
    const trimmed = identity?.trim();
    return trimmed && trimmed.match(EMAIL_PATTERN)?.[0] === trimmed;
  });

const maskEmailText = (text: string): string =>
  text.replace(EMAIL_PATTERN, (email) => {
    // Credential/log references in free text keep their extension, not the domain before it.
    const extension = email.match(/@[^@]+\.[^@.]+(\.(?:json|log))$/i)?.[1] ?? '';
    return PRIVACY_MASK + extension;
  });

/** Replace every identity portion of free text (file names, log lines…) with dots. */
export const maskSensitiveText = (
  text: string | null | undefined,
  identities: Array<string | null | undefined> = []
): string => {
  const knownMasked = maskKnownIdentities(text ?? '', knownEmails(identities));
  return maskKnownIdentities(maskEmailText(knownMasked), identities);
};

/** Mask the identity portion of a credential file name, keeping prefix/hash/suffix. */
export const maskFileName = (
  fileName: string | null | undefined,
  identities: Array<string | null | undefined> = []
): string => {
  if (!fileName) return '';
  const extension = fileName.match(/\.json$/i)?.[0] ?? '';
  const stem = extension ? fileName.slice(0, -extension.length) : fileName;
  // Protect complete known emails (and their sanitized variants) first, preserving plan suffixes.
  // Partial usernames/domain labels are replaced only after unknown emails are fully masked.
  const masked = maskKnownIdentities(stem, knownEmails(identities));
  // Do not consume the provider/hash as part of an unknown email's local part. Unknown
  // prefixes are masked with the email so they cannot accidentally expose a username.
  const prefix =
    masked.match(
      /^(?:antigravity|claude|codex|gemini|qwen|iflow|kimi|copilot|github-copilot|openai|vertex)-(?:[a-f0-9]{6,}-)?/i
    )?.[0] ?? '';
  return (
    maskKnownIdentities(
      prefix + masked.slice(prefix.length).replace(EMAIL_PATTERN, PRIVACY_MASK),
      identities
    ) + extension
  );
};

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
