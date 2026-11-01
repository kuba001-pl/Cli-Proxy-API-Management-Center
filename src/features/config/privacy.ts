/**
 * Display-only privacy masking for configuration text, plugin metadata and
 * backend messages. Built on the shared helpers in `@/utils/privacy`; never
 * apply these to values that are stored, edited or sent back to the backend.
 */

import { isCollection, isPair, isScalar, isSeq, parseAllDocuments, visit } from 'yaml';
import type { Node as YamlNode } from 'yaml';
import { PRIVACY_MASK, maskUrlUserinfoText, privacyText } from '@/utils/privacy';
import type { TextRange } from '@/utils/privacy';

/** YAML / JSON keys whose values are personal identifiers. */
const IDENTITY_KEYS = 'username|user|user-name|user_name|email|e-mail|account|login';
const IDENTITY_KEY_SET = new Set(IDENTITY_KEYS.split('|'));

type IdentitySink = (value: string) => void;

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
const maskInlineValue = (value: string, sink?: IdentitySink): string => {
  const quoted = value.match(/^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*')(.*)$/);
  if (quoted) {
    sink?.(quoted[1].slice(1, -1));
    return `${PRIVACY_MASK}${quoted[2]}`;
  }
  const comment = value.match(/^(.*?)(\s+#.*)$/);
  sink?.(comment ? comment[1] : value);
  return comment ? `${PRIVACY_MASK}${comment[2]}` : PRIVACY_MASK;
};

/** Masks the payload of a continuation line (block scalar body / plain multi-line scalar). */
const maskContinuationLine = (line: string, sink?: IdentitySink): string => {
  if (!line.trim()) return line;
  const indent = line.match(/^\s*/)?.[0] ?? '';
  const item = line.slice(indent.length).match(/^(-\s+)/)?.[1] ?? '';
  sink?.(line.slice(indent.length + item.length));
  return `${indent}${item}${PRIVACY_MASK}`;
};

/** A continuation line that starts a nested mapping, rather than continuing a scalar. */
const looksLikeMappingKey = (line: string): boolean =>
  /^\s*(?:-\s+)?["']?[^\s"':#][^:#]*["']?\s*:(?:\s|$)/.test(line);

/**
 * Line-rule fallback for identity-keyed values (also covers invalid YAML). Keeps document
 * context, so block scalars (`username: |`), indented plain continuations, sequences under
 * an identity key and flow mappings are redacted. Never adds or removes lines.
 */
const maskIdentityLines = (text: string, sink?: IdentitySink): string => {
  const lines = text.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(BLOCK_IDENTITY_LINE);
    if (!match) {
      out.push(
        line.replace(FLOW_IDENTITY_PATTERN, (_m, prefix: string, value: string) => {
          sink?.(/^["']/.test(value) ? value.slice(1, -1) : value);
          return prefix + PRIVACY_MASK;
        })
      );
      i += 1;
      continue;
    }

    const [, prefix, spacing, rawValue] = match;
    const value = rawValue.trim();
    if (value.startsWith('{') || value.startsWith('[')) {
      // `user: {name: alice}` / `email: [a@b.c]`: the whole flow collection is the identity.
      out.push(`${prefix}${spacing}${maskInlineValue(value.replace(/\s+#.*$/, ''), sink)}`);
      i += 1;
      continue;
    }

    const blockScalar = BLOCK_SCALAR_HEADER.test(value);
    if (value && !value.startsWith('#') && !blockScalar) {
      out.push(`${prefix}${spacing}${maskInlineValue(rawValue, sink)}`);
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
      out.push(maskContinuationLine(next, sink));
      i += 1;
    }
  }
  return out.join('\n');
};

const isIdentityKey = (key: unknown): boolean =>
  isScalar(key) && IDENTITY_KEY_SET.has(String(key.value).trim().toLowerCase());

/** Source span of a scalar's content; block scalars keep their `|` / `>` header line. */
const scalarRange = (text: string, node: YamlNode): TextRange | null => {
  if (!isScalar(node) || !node.range) return null;
  let [start] = node.range;
  const end = node.range[1];
  if (node.type === 'BLOCK_LITERAL' || node.type === 'BLOCK_FOLDED') {
    const newline = text.indexOf('\n', start);
    if (newline === -1 || newline >= end) return null;
    start = newline + 1;
  }
  return end > start ? { start, end } : null;
};

/**
 * Complete source spans of identity-keyed values, from the YAML parser's node ranges, so
 * multi-line plain, quoted, folded and flow scalars are covered in full. Documents with
 * errors still yield the nodes the parser recovered; the line rules cover the rest.
 */
const identityValueRanges = (text: string, sink?: IdentitySink): TextRange[] => {
  const ranges: TextRange[] = [];
  const add = (node: YamlNode) => {
    const range = scalarRange(text, node);
    if (!range) return;
    ranges.push(range);
    if (isScalar(node) && node.value !== null && node.value !== undefined) {
      sink?.(String(node.value));
    }
  };
  const addAll = (collection: YamlNode) =>
    visit(collection, {
      Scalar(key, node) {
        if (key !== 'key') add(node);
      },
    });
  const addIdentityValue = (value: YamlNode) => {
    if (isScalar(value)) add(value);
    // `user: {name: alice}` / `email: [a@b.c]`: every value in a flow collection is the identity.
    else if (isCollection(value) && value.flow) addAll(value);
    // `user:\n  - alice`: sequence items are identities. Nested block mappings keep their own
    // keys (`account:\n  id: 7`); identity keys inside them are visited on their own.
    else if (isSeq(value)) {
      for (const item of value.items) {
        if (isScalar(item)) add(item);
        else if (isCollection(item) && item.flow) addAll(item);
      }
    }
  };
  let documents: ReturnType<typeof parseAllDocuments>;
  try {
    documents = parseAllDocuments(text);
  } catch {
    return ranges;
  }
  if (!Array.isArray(documents)) return ranges;
  for (const document of documents) {
    visit(document, {
      Pair(_key, pair) {
        if (!isPair(pair) || !isIdentityKey(pair.key) || !pair.value) return;
        const value = pair.value as YamlNode;
        addIdentityValue(value);
      },
    });
  }
  return ranges.sort((a, b) => a.start - b.start);
};

/** Dots out each line of every range, keeping indentation and line breaks. */
const maskRanges = (text: string, ranges: TextRange[]): string => {
  let result = '';
  let cursor = 0;
  for (const { start, end } of ranges) {
    if (start < cursor) continue;
    const masked = text
      .slice(start, end)
      .split('\n')
      .map((segment) => {
        const [, lead, body, trail] = segment.match(/^(\s*)([\s\S]*?)(\s*)$/) ?? [];
        return body ? `${lead}${PRIVACY_MASK}${trail}` : segment;
      })
      .join('\n');
    result += text.slice(cursor, start) + masked;
    cursor = end;
  }
  return result + text.slice(cursor);
};

/**
 * Masks identity-keyed values across the whole document: parser ranges first (complete
 * multi-line scalars), then line rules as a fallback for text the parser could not recover.
 * Never adds or removes lines.
 */
const maskIdentityKeys = (text: string, sink?: IdentitySink): string =>
  maskIdentityLines(maskRanges(text, identityValueRanges(text, sink)), sink);

/**
 * Identity values (and their individual lines/words) named by identity keys in a config
 * document. Used to redact text derived from the document without its context, such as a
 * YAML parser excerpt that shows a block-scalar body but not its `username: |` header.
 */
export const configDocumentIdentities = (text: string | null | undefined): string[] => {
  const identities = new Set<string>();
  const sink: IdentitySink = (value) => {
    for (const part of [value, ...value.split(/\s+/)]) {
      const trimmed = part.trim();
      if (trimmed && !trimmed.includes(PRIVACY_MASK)) identities.add(trimmed);
    }
  };
  if (text) maskIdentityKeys(text, sink);
  return [...identities];
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
export const privacyConfigText = (
  enabled: boolean,
  text: string | null | undefined,
  identities: string[] = []
): string => {
  const value = text ?? '';
  if (!enabled) return value;
  return privacyText(true, maskIdentityKeys(value), identities);
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
