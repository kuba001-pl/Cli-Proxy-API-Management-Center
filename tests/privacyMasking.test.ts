import { afterEach, describe, expect, test } from 'bun:test';
import {
  PRIVACY_MASK,
  maskIdentity,
  maskFileName,
  maskSensitiveText,
  privacyIdentity,
  privacyFileName,
  privacyText,
} from '@/utils/privacy';
import { usePrivacyStore } from '@/stores/usePrivacyStore';

const originalPrivacy = usePrivacyStore.getState().enabled;
afterEach(() => usePrivacyStore.setState({ enabled: originalPrivacy }));

describe('privacy masking', () => {
  test('identities become a fixed run of dots without a domain or length hint', () => {
    expect(PRIVACY_MASK).toBe('•'.repeat(16));
    for (const identity of ['first.last@example.com', 'a@b.co', 'first_last', 'Account A']) {
      expect(maskIdentity(identity)).toBe(PRIVACY_MASK);
      expect(maskIdentity(identity)).not.toContain('@');
    }
    expect(maskIdentity(null)).toBe('');
    expect(maskIdentity(undefined)).toBe('');
    expect(maskIdentity('  ')).toBe('');
  });

  test('free text and tooltip content mask complete emails and known labels', () => {
    expect(maskSensitiveText('Account first.last@example.com failed')).toBe(
      `Account ${PRIVACY_MASK} failed`
    );
    expect(maskSensitiveText('Work account · FIRST.LAST@EXAMPLE.COM', ['Work account'])).toBe(
      `${PRIVACY_MASK} · ${PRIVACY_MASK}`
    );
  });

  test('known credential filenames preserve provider, hash, plan and extension', () => {
    expect(
      maskFileName('codex-abc12345-first.last@example.com-plus.json', ['first.last@example.com'])
    ).toBe(`codex-abc12345-${PRIVACY_MASK}-plus.json`);
    expect(maskFileName('antigravity-first_last_gmail_com.json', ['first.last@gmail.com'])).toBe(
      `antigravity-${PRIVACY_MASK}.json`
    );
    expect(
      maskFileName('claude-5aebc0bd-first-last-example-com.json', ['first.last@example.com'])
    ).toBe(`claude-5aebc0bd-${PRIVACY_MASK}.json`);
    expect(maskFileName('codex-FIRST.LAST@EXAMPLE.COM.JSON', ['first.last@example.com'])).toBe(
      `codex-${PRIVACY_MASK}.JSON`
    );
  });

  test('fallback email masking preserves a recognized provider/hash and JSON extension', () => {
    expect(maskFileName('codex-abc12345-first.last@example.com.json')).toBe(
      `codex-abc12345-${PRIVACY_MASK}.json`
    );
    expect(maskFileName('antigravity-first.last@gmail.com.json')).toBe(
      `antigravity-${PRIVACY_MASK}.json`
    );
    expect(maskFileName('first-last@example.com.json')).toBe(`${PRIVACY_MASK}.json`);
  });

  test('overlapping identities mask longest first and support short usernames', () => {
    expect(
      maskFileName('antigravity-first_last_gmail_com.json', ['first', 'first.last@gmail.com'])
    ).toBe(`antigravity-${PRIVACY_MASK}.json`);
    expect(maskSensitiveText('xy.json', ['xy'])).toBe(`${PRIVACY_MASK}.json`);
    expect(maskSensitiveText('a+b[1].json', ['a+b[1]'])).toBe(`${PRIVACY_MASK}.json`);
  });

  test('confirmation and log text retain credential filename structure', () => {
    expect(
      maskSensitiveText('Delete codex-abc12345-first.last@example.com-plus.json?', [
        'first.last@example.com',
      ])
    ).toBe(`Delete codex-abc12345-${PRIVACY_MASK}-plus.json?`);
    expect(maskSensitiveText('retry credential first.last@example.com.json')).toBe(
      `retry credential ${PRIVACY_MASK}.json`
    );
  });

  test('partial known usernames or domain labels cannot break the email mask', () => {
    for (const known of ['first', 'example', 'com', 'xy']) {
      expect(maskSensitiveText('first@example.com', [known])).toBe(PRIVACY_MASK);
      expect(maskFileName('codex-first@example.com.json', [known])).toBe(
        `codex-${PRIVACY_MASK}.json`
      );
    }
  });

  test('display wrappers preserve the original data when disabled', () => {
    const email = 'first.last@example.com';
    const name = `codex-${email}-plus.json`;
    expect(privacyIdentity(false, email)).toBe(email);
    expect(privacyFileName(false, name, [email])).toBe(name);
    expect(privacyText(false, email)).toBe(email);
    expect(privacyIdentity(true, email)).toBe(PRIVACY_MASK);
    expect(privacyFileName(true, name, [email])).toBe(`codex-${PRIVACY_MASK}-plus.json`);
    expect(privacyText(true, email)).toBe(PRIVACY_MASK);
    expect(privacyFileName(true, null)).toBe('');
  });

  test('the shared privacy store toggles and accepts an explicit state', () => {
    usePrivacyStore.getState().setEnabled(false);
    usePrivacyStore.getState().toggle();
    expect(usePrivacyStore.getState().enabled).toBe(true);
    usePrivacyStore.getState().toggle();
    expect(usePrivacyStore.getState().enabled).toBe(false);
    usePrivacyStore.getState().setEnabled(true);
    expect(usePrivacyStore.getState().enabled).toBe(true);
  });
});
