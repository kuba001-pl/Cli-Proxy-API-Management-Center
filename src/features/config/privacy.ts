/**
 * Display-only privacy masking for configuration text, plugin metadata and
 * backend messages. Built on the shared helpers in `@/utils/privacy`; never
 * apply these to values that are stored, edited or sent back to the backend.
 */

import { PRIVACY_MASK, maskUrlUserinfoText, privacyText } from '@/utils/privacy';

/** YAML / JSON keys whose values are personal identifiers. */
const IDENTITY_KEYS = 'username|user|user-name|user_name|email|e-mail|account|login';

/** Block-style `key: value` (optionally a sequence item), value and trailing comment split. */
const BLOCK_IDENTITY_LINE = new RegExp(
  `^(\\s*(?:-\\s+)?["']?(?:${IDENTITY_KEYS})["']?\\s*:)(\\s*)(.*)$`,
  'i'
);

/**
 * Flow-style `{username: alice, …}` / `[{"email": "a@b.c"}]`: an identity key directly after
 * `{` or `,`, followed by a quoted or plain scalar that ends at `,`, `}`, `]` or a comment.
 */
const FLOW_IDENTITY_PATTERN = new RegExp(
  `([{,]\\s*["']?(?:${IDENTITY_KEYS})["']?\\s*:\\s*)("(?:[^"\\\\]|\\\\.)*"|'(?:[^']|'')*'|[^,{}\\[\\]\\s#][^,{}\\[\\]#]*?)(?=\\s*(?:[,}\\]]|#|$))`,
  'gi'
);

const BLOCK_SCALAR_HEADER = /^[|>][1-9+-]{0,2}\s*(?:#.*)?$/;

/** `scheme://user[:pass]@host` → `scheme://••••@host`; kept as an alias of the core helper. */
export const maskUrlUserinfo = maskUrlUserinfoText;

const indentOf = (line: string): number => line.match(/^\s*/)?.[0].length ?? 0;

/** Masks a single-line scalar value, keeping a trailing ` # comment`. */
const maskInlineValue = (value: string): string => {
  const quoted = value.match(/^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*')(.*)$/);
  if (quoted) return `${PRIVACY_MASK}${quoted[2]}`;
  const comment = value.match(/^(.*?)(\s+#.*)$/);
  return comment ? `${PRIVACY_MASK}${comment[2]}` : PRIVACY_MASK;
};

/** Masks the payload of a continuation line (block scalar body / plain multi-line scalar). */
const maskContinuationLine = (line: string): string => {
  if (!line.trim()) return line;
  const indent = line.match(/^\s*/)?.[0] ?? '';
  const item = line.slice(indent.length).match(/^(-\s+)/)?.[1] ?? '';
  return `${indent}${item}${PRIVACY_MASK}`;
};

/** A continuation line that starts a nested mapping, rather than continuing a scalar. */
const looksLikeMappingKey = (line: string): boolean =>
  /^\s*(?:-\s+)?["']?[^\s"':#][^:#]*["']?\s*:(?:\s|$)/.test(line);

/**
 * Masks identity-keyed values across the whole document. Works line by line but keeps
 * document context, so block scalars (`username: |`), plain multi-line scalars, sequences
 * under an identity key and flow mappings are all redacted. Never adds or removes lines.
 */
const maskIdentityKeys = (text: string): string => {
  const lines = text.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(BLOCK_IDENTITY_LINE);
    if (!match) {
      out.push(line.replace(FLOW_IDENTITY_PATTERN, (_m, prefix: string) => prefix + PRIVACY_MASK));
      i += 1;
      continue;
    }

    const [, prefix, spacing, rawValue] = match;
    const value = rawValue.trim();
    if (value.startsWith('{') || value.startsWith('[')) {
      // `user: {name: alice}` / `email: [a@b.c]`: the whole flow collection is the identity.
      out.push(`${prefix}${spacing}${maskInlineValue(value.replace(/\s+#.*$/, ''))}`);
      i += 1;
      continue;
    }

    const blockScalar = BLOCK_SCALAR_HEADER.test(value);
    if (value && !value.startsWith('#') && !blockScalar) {
      out.push(`${prefix}${spacing}${maskInlineValue(rawValue)}`);
      i += 1;
      continue;
    }

    // Header line keeps `|` / `>` / an empty value; the body follows on deeper-indented lines.
    out.push(line);
    i += 1;
    const keyIndent = indentOf(prefix.replace(/-\s+/, (dash) => ' '.repeat(dash.length)));
    while (i < lines.length) {
      const next = lines[i];
      if (next.trim() && indentOf(next) <= keyIndent) break;
      // A plain (non block-scalar) value may instead introduce a nested mapping: leave its
      // keys to the per-line rules so non-identity siblings stay readable.
      if (!blockScalar && next.trim() && looksLikeMappingKey(next)) break;
      out.push(maskContinuationLine(next));
      i += 1;
    }
  }
  return out.join('\n');
};

/** Free text (metadata, messages, URLs): emails, URL credentials and home-dir usernames. */
export const privacyDisplayText = (enabled: boolean, text: string | null | undefined): string => {
  const value = text ?? '';
  if (!enabled) return value;
  // The core helper masks emails, URL userinfo and OS home-dir usernames.
  return privacyText(true, value);
};

/**
 * YAML / config documents: additionally masks identity-keyed values such as `username:`.
 * Pass the complete document (not single lines) so multi-line scalars keep their context;
 * the result always has the same number of lines as the input.
 */
export const privacyConfigText = (enabled: boolean, text: string | null | undefined): string => {
  const value = text ?? '';
  if (!enabled) return value;
  return privacyText(true, maskIdentityKeys(value));
};

/** Line array of {@link privacyConfigText}; index `n - 1` is line `n` of the input. */
export const privacyConfigLines = (enabled: boolean, text: string): string[] =>
  privacyConfigText(enabled, text).split('\n');

/**
 * Source-mode presentation. With privacy on, the page shows a separate read-only
 * preview of the masked text instead of the editor: the real document (and any
 * pending edits) is never replaced, so turning privacy off restores the original.
 */
export function resolveSourcePreview(
  value: string,
  privacyEnabled: boolean
): { masked: false } | { masked: true; previewText: string } {
  if (!privacyEnabled) return { masked: false };
  return { masked: true, previewText: privacyConfigText(true, value) };
}
