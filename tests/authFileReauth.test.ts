import { describe, expect, test } from 'bun:test';
import { formatModified, needsAuthFileReauth } from '../src/features/authFiles/constants';
import type { AuthFileItem } from '../src/types';

const authFile = (overrides: Partial<AuthFileItem> = {}): AuthFileItem => ({
  name: 'credential.json',
  type: 'claude',
  ...overrides,
});

describe('auth file sign-in recovery', () => {
  test.each([
    'refresh token expired; re-authenticate',
    'OAuth token has expired',
    'invalid_grant: token revoked',
    'Session expired, please sign in again',
  ])('treats "%s" as needing a new sign-in', (statusMessage) => {
    expect(needsAuthFileReauth(authFile({ status: 'error', statusMessage }))).toBe(true);
  });

  test.each(['rate limited', 'quota exhausted until 23:00', 'upstream 500', 'ok'])(
    'does not offer sign-in for "%s"',
    (statusMessage) => {
      expect(needsAuthFileReauth(authFile({ status: 'error', statusMessage }))).toBe(false);
    }
  );

  test('never flags a deliberately disabled credential', () => {
    expect(
      needsAuthFileReauth(
        authFile({ disabled: true, status: 'disabled', statusMessage: 'token expired' })
      )
    ).toBe(false);
  });
});

describe('auth file modified date', () => {
  test('uses a locale-aware date with a spelled-out month', () => {
    const file = authFile({ modtime: Date.UTC(2026, 10, 6, 12, 0) / 1000 });
    expect(formatModified(file, 'en')).toMatch(/Nov/);
    expect(formatModified(file, 'en')).toMatch(/2026/);
    expect(formatModified(authFile(), 'en')).toBe('-');
  });
});
