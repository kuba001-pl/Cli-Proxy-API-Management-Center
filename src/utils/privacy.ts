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

/** Identities shorter than this are not used as free-text targets (too many false positives). */
const MIN_IDENTITY_LENGTH = 2;

const LOCAL_CHAR = /[\p{L}\p{N}\p{M}._%+'’-]/u;
const DOMAIN_CHAR = /[\p{L}\p{N}\p{M}.-]/u;
const TLD = /^\p{L}{2,}$/u;

export type TextRange = { start: number; end: number };

/**
 * Locate complete email tokens (Unicode-aware) in linear time: every `@` expands to the
 * surrounding local/domain characters, and no character is scanned more than a constant
 * number of times, so huge log lines cannot trigger regex backtracking.
 */
export const findEmailRanges = (text: string): TextRange[] => {
  const ranges: TextRange[] = [];
  let floor = 0;
  let at = text.indexOf('@');
  while (at !== -1) {
    let start = at;
    while (start > floor && LOCAL_CHAR.test(text[start - 1])) start -= 1;
    let end = at + 1;
    while (end < text.length && DOMAIN_CHAR.test(text[end])) end += 1;

    // Quotes/dots wrap emails in prose (`'a@b.co'`, `see a@b.co.`); they are not part of them.
    while (start < at && /['’.]/u.test(text[start])) start += 1;
    while (end > at + 1 && /[.-]/.test(text[end - 1])) end -= 1;

    const domain = text.slice(at + 1, end);
    const labels = domain.split('.');
    const valid =
      start < at &&
      labels.length >= 2 &&
      labels.every((label) => label.length > 0) &&
      TLD.test(labels[labels.length - 1]);
    if (valid) {
      ranges.push({ start, end });
      floor = end;
    } else {
      floor = Math.max(floor, at + 1);
    }
    at = text.indexOf('@', Math.max(at + 1, floor));
  }
  return ranges;
};

const replaceRanges = (
  text: string,
  ranges: TextRange[],
  replace: (match: string) => string
): string => {
  if (ranges.length === 0) return text;
  let result = '';
  let cursor = 0;
  for (const { start, end } of ranges) {
    result += text.slice(cursor, start) + replace(text.slice(start, end));
    cursor = end;
  }
  return result + text.slice(cursor);
};

/** Replace every email token in `text`. */
export const replaceEmails = (text: string, replace: (email: string) => string): string =>
  replaceRanges(text, findEmailRanges(text), replace);

/** All complete email tokens contained in `text`. */
export const findEmails = (text: string): string[] =>
  findEmailRanges(text).map(({ start, end }) => text.slice(start, end));

/** Whether the whole (trimmed) value is a single email address. */
export const isEmail = (value: string | null | undefined): boolean => {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  const ranges = findEmailRanges(trimmed);
  return ranges.length === 1 && ranges[0].start === 0 && ranges[0].end === trimmed.length;
};

/** Whether `text` contains at least one email token. */
export const containsEmail = (text: string): boolean => findEmailRanges(text).length > 0;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

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
  if (trimmed.length < MIN_IDENTITY_LENGTH) return [];
  const variants = new Set<string>([trimmed]);
  for (const sep of ['_', '-']) {
    variants.add(trimmed.replace(/[@.]/g, sep));
    variants.add(trimmed.replace(/@/g, sep));
  }
  return [...variants];
};

const maskKnownIdentities = (
  text: string,
  identities: Array<string | null | undefined>
): string => {
  // Longest first: a username may also be the start of an email or sanitized filename.
  const variants = [
    ...new Set(identities.flatMap((identity) => (identity ? identityVariants(identity) : []))),
  ].sort((a, b) => b.length - a.length);
  if (variants.length === 0 || !text) return text;
  // Token-aware: `a` must not dot the letters of `status=active`, nor `api` those of `apiary`.
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${variants.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`,
    'giu'
  );
  return text.replace(pattern, () => PRIVACY_MASK);
};

const knownEmails = (identities: Array<string | null | undefined>) =>
  identities.filter((identity) => isEmail(identity));

const maskEmailText = (text: string): string =>
  replaceEmails(text, (email) => {
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

const PROVIDER_PREFIX =
  /^(?:antigravity|claude|codex|gemini|qwen|iflow|kimi|copilot|github-copilot|openai|vertex)-/i;
const HASH_SEGMENT = /^[a-f0-9]{6,16}-/i;
const PLAN_SUFFIX =
  /-(?:plus|pro|max|team|free|business|enterprise|edu|ultra|premium|standard|k12)$/i;

export type CredentialFileNameParts = {
  /** Provider + optional hash, including the trailing `-`, e.g. `codex-dbffca66-`. */
  prefix: string;
  /** The identity portion (may be empty when the name is nothing but structure). */
  identity: string;
  /** Plan suffix including its leading `-`, e.g. `-plus`. */
  suffix: string;
};

/** Split a credential stem (no `.json`) into structural prefix/suffix and identity middle. */
export const splitCredentialFileName = (stem: string): CredentialFileNameParts => {
  const provider = stem.match(PROVIDER_PREFIX)?.[0] ?? '';
  const hash = provider ? (stem.slice(provider.length).match(HASH_SEGMENT)?.[0] ?? '') : '';
  const prefix = provider + hash;
  const rest = stem.slice(prefix.length);
  const plan = prefix ? (rest.match(PLAN_SUFFIX)?.[0] ?? '') : '';
  const suffix = plan && rest.length > plan.length ? plan : '';
  return { prefix, identity: rest.slice(0, rest.length - suffix.length), suffix };
};

/**
 * Identity portion of a filename-only credential: the middle between recognized
 * provider/hash/plan segments, or the whole base name when nothing is recognizable.
 */
export const credentialFileIdentity = (fileName: string): string => {
  const stem = fileName.replace(/\.json$/i, '');
  const { identity } = splitCredentialFileName(stem);
  return identity || stem;
};

/** Mask the identity portion of a credential file name, keeping prefix/hash/suffix. */
export const maskFileName = (
  fileName: string | null | undefined,
  identities: Array<string | null | undefined> = []
): string => {
  if (!fileName) return '';
  const extension = fileName.match(/\.json$/i)?.[0] ?? '';
  const stem = extension ? fileName.slice(0, -extension.length) : fileName;
  const lowerStem = stem.trim().toLowerCase();
  // A whole-stem identity (filename-only credential) masks only the identity middle.
  if (identities.some((identity) => identity?.trim().toLowerCase() === lowerStem)) {
    const { prefix, identity, suffix } = splitCredentialFileName(stem);
    return identity ? `${prefix}${PRIVACY_MASK}${suffix}${extension}` : stem + extension;
  }
  // Protect complete known emails (and their sanitized variants) first, preserving plan suffixes.
  // Partial usernames/domain labels are replaced only after unknown emails are fully masked.
  const masked = maskKnownIdentities(stem, knownEmails(identities));
  // Do not consume the provider/hash as part of an unknown email's local part. Unknown
  // prefixes are masked with the email so they cannot accidentally expose a username.
  const { prefix } = splitCredentialFileName(masked);
  return (
    maskKnownIdentities(
      prefix + replaceEmails(masked.slice(prefix.length), () => PRIVACY_MASK),
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
