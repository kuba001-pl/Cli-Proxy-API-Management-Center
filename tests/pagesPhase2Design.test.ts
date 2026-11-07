import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolvePluginDisplayState } from '../src/features/plugins/pluginStatus';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const LOCALES = ['en', 'zh-CN', 'zh-TW', 'ru', 'vi', 'ko', 'tr'];

const lookup = (json: Record<string, unknown>, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[part];
    return undefined;
  }, json);

describe('plugin display state', () => {
  const base = { enabled: true, registered: true, effectiveEnabled: true };

  test('a running plugin is Active', () => {
    expect(resolvePluginDisplayState(base, true)).toEqual({
      labelKey: 'plugin_management.status_active',
      tone: 'active',
    });
  });

  test('a switched-off plugin is Disabled without a hint', () => {
    const state = resolvePluginDisplayState(
      { ...base, enabled: false, effectiveEnabled: false },
      true
    );
    expect(state.labelKey).toBe('plugin_management.status_disabled');
    expect(state.tone).toBe('off');
    expect(state.hintKey).toBeUndefined();
  });

  test('an enabled plugin explains why it is not running', () => {
    const notRunning = { ...base, effectiveEnabled: false };
    expect(resolvePluginDisplayState(notRunning, false).labelKey).toBe(
      'plugin_management.status_paused'
    );
    expect(resolvePluginDisplayState({ ...notRunning, registered: false }, true).labelKey).toBe(
      'plugin_management.status_not_loaded'
    );
    const inactive = resolvePluginDisplayState(notRunning, true);
    expect(inactive.labelKey).toBe('plugin_management.status_inactive');
    expect(inactive.hintKey).toBe('plugin_management.status_inactive_hint');
    expect(inactive.tone).toBe('warning');
  });
});

describe('phase 2 page copy is translated everywhere', () => {
  const keys = [
    'plugin_management.status_active',
    'plugin_management.status_disabled',
    'plugin_management.status_not_loaded',
    'plugin_management.status_paused',
    'plugin_management.status_inactive_hint',
    'plugin_management.status_not_loaded_hint',
    'plugin_management.status_paused_hint',
    'plugin_management.plugins_dir',
    'plugin_store.retry',
    'routing.policy_title',
  ];

  // De-slop: the Plugins / Plugin Store headers no longer chain system state and counts.
  const removed = [
    'plugin_management.description',
    'plugin_management.system_on',
    'plugin_management.summary_active_other',
    'plugin_store.description',
    'plugin_store.summary_available_other',
    'routing.summary',
    'routing.policy_subtitle',
  ];

  for (const locale of LOCALES) {
    test(`${locale} drops the narrating header copy`, () => {
      const json = JSON.parse(read(`src/i18n/locales/${locale}.json`)) as Record<string, unknown>;
      for (const key of removed) {
        expect(lookup(json, key)).toBeUndefined();
      }
    });
  }

  for (const locale of LOCALES) {
    test(`${locale} has every key`, () => {
      const json = JSON.parse(read(`src/i18n/locales/${locale}.json`)) as Record<string, unknown>;
      for (const key of keys) {
        expect(typeof lookup(json, key)).toBe('string');
      }
    });
  }
});

describe('phase 2 page layout contracts', () => {
  test('routing offers a jump to the stacked gateway policy panel', () => {
    const page = read('src/features/routing/RoutingPage.tsx');
    const panel = read('src/features/routing/components/PolicyPanel.tsx');
    const styles = read('src/features/routing/RoutingPage.module.scss');
    expect(page).toContain('titleId={policyTitleId}');
    expect(page).toContain("behavior: prefersReducedMotion() ? 'auto' : 'smooth'");
    expect(panel).toContain('tabIndex={-1}');
    // Hidden while the panel sits beside the ladder.
    expect(styles).toMatch(/\.policyJump\s*\{\s*@media \(min-width: \$layout-stack \+ 1px\)/);
  });

  test('routing number inputs use the shared field tokens', () => {
    const styles = read('src/features/routing/RoutingPage.module.scss');
    expect(styles).toContain('border: 1px solid var(--border-control);');
    expect(styles).toContain('background: var(--bg-field);');
    expect(styles).not.toContain('font-size: 12.5px');
  });

  test('plugin meta rows hide the separator dot that starts a line', () => {
    for (const file of [
      'src/features/plugins/PluginsPage.module.scss',
      'src/features/plugins/PluginStorePage.module.scss',
    ]) {
      expect(read(file)).toContain('clip-path: inset(-4px -4px -4px $meta-dot-slot);');
    }
    expect(read('src/features/plugins/PluginStorePage.tsx')).not.toContain(
      '{index > 0 ? <span className={styles.metaDot}'
    );
  });

  test('a successful model fetch on System is meta text, not a badge', () => {
    const page = read('src/pages/SystemPage.tsx');
    expect(page).toContain("modelStatus.type === 'success' || modelStatus.type === 'muted'");
    expect(page).toContain('className={styles.modelCount}');
  });
});
