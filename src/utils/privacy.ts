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

/** Characters that end a URL userinfo segment (`scheme://<userinfo>@host`). */
const USERINFO_STOP = /[\s/?#@'"`<>\\]/u;
const SCHEME_CHAR = /[A-Za-z0-9+.-]/;

/**
 * Locate the `user[:pass]` part of every `scheme://user[:pass]@host` in linear time:
 * each `://` scans forward once to the first stop character, and the next search
 * resumes from there, so no character is visited more than a constant number of times.
 */
export const findUrlUserinfoRanges = (text: string): TextRange[] => {
  const ranges: TextRange[] = [];
  let sep = text.indexOf('://');
  while (sep !== -1) {
    // A scheme is at least one character, starting with a letter: `socks5`, `https`.
    let schemeStart = sep;
    while (schemeStart > 0 && SCHEME_CHAR.test(text[schemeStart - 1])) schemeStart -= 1;
    while (schemeStart < sep && !/[A-Za-z]/.test(text[schemeStart])) schemeStart += 1;
    const start = sep + 3;
    let end = start;
    while (end < text.length && !USERINFO_STOP.test(text[end])) end += 1;
    if (schemeStart < sep && end > start && text[end] === '@') {
      ranges.push({ start, end });
    }
    // A stop at `/` may be the start of the next `://` (`a://b://c`), so resume just before it.
    sep = text.indexOf('://', Math.max(sep + 3, end - 1));
  }
  return ranges;
};

/**
 * OS home-directory prefixes whose next segment is the local username: `/home/<u>`,
 * `/Users/<u>`, `C:\Users\<u>` (also `C:/Users/<u>` and JSON-escaped `C:\\Users\\<u>`).
 * The lookbehind keeps `/srv/home/x` and `https://site/home/feed` untouched. The
 * pattern is a fixed alternation (no nested quantifiers), so matching stays linear.
 */
const HOME_DIR_PREFIX =
  /(?<![\p{L}\p{N}_.~-])(?:\/home\/|\/Users\/|[A-Za-z]:(?:\\{1,2}|\/)[Uu][Ss][Ee][Rr][Ss](?:\\{1,2}|\/))/gu;
const HOME_USER_STOP = /[\s/\\'"`<>()[\]{},;|:]/u;

/** Locate the username segment of every OS home-directory path in `text`. */
export const findHomeDirUserRanges = (text: string): TextRange[] => {
  const ranges: TextRange[] = [];
  HOME_DIR_PREFIX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HOME_DIR_PREFIX.exec(text)) !== null) {
    const start = match.index + match[0].length;
    let end = start;
    while (end < text.length && !HOME_USER_STOP.test(text[end])) end += 1;
    if (end > start) ranges.push({ start, end });
    HOME_DIR_PREFIX.lastIndex = Math.max(end, start);
  }
  HOME_DIR_PREFIX.lastIndex = 0;
  return ranges;
};

/** Mask the `user[:pass]` part of URL credentials, keeping scheme and host. */
export const maskUrlUserinfoText = (text: string): string =>
  replaceRanges(text, findUrlUserinfoRanges(text), () => PRIVACY_MASK);

/** Mask the username segment of OS home-directory paths, keeping the rest of the path. */
export const maskHomeDirText = (text: string): string =>
  replaceRanges(text, findHomeDirUserRanges(text), () => PRIVACY_MASK);

/**
 * Replace every identity portion of free text (file names, log lines…) with dots:
 * known identities, emails, URL userinfo (`scheme://user:pass@host`) and OS
 * home-directory usernames (`/home/<u>/`, `/Users/<u>/`, `C:\Users\<u>\`).
 */
export const maskSensitiveText = (
  text: string | null | undefined,
  identities: Array<string | null | undefined> = []
): string => {
  const structural = maskHomeDirText(maskUrlUserinfoText(text ?? ''));
  const knownMasked = maskKnownIdentities(structural, knownEmails(identities));
  return maskKnownIdentities(maskEmailText(knownMasked), identities);
};

const PROVIDER_PREFIX =
  /^(?:antigravity|claude|codex|devin|gemini|qwen|iflow|kimi|copilot|github-copilot|openai|vertex)-/i;
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

const FILE_NAME_STOP = /[\s'"`<>()[\]{},;:|/\\]/u;

/**
 * Every `*.json` file name in free text (e.g. a toast naming a just-uploaded credential),
 * found in linear time: each `.json` scans back only to the previous match or stop char.
 */
export const findJsonFileNames = (text: string): string[] => {
  const names: string[] = [];
  const lower = text.toLowerCase();
  let floor = 0;
  let dot = lower.indexOf('.json');
  while (dot !== -1) {
    const end = dot + 5;
    const boundary = end >= text.length || !/[\p{L}\p{N}_-]/u.test(text[end]);
    let start = dot;
    while (start > floor && !FILE_NAME_STOP.test(text[start - 1])) start -= 1;
    if (boundary && start < dot) {
      names.push(text.slice(start, end));
      floor = end;
    }
    dot = lower.indexOf('.json', end);
  }
  return names;
};

/** Identity portions of the credential file names mentioned in `text`. */
export const credentialFileIdentitiesInText = (text: string | null | undefined): string[] =>
  findJsonFileNames(text ?? '').map(credentialFileIdentity);

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
