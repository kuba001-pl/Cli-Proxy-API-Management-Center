import { afterEach, describe, expect, test } from 'bun:test';
import {
  PRIVACY_MASK,
  credentialFileIdentity,
  findEmails,
  isEmail,
  splitCredentialFileName,
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

describe('privacy masking regressions', () => {
  test('Unicode and apostrophe local parts are masked as complete email tokens', () => {
    expect(maskSensitiveText('from josé@example.com today')).toBe(`from ${PRIVACY_MASK} today`);
    expect(maskSensitiveText("o'hara@example.com")).toBe(PRIVACY_MASK);
    expect(maskSensitiveText("'quoted@example.com'.")).toBe(`'${PRIVACY_MASK}'.`);
    expect(maskSensitiveText('用户@例子.公司')).toBe(PRIVACY_MASK);
    expect(isEmail('josé@example.com')).toBe(true);
    expect(findEmails('a@b and x@y.co, end.')).toEqual(['x@y.co']);
  });

  test('email scanning stays linear on huge adversarial inputs', () => {
    const inputs = [
      'a'.repeat(100_000),
      `${'a'.repeat(100_000)}@`,
      'a@'.repeat(50_000),
      `${'a.'.repeat(50_000)}@x`,
      `x@${'b.'.repeat(50_000)}`,
    ];
    const started = performance.now();
    for (const input of inputs) maskSensitiveText(input, ['alice']);
    expect(performance.now() - started).toBeLessThan(500);
  });

  test('known identities are replaced only at token boundaries', () => {
    expect(maskSensitiveText('username=a status=active', ['a'])).toBe('username=a status=active');
    expect(maskSensitiveText('user al logged in; also alice', ['al'])).toBe(
      `user ${PRIVACY_MASK} logged in; also alice`
    );
    expect(maskSensitiveText('first_last and first-last', ['first.last'])).toBe(
      `${PRIVACY_MASK} and ${PRIVACY_MASK}`
    );
    expect(maskSensitiveText('https://api.example.com', ['api'])).toBe(
      `https://${PRIVACY_MASK}.example.com`
    );
  });

  test('filename-only credentials keep provider, hash and plan segments', () => {
    expect(splitCredentialFileName('codex-dbffca66-alice-plus')).toEqual({
      prefix: 'codex-dbffca66-',
      identity: 'alice',
      suffix: '-plus',
    });
    expect(credentialFileIdentity('codex-dbffca66-alice-plus.json')).toBe('alice');
    expect(credentialFileIdentity('custom-personal-name.json')).toBe('custom-personal-name');
    expect(maskFileName('codex-dbffca66-alice-plus.json', ['codex-dbffca66-alice-plus'])).toBe(
      `codex-dbffca66-${PRIVACY_MASK}-plus.json`
    );
    expect(maskFileName('custom-personal-name.json', ['custom-personal-name'])).toBe(
      `${PRIVACY_MASK}.json`
    );
  });
});
