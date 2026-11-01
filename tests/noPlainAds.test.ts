import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

// The fork intentionally drops upstream's pure-advertising UI (BestProxy proxy sponsor row and
// the expired Kimi top-up promo). Guard against them returning through an upstream sync.
const LOCALES_DIR = 'src/i18n/locales';

describe('plain ads removed', () => {
  test('proxy URL field renders no sponsor link', () => {
    const source = readFileSync('src/features/config/components/fields/sharedFields.tsx', 'utf8');
    expect(source).not.toContain('SPONSORS');
    expect(source).not.toContain('proxy_url_sponsor_hint');
    expect(existsSync('src/features/config/sponsors.ts')).toBe(false);
    expect(existsSync('src/assets/icons/bestproxy.png')).toBe(false);
  });

  test('Kimi provider panel renders no promo text', () => {
    const source = readFileSync(
      'src/features/providers/components/ProviderResourcePanel.tsx',
      'utf8'
    );
    expect(source).not.toContain('kimiPromo');
  });

  test('no locale carries the ad strings', () => {
    for (const file of readdirSync(LOCALES_DIR)) {
      const text = readFileSync(`${LOCALES_DIR}/${file}`, 'utf8');
      expect(text).not.toContain('"proxy_url_sponsor_hint"');
      expect(text).not.toContain('"kimiPromo"');
    }
  });
});
