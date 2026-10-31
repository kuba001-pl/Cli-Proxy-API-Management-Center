import { describe, expect, test } from 'bun:test';
import {
  authFileDisplayIdentity,
  authFileJsonIdentities,
  authFilePrivacyIdentities,
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
    expect(display.primary).toBe(`provider-${PRIVACY_MASK}`);
    expect(display.fullName).toBe(`provider-${PRIVACY_MASK}.json`);
    expect(authFilePrivacyIdentities(apiFile)).toContain('private-api-key');
    expect(authFileDisplayIdentity(apiFile, false).primary).toBe('provider-private-api-key');
  });

  test('conceals filename-only identities without guessing where a username starts', () => {
    const unknown: AuthFileItem = { name: 'custom-personal-name.json' };
    const display = authFileDisplayIdentity(unknown, true);
    expect(display.primary).toBe(PRIVACY_MASK);
    expect(display.fullName).toBe(`${PRIVACY_MASK}.json`);
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
