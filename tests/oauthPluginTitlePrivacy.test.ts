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

  test('plugin card titles are only read through the mask', () => {
    // Strip every masked read, then reject any remaining access to a card title in any
    // syntactic form (dot, optional chaining, bracket, or destructuring).
    const masked = [
      /pluginOAuthDisplayTitle\(privacyEnabled, card\.title\)/g,
      /pluginTitleOf\(card\.title\)/g,
    ];
    const unmasked = [
      /\bcard\??\.title\b/,
      /\bcard\??\.?\[\s*['"`]title['"`]\s*\]/,
      /\{[^}]*\btitle\b[^}]*\}\s*=\s*card\b/,
    ];
    for (const file of [
      'src/features/oauth/OAuthPage.tsx',
      'src/features/oauth/hooks/useOAuthFlows.ts',
    ]) {
      let source = readFileSync(file, 'utf8');
      expect(source).toContain('pluginOAuthDisplayTitle(privacyEnabled');
      for (const pattern of masked) source = source.replace(pattern, '');
      for (const pattern of unmasked)
        expect({ file, match: source.match(pattern)?.[0] }).toEqual({
          file,
          match: undefined,
        });
    }
  });
});
