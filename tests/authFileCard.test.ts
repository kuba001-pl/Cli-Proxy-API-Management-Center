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

  test('masks free-form account notes as a whole in privacy mode', () => {
    expect(source).toMatch(/const noteValue = privacyIdentity\(privacy,/);
    expect(source).toContain('title={noteValue}');
  });

  test('keeps disabled credential data readable and labels the state instead', () => {
    expect(source).toContain("file.disabled === true ? styles.cardDisabled : ''");
    expect(source).toContain("t('auth_files.health_status_disabled')");
    // Round-2 council: group opacity pushed account/health/quota text below 4.5:1.
    expect(styles).not.toMatch(/\.cardDisabled[^{]*\{[^}]*opacity:/);
  });

  test('offers a sign-in recovery for expired credentials and a labelled row menu', () => {
    expect(source).toContain('needsAuthFileReauth(file)');
    expect(source).toContain("t('auth_files.sign_in_again')");
    expect(source).toContain("navigate('/oauth')");
    expect(source).toContain('<ResourceActionsMenu');
    expect(source).toContain("t('auth_files.row_actions', { name: identity.primary })");
    // The ellipsis is a real menu, not a second expansion toggle.
    expect(source.match(/aria-controls=\{detailsId\}/g)).toHaveLength(1);
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
    expect(source).toContain('disableControls || file.disabled === true || statusLocked');
  });
});
