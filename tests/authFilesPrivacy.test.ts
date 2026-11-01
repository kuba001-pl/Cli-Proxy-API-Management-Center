import { describe, expect, test } from 'bun:test';
import {
  authFileDisplayIdentity,
  authFileJsonIdentities,
  authFileJsonPreview,
  authFilePrivacyIdentities,
  redactAuthFileJson,
  authFilesDisplayText,
} from '@/features/authFiles/privacy';
import { buildWildcardSearch, matchesAuthFileSearch } from '@/features/authFiles/logic';
import { PRIVACY_MASK, privacyText } from '@/utils/privacy';
import type { AuthFileItem } from '@/types';

const file: AuthFileItem = {
  name: 'codex-abc12345-person@example.com-plus.json',
  email: 'person@example.com',
  account: 'private-api-key',
  type: 'codex',
};

describe('auth file privacy display', () => {
  test('masks the whole email and identity portion of the complete filename', () => {
    const display = authFileDisplayIdentity(file, true);
    expect(display.primary).toBe(PRIVACY_MASK);
    expect(display.fullName).toBe(`codex-abc12345-${PRIVACY_MASK}-plus.json`);
    expect(display.secondary).toBe(display.fullName);
    expect(JSON.stringify(display)).not.toContain('person@example.com');
    expect(file.email).toBe('person@example.com');
    expect(file.name).toBe('codex-abc12345-person@example.com-plus.json');
  });

  test('uses account only to redact filenames, never as primary display identity', () => {
    const apiFile: AuthFileItem = {
      name: 'provider-private-api-key.json',
      account: 'private-api-key',
    };
    const display = authFileDisplayIdentity(apiFile, true);
    // `provider-` is not a recognized structural prefix, so the whole stem is concealed.
    expect(display.primary).toBe(PRIVACY_MASK);
    expect(display.fullName).toBe(`${PRIVACY_MASK}.json`);
    expect(authFilePrivacyIdentities(apiFile)).toContain('private-api-key');
    expect(authFileDisplayIdentity(apiFile, false).primary).toBe('provider-private-api-key');
  });

  test('conceals filename-only identities without guessing where a username starts', () => {
    const unknown: AuthFileItem = { name: 'custom-personal-name.json' };
    const display = authFileDisplayIdentity(unknown, true);
    expect(display.primary).toBe(PRIVACY_MASK);
    expect(display.fullName).toBe(`${PRIVACY_MASK}.json`);
  });

  test('masks the filename identity even when metadata does not match the filename', () => {
    const mismatchedEmail: AuthFileItem = { name: 'alice.json', email: 'alice@example.com' };
    const emailDisplay = authFileDisplayIdentity(mismatchedEmail, true);
    expect(emailDisplay.primary).toBe(PRIVACY_MASK);
    expect(emailDisplay.fullName).toBe(`${PRIVACY_MASK}.json`);
    expect(emailDisplay.secondary).toBe(`${PRIVACY_MASK}.json`);
    expect(JSON.stringify(emailDisplay)).not.toContain('alice');

    const mismatchedAccount: AuthFileItem = {
      name: 'codex-alice.json',
      account: 'sk-example-fixture',
    };
    const accountDisplay = authFileDisplayIdentity(mismatchedAccount, true);
    expect(accountDisplay.primary).toBe(`codex-${PRIVACY_MASK}`);
    expect(accountDisplay.fullName).toBe(`codex-${PRIVACY_MASK}.json`);
    expect(authFilesDisplayText('Deleted codex-alice.json', [mismatchedAccount], true)).toBe(
      `Deleted codex-${PRIVACY_MASK}.json`
    );

    const hashed: AuthFileItem = {
      name: 'claude-5aebc0bd-bob-max.json',
      email: 'someone@example.com',
    };
    expect(authFileDisplayIdentity(hashed, true).fullName).toBe(
      `claude-5aebc0bd-${PRIVACY_MASK}-max.json`
    );
    expect(authFileDisplayIdentity(hashed, false).fullName).toBe(hashed.name);
  });

  test('search continues to match real identities while their display is masked', () => {
    expect(authFileDisplayIdentity(file, true).primary).toBe(PRIVACY_MASK);
    expect(matchesAuthFileSearch(file, file.email!, null)).toBe(true);
    expect(matchesAuthFileSearch(file, '*example.com', buildWildcardSearch('*example.com'))).toBe(
      true
    );
    expect(matchesAuthFileSearch(file, 'private-api-key', null)).toBe(false);
  });

  test('retains real email display when privacy is off', () => {
    expect(authFileDisplayIdentity(file, false).primary).toBe(file.email!);
    expect(authFileDisplayIdentity(file, false).fullName).toBe(file.name);
  });

  test('redacts nested JSON email/account values and freeform confirmation text', () => {
    const value = {
      email: file.email,
      credentials: [{ account: 'private-api-key' }],
      location: 'us-central1',
    };
    const identities = authFileJsonIdentities(value);
    const display = privacyText(true, JSON.stringify(value), identities);
    expect(display).not.toContain(file.email!);
    expect(display).not.toContain('private-api-key');
    expect(display).toContain('us-central1');
    expect(authFilesDisplayText(`Delete ${file.name}?`, [file], true)).toBe(
      `Delete codex-abc12345-${PRIVACY_MASK}-plus.json?`
    );
    expect(authFileJsonIdentities(null)).toEqual([]);
  });
});

describe('auth file privacy regressions', () => {
  test('filename-only credentials mask only the identity middle', () => {
    const codex: AuthFileItem = { name: 'codex-dbffca66-alice-plus.json', type: 'codex' };
    const display = authFileDisplayIdentity(codex, true);
    expect(display.fullName).toBe(`codex-dbffca66-${PRIVACY_MASK}-plus.json`);
    expect(display.primary).toBe(`codex-dbffca66-${PRIVACY_MASK}-plus`);
    expect(JSON.stringify(display)).not.toContain('alice');
    expect(authFilesDisplayText('Delete codex-dbffca66-alice-plus.json?', [codex], true)).toBe(
      `Delete codex-dbffca66-${PRIVACY_MASK}-plus.json?`
    );
    const antigravity: AuthFileItem = { name: 'antigravity-alice.json' };
    expect(authFileDisplayIdentity(antigravity, true).fullName).toBe(
      `antigravity-${PRIVACY_MASK}.json`
    );
  });

  test('JSON preview redacts parsed values so escaping cannot hide identities', () => {
    const json = {
      account: 'DOMAIN\\alice',
      display_name: 'Alice "Example"',
      nested: [{ note: 'contact josé@example.com', login: 'via DOMAIN\\alice' }],
      token_type: 'Bearer',
    };
    const identities = authFileJsonIdentities(json);
    const preview = authFileJsonPreview(JSON.stringify(json), identities, true);
    expect(preview).not.toContain('alice');
    expect(preview).not.toContain('Alice');
    expect(preview).not.toContain('josé');
    expect(preview).toContain('"token_type": "Bearer"');
    expect(JSON.parse(preview).account).toBe(PRIVACY_MASK);
    expect(redactAuthFileJson(json, identities)).not.toBe(json);
    expect(json.account).toBe('DOMAIN\\alice');
    expect(authFileJsonPreview(JSON.stringify(json), identities, false)).toBe(
      JSON.stringify(json, null, 2)
    );
    expect(authFileJsonPreview('{bad alice@example.com', [], true)).toBe(`{bad ${PRIVACY_MASK}`);
  });
});
