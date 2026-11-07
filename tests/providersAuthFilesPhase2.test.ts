import { describe, expect, test } from 'bun:test';
import i18n from '@/i18n';

const LOCALES = ['en', 'zh-CN', 'zh-TW', 'ru', 'vi', 'ko', 'tr'];

const read = (path: string) => Bun.file(path).text();

describe('auth-file mapping actions name their exact scope', () => {
  test('mapping removal never reads as deleting the provider', () => {
    const en = i18n.getFixedT('en');
    expect(en('oauth_excluded.delete')).toBe('Remove disabled models');
    expect(en('oauth_model_alias.delete')).toBe('Remove aliases');
    for (const lng of LOCALES) {
      const t = i18n.getFixedT(lng);
      expect(t('oauth_excluded.delete')).not.toBe(t('oauth_model_alias.delete'));
      expect(t('oauth_excluded.delete')).not.toContain('oauth_excluded.');
    }
  });

  test('confirmations name the provider and the affected count in every locale', () => {
    for (const lng of LOCALES) {
      const t = i18n.getFixedT(lng);
      for (const count of [1, 2, 5]) {
        for (const key of ['oauth_excluded.delete_confirm', 'oauth_model_alias.delete_confirm']) {
          const message = t(key, { provider: 'Claude', count });
          expect(message).toContain('Claude');
          expect(message).toContain(String(count));
          expect(message).not.toContain('oauth_');
        }
      }
    }
  });

  test('model and alias counts use plural forms', () => {
    const en = i18n.getFixedT('en');
    expect(en('oauth_excluded.model_count', { count: 1 })).toBe('1 model disabled');
    expect(en('oauth_excluded.model_count', { count: 3 })).toBe('3 models disabled');
    expect(en('oauth_model_alias.model_count', { count: 1 })).toBe('1 alias');
    expect(en('oauth_model_alias.model_count', { count: 2 })).toBe('2 aliases');
    const ru = i18n.getFixedT('ru');
    expect(ru('oauth_model_alias.model_count', { count: 2 })).toBe('2 псевдонима');
    expect(ru('oauth_model_alias.model_count', { count: 5 })).toBe('5 псевдонимов');
    for (const lng of LOCALES) {
      const t = i18n.getFixedT(lng);
      for (const count of [1, 2, 5]) {
        expect(t('oauth_excluded.model_count', { count })).toContain(String(count));
        expect(t('oauth_model_alias.model_count', { count })).toContain(String(count));
      }
    }
  });
});

describe('phase 2 provider / auth / OAuth copy exists in all seven locales', () => {
  const keys = [
    'auth_files.problem_label',
    'auth_files.reload_list',
    'providersPage.actions.addKey',
    'providersPage.actions.addProvider',
    'providersPage.table.noMatchesTitle',
    'providersPage.table.clearFilters',
    'providersPage.form.routingSection',
    'providersPage.form.optional',
    'providersPage.form.required',
    'providersPage.form.baseUrlDefaultHint',
    'auth_login.tile_action_sign_in',
    'auth_login.tile_action_import',
    'auth_login.tile_action_bind',
  ];
  const providerKeys = [
    'providersPage.table.emptyTitle',
    'providersPage.table.emptyTitleNamed',
    'providersPage.table.emptyDescription',
    'providersPage.form.createTitle',
    'providersPage.form.createTitleNamed',
    'providersPage.form.editTitle',
    'providersPage.form.editTitleNamed',
    'providersPage.form.detailTitle',
    'providersPage.form.detailTitleNamed',
  ];

  test('static keys resolve to real text', () => {
    for (const lng of LOCALES) {
      const bundle = i18n.getResourceBundle(lng, 'translation') as Record<string, unknown>;
      for (const key of [...keys, ...providerKeys]) {
        const value = key
          .split('.')
          .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], bundle);
        expect(typeof value === 'string' && value.length > 0).toBe(true);
      }
    }
  });

  test('sheet and empty-state titles carry the provider name, with no repeated verb eyebrow', () => {
    for (const lng of LOCALES) {
      const t = i18n.getFixedT(lng);
      for (const key of providerKeys) {
        expect(t(key, { provider: 'Gemini' })).toContain('Gemini');
      }
    }
    expect(i18n.getFixedT('en')('providersPage.form.createTitle', { provider: 'Gemini' })).toBe(
      'Add Gemini key'
    );
  });
});

describe('phase 2 layout contracts', () => {
  test('stacked provider rows fold Prefix/Models into the identity line and label the URL', async () => {
    const scss = await read('src/features/providers/components/ProviderResourceTable.module.scss');
    expect(scss).toContain('@container provider-table (max-width: 560px)');
    expect(scss).toMatch(/\.row > \.cellPrefix,\s*\.row > \.cellModels\s*\{\s*display: none;/);
    expect(scss).toContain('content: attr(data-label)');
    const tsx = await read('src/features/providers/components/ProviderResourceTable.tsx');
    expect(tsx).toContain("data-label={t('providersPage.table.baseUrl')}");
  });

  test('failure strip blocks are calmer: shorter than full height and lower chroma', async () => {
    for (const path of [
      'src/features/authFiles/components/AuthFileCard.module.scss',
      'src/features/providers/components/providerStatusBar.module.scss',
    ]) {
      const scss = await read(path);
      const failure = scss.match(/\.statusBlockFailure \{([^}]*)\}/)?.[1] ?? '';
      expect(failure).toContain('color-mix(in srgb, var(--strip-failure) 66%, var(--bg-surface))');
      expect(failure).toContain('clip-path: inset(20% 0 0 0 round 1px)');
    }
  });

  test('stacked auth rows keep identity wide and the switch beside health', async () => {
    const scss = await read('src/features/authFiles/components/AuthFileCard.module.scss');
    expect(scss).toMatch(/'lead more'\s*'health toggle'\s*'lowest lowest'/);
  });

  test('a problem credential is labelled in its collapsed row', async () => {
    const tsx = await read('src/features/authFiles/components/AuthFileCard.tsx');
    expect(tsx).toContain('isProblemAuthFile(file)');
    expect(tsx).toContain("'auth_files.problem_label'");
    expect(tsx).toContain("'auth_files.problem_label_sign_in'");
  });
});
