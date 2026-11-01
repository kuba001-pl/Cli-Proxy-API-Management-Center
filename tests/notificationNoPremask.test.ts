import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Toasts and confirmations store the RAW message plus identity context; NotificationContainer
 * and ConfirmationModal mask at render time so on-screen text follows the privacy toggle.
 * Pre-masking at enqueue time freezes the privacy state and must not come back.
 */
const SRC = join(import.meta.dir, '..', 'src');
const CALL = /\b(showNotification|showConfirmation|notify|confirm)\s*\(/g;
const PREMASK =
  /\b(privacyText|privacyIdentity|privacyFileName|privacyLogText|privacyLogFileName|privacyConfigText|privacyDisplayText|maskSensitiveText|maskIdentity|maskFileName|authFilesDisplayText|routingMemberDisplay)\s*\(|usePrivacyStore\.getState\(\)|privacyEnabled|getProviderDisplayName\([^)]*,\s*(?!false\b)/;

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });

/**
 * Argument text of a call starting at the opening paren (balanced; ignores quoted strings).
 * Template literals are scanned as code so `${privacyText(...)}` interpolations are caught.
 */
const callArguments = (source: string, open: number): string => {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') quote = ch;
    else if (ch === '(') depth += 1;
    else if (ch === ')' && --depth === 0) return source.slice(open + 1, i);
  }
  return source.slice(open + 1);
};

const findPremaskedCalls = (source: string): string[] => {
  const hits: string[] = [];
  for (const match of source.matchAll(CALL)) {
    const args = callArguments(source, match.index + match[0].length - 1);
    if (PREMASK.test(args)) hits.push(`${match[1]}(${args.slice(0, 80).replace(/\s+/g, ' ')}`);
  }
  return hits;
};

describe('notification/confirmation privacy: no enqueue-time masking', () => {
  test('scanner flags pre-masked calls and accepts raw + identities', () => {
    expect(
      findPremaskedCalls(
        `showNotification(privacyText(usePrivacyStore.getState().enabled, msg), 'error');`
      )
    ).toHaveLength(1);
    expect(
      findPremaskedCalls(`showConfirmation({ message: t('x', { name: privacyText(on, n) }) });`)
    ).toHaveLength(1);
    expect(
      findPremaskedCalls('showNotification(`${t("a")}: ${privacyText(on, m)}`, "error");')
    ).toHaveLength(1);
    expect(
      findPremaskedCalls(`showNotification(msg, 'error', undefined, { identities: ids });`)
    ).toEqual([]);
  });

  test('no call site in src masks text before enqueueing it', () => {
    const offenders = sourceFiles(SRC).flatMap((path) =>
      findPremaskedCalls(readFileSync(path, 'utf8')).map((hit) => `${relative(SRC, path)}: ${hit}`)
    );
    expect(offenders).toEqual([]);
  });

  test('privacy state is never read imperatively to pre-mask text outside the stores', () => {
    // Hoisted `const msg = privacyText(usePrivacyStore.getState().enabled, …)` escapes the
    // call scanner above; render-time masking subscribes via the hook instead.
    const offenders = sourceFiles(SRC)
      .filter((path) => !relative(SRC, path).startsWith('stores'))
      .filter((path) => readFileSync(path, 'utf8').includes('usePrivacyStore.getState()'))
      .map((path) => relative(SRC, path));
    expect(offenders).toEqual([]);
  });
});
