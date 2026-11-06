import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');
const LOCALES = ['en', 'zh-CN', 'zh-TW', 'ru', 'vi', 'ko', 'tr'];

describe('redesign R2 fixes', () => {
  test('confirmation titles exist in every locale and no longer rely on inline defaults', () => {
    const keys: Array<[string, string]> = [
      ['auth_files', 'delete_title'],
      ['auth_files', 'delete_all_title'],
      ['oauth_excluded', 'delete_title'],
      ['oauth_model_alias', 'delete_title'],
    ];
    for (const locale of LOCALES) {
      const messages = JSON.parse(read(`src/i18n/locales/${locale}.json`));
      for (const [section, key] of keys) {
        expect(typeof messages[section][key]).toBe('string');
        expect(messages[section][key].length).toBeGreaterThan(0);
      }
    }
    const hooks =
      read('src/features/authFiles/hooks/useAuthFilesData.ts') +
      read('src/features/authFiles/hooks/useAuthFilesOauth.tsx');
    expect(hooks).not.toMatch(/delete(_all)?_title', \{ defaultValue/);
  });

  test('Source editor region flexes into the remaining height instead of a viewport calc', () => {
    const css = read('src/features/config/components/SourcePanel.module.scss');
    expect(css).not.toMatch(/100d?vh/);
    expect(css).toMatch(/\.sourceRegion \{[^}]*flex: 1 1 0;/);
    expect(read('src/features/config/ConfigPage.module.scss')).toMatch(
      /\.pageSource \{[^}]*flex: 1 1 auto;/
    );
  });

  test('ProviderTabs keeps only the filled-tab recipe (no retired underline)', () => {
    const css = read('src/features/authFiles/components/ProviderTabs.module.scss');
    expect(css).not.toContain('::after');
    expect(css.match(/^\.tab \{/gm)?.length).toBe(1);
    expect(css.match(/^\.tabs \{/gm)?.length).toBe(1);
  });

  test('retired LiveWire / VaultPulse widgets are gone', () => {
    for (const path of [
      'src/features/dashboard/components/LiveWire.tsx',
      'src/features/dashboard/components/LiveWire.module.scss',
      'src/features/authFiles/components/VaultPulse.tsx',
      'src/features/authFiles/components/VaultPulse.module.scss',
    ]) {
      expect(existsSync(path)).toBe(false);
    }
  });

  test('dashboard traffic header uses the 4px rhythm and shows its scope in every theme', () => {
    const css = read('src/features/dashboard/dashboard.module.scss');
    expect(css).toMatch(/\.panelHead \{[^}]*gap: \$space-1;/);
    // The chart's unit and window are context, not decoration: never hidden per theme.
    expect(css).not.toMatch(/\[data-theme='dark'\][^{]*\.sectionDescription/);
    expect(css).not.toMatch(/\.sectionDescription \{[^}]*clip-path/);
  });
});
