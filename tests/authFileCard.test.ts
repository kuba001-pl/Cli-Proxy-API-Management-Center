import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// The quota host binds CSS-module classes at import time, which Bun cannot render.
// Keep these source contracts small; browser checks cover the actual card interactions.
const source = readFileSync(
  new URL('../src/features/authFiles/components/AuthFileCard.tsx', import.meta.url),
  'utf8'
);
const styles = readFileSync(
  new URL('../src/features/authFiles/components/AuthFileCard.module.scss', import.meta.url),
  'utf8'
);

describe('auth file card presentation contract', () => {
  test('shows provider icons and privacy-safe identity in an expandable row', () => {
    expect(source).toContain('getAuthFileIcon');
    expect(source).toContain('authFileDisplayIdentity(file, privacy)');
    expect(source).toContain('aria-expanded={expanded}');
    expect(source).toContain('aria-controls={detailsId}');
    expect(source).toContain('hidden={!expanded}');
    expect(source).toContain('{identity.primary}');
    expect(source).toContain('{identity.secondary}');
  });

  test('keeps a single row toggle with privacy-safe accessible names', () => {
    const header = source.split('<header')[1].split('</header>')[0];
    expect(source.match(/<ToggleSwitch/g)).toHaveLength(1);
    expect(header).toContain("t('auth_files.card_select', { name: identity.fullName })");
    expect(header).toContain("t('auth_files.card_toggle', { name: identity.fullName })");
    expect(header).toContain('checked={!file.disabled}');
    expect(header).toContain('statusUpdating[getAuthFileRefreshKey(file)] === true ||');
    expect(header).toContain('isManualRefreshing');
    expect(header).toContain('!isRuntimeOnly &&');
  });

  test('dims disabled content while keeping the re-enable control usable', () => {
    expect(source).toContain("file.disabled === true ? styles.cardDisabled : ''");
    expect(styles).toContain('.cardDisabled .identity');
    expect(styles).not.toMatch(/\.cardDisabled\s*\{[^}]*opacity:/);
  });

  test('uses a plain-text weight tooltip while preserving the details link', () => {
    expect(source).toContain("title={t('auth_files.weight_tooltip')}");
    expect(source).not.toContain("title={t('auth_files.weight_hint')}");
    const detailsSource = readFileSync(
      new URL('../src/features/authFiles/components/AuthFileDetailsSheet.tsx', import.meta.url),
      'utf8'
    );
    expect(detailsSource).toContain('i18nKey="auth_files.weight_hint"');

    for (const locale of ['en', 'zh-CN', 'zh-TW', 'ru']) {
      const { auth_files: messages } = JSON.parse(
        readFileSync(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8')
      ) as { auth_files: Record<string, string> };
      expect(messages.weight_tooltip).toBeTruthy();
      expect(messages.weight_tooltip).not.toMatch(/<[^>]+>/);
      expect(messages.weight_hint).toContain('<settingsLink>');
      expect(messages.weight_hint).toContain('</settingsLink>');
      expect(messages.weight_tooltip).toBe(messages.weight_hint.replace(/<\/?settingsLink>/g, ''));
    }
  });

  test('retains individual management actions and warning detail', () => {
    for (const handler of [
      'onShowModels(file)',
      'onDownload(file.name)',
      'onManualRefresh(file)',
      'onCooldownReset(file)',
      'onOpenPrefixProxyEditor(file)',
      'onDelete(file.name)',
    ]) {
      expect(source).toContain(handler);
    }
    expect(source).toContain('rawStatusMessage && hasStatusWarning');
    expect(source).toContain('showManualRefreshButton');
    expect(source).toContain('file.disabled ||');
  });
});
