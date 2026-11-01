import { describe, expect, test } from 'bun:test';
import {
  PRIVACY_MASK,
  findHomeDirUserRanges,
  findUrlUserinfoRanges,
  maskSensitiveText,
  privacyText,
} from '@/utils/privacy';

describe('privacy: URL userinfo and home-dir usernames', () => {
  test('C04: proxy URL credentials are masked, scheme and host kept', () => {
    expect(privacyText(true, 'socks5://alice:pw@127.0.0.1:1080')).toBe(
      `socks5://${PRIVACY_MASK}@127.0.0.1:1080`
    );
    expect(privacyText(true, 'http://alice@example.com/x')).toBe(
      `http://${PRIVACY_MASK}@example.com/x`
    );
    expect(privacyText(false, 'socks5://alice:pw@127.0.0.1:1080')).toBe(
      'socks5://alice:pw@127.0.0.1:1080'
    );
  });

  test('URLs without userinfo or with @ only in the path are untouched', () => {
    for (const value of ['https://example.com/a', 'https://h/a@b', 'ftp://host:21/x', 'a:/b@c']) {
      expect(maskSensitiveText(value)).toBe(value);
    }
    expect(maskSensitiveText('a://b://c@host')).toBe(`a://b://${PRIVACY_MASK}@host`);
  });

  test('C06: home-directory usernames are masked in Linux, macOS and Windows paths', () => {
    expect(privacyText(true, '/home/alice/plugins')).toBe(`/home/${PRIVACY_MASK}/plugins`);
    expect(maskSensitiveText('dir=/Users/bob')).toBe(`dir=/Users/${PRIVACY_MASK}`);
    expect(maskSensitiveText('C:\\Users\\carol\\plugins')).toBe(
      `C:\\Users\\${PRIVACY_MASK}\\plugins`
    );
    expect(maskSensitiveText('"C:\\\\Users\\\\carol\\\\x"')).toBe(
      `"C:\\\\Users\\\\${PRIVACY_MASK}\\\\x"`
    );
    expect(maskSensitiveText('d:/users/dave/')).toBe(`d:/users/${PRIVACY_MASK}/`);
    expect(maskSensitiveText('file:///home/eve/a')).toBe(`file:///home/${PRIVACY_MASK}/a`);
  });

  test('non-home paths and URL paths keep their segments', () => {
    for (const value of ['/srv/home/x/y', 'https://site.dev/home/feed', '/var/lib/users/x']) {
      expect(maskSensitiveText(value)).toBe(value);
    }
  });

  test('masking is idempotent and composes with email masking', () => {
    const once = maskSensitiveText('ssh://git:t@host /home/alice a@b.co');
    expect(once).toBe(`ssh://${PRIVACY_MASK}@host /home/${PRIVACY_MASK} ${PRIVACY_MASK}`);
    expect(maskSensitiveText(once)).toBe(once);
  });

  test('scanners stay linear on adversarial input', () => {
    const big = 'a://'.repeat(100_000) + '/home/'.repeat(100_000) + 'x'.repeat(100_000);
    const startedAt = performance.now();
    findUrlUserinfoRanges(big);
    findHomeDirUserRanges(big);
    expect(performance.now() - startedAt).toBeLessThan(1000);
  });
});
