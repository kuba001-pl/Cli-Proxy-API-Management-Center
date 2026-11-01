import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const LOCALES = ['en', 'zh-CN', 'zh-TW', 'ru', 'vi', 'ko', 'tr'];
const RESOURCE_KEYS = [
  'page_count',
  'load_failed',
  'unavailable',
  'not_found',
  'not_found_desc',
  'empty_src',
  'empty_src_desc',
];

describe('plugins: locales and theme tokens', () => {
  test('B05: every locale translates plugin_resource.* (no zh-CN fallback)', () => {
    const english = JSON.parse(read('src/i18n/locales/en.json')).plugin_resource;
    for (const locale of LOCALES) {
      const section = JSON.parse(read(`src/i18n/locales/${locale}.json`)).plugin_resource;
      for (const key of RESOURCE_KEYS) {
        expect(typeof section?.[key]).toBe('string');
        expect(section[key].trim()).not.toBe('');
        if (locale !== 'en' && key !== 'page_count') expect(section[key]).not.toBe(english[key]);
      }
    }
  });

  test('B01/B17: plugin styles use defined tokens, no translucent contour recipes', () => {
    for (const file of [
      'src/features/plugins/PluginsPage.module.scss',
      'src/features/plugins/PluginStorePage.module.scss',
      'src/features/plugins/components/PluginInstallGateModal.module.scss',
    ]) {
      const scss = read(file);
      expect(scss).not.toContain('--accent-color');
      expect(scss).not.toContain('--focus-ring-color');
      expect(scss).not.toMatch(/color-mix\(in srgb, var\(--border-color\) \d+%, transparent\)/);
      expect(scss).not.toMatch(/color-mix\(in srgb, var\(--bg-[a-z]+\) \d+%, transparent\)/);
    }
  });
});
