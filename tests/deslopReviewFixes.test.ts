import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { collectAmbiguousStorePluginIds } from '@/features/plugins/pluginResources';
import { resolvePluginDisplayState } from '@/features/plugins/pluginStatus';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const LOCALES = ['en', 'zh-CN', 'zh-TW', 'ru', 'vi', 'ko', 'tr'];
const locale = (name: string) => JSON.parse(read(`src/i18n/locales/${name}.json`));

describe('de-slop review fixes', () => {
  test('store source is named only for plugin IDs listed by more than one source', () => {
    const ids = collectAmbiguousStorePluginIds([
      { id: 'slack-alerts', sourceId: 'official', sourceUrl: '' },
      { id: 'slack-alerts', sourceId: 'mirror', sourceUrl: '' },
      { id: 'usage-exporter', sourceId: 'official', sourceUrl: '' },
      // The same source listing an ID twice is not ambiguous.
      { id: 'twice', sourceId: 'official', sourceUrl: '' },
      { id: 'twice', sourceId: 'official', sourceUrl: '' },
    ]);
    expect([...ids]).toEqual(['slack-alerts']);
  });

  test('an installed but disabled plugin is not presented like a running one', () => {
    const running = { enabled: true, registered: true, effectiveEnabled: true };
    const disabled = { enabled: false, registered: true, effectiveEnabled: false };
    expect(resolvePluginDisplayState(running, true).tone).toBe('active');
    expect(resolvePluginDisplayState(disabled, true).labelKey).toBe(
      'plugin_management.status_disabled'
    );
    const store = read('src/features/plugins/PluginStorePage.tsx');
    expect(store).toContain('resolvePluginDisplayState(entry');
  });

  test('plugin file path is a keyboard/touch disclosure, not a title tooltip', () => {
    const page = read('src/features/plugins/PluginsPage.tsx');
    expect(page).toContain('<details className={styles.pluginIdDetails}>');
    expect(page).not.toContain('title={pluginPath');
  });

  test('selected segment is an inverted pill; dense lists use the shared switch', () => {
    const segmented = read('src/components/ui/SegmentedControl.module.scss');
    expect(segmented).toMatch(/\[aria-checked='true'\] \{\s*background: var\(--accent\);/);
    expect(segmented).toContain('color: var(--text-on-accent);');
    for (const file of [
      'src/features/authFiles/components/AuthFileCard.module.scss',
      'src/features/providers/components/ProviderResourceTable.module.scss',
    ]) {
      expect(read(file)).not.toContain("input[role='switch']:checked");
    }
  });

  test('focus halos use the focus-ring token, not the decorative accent wash', () => {
    for (const file of [
      'src/styles/components.scss',
      'src/components/ui/Select.module.scss',
      'src/components/excludedModels/ExcludedModelsPicker.module.scss',
    ]) {
      expect(read(file)).not.toContain('0 0 0 3px var(--accent-subtle)');
    }
  });

  test('locales: theme menu labels gone, toggle names kept, new keys translated', () => {
    for (const name of LOCALES) {
      const data = locale(name);
      expect(Object.keys(data.theme).sort()).toEqual(['switch_to_dark', 'switch_to_light']);
      expect(typeof data.nav_groups.plugin_pages).toBe('string');
      expect(data.plugin_management.file_path.trim()).not.toBe('');
      expect(data.dashboard.cta_title).toBeUndefined();
      expect(data.dashboard.stat_models_hint).toBeUndefined();
      expect(data.providersPage.modelCatalog).toBeUndefined();
      // The empty-save consequence names its exact scope, not "removes that provider".
      expect(data.oauth_model_alias.model_source_loaded).toContain('{{count}}');
    }
    expect(locale('en').oauth_model_alias.model_source_loaded).toContain(
      "removes only this provider's aliases"
    );
  });
});
