import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { pluginOAuthDisplayTitle } from '@/features/oauth/privacy';
import { PRIVACY_MASK } from '@/utils/privacy';

describe('plugin OAuth entry title privacy', () => {
  test('masks an identity embedded in a plugin-declared entry name', () => {
    const masked = pluginOAuthDisplayTitle(true, 'Alice <alice@example.test>');
    expect(masked).not.toContain('alice@example.test');
    expect(masked).toContain(PRIVACY_MASK);
  });

  test('keeps plain titles and returns the raw title when privacy is off', () => {
    expect(pluginOAuthDisplayTitle(true, 'Acme Portal')).toBe('Acme Portal');
    expect(pluginOAuthDisplayTitle(false, 'Alice <alice@example.test>')).toBe(
      'Alice <alice@example.test>'
    );
  });

  test('every render site of a plugin card title goes through the mask', () => {
    for (const file of [
      'src/features/oauth/OAuthPage.tsx',
      'src/features/oauth/hooks/useOAuthFlows.ts',
    ]) {
      const source = readFileSync(file, 'utf8');
      expect(source).toContain('pluginOAuthDisplayTitle(privacyEnabled');
      expect(source).not.toMatch(/name: card\.title\b/);
      expect(source).not.toMatch(/\?\s*card\.title\b/);
    }
  });
});
