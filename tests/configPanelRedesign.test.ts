import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { ConfigHeader } from '@/features/config/components/ConfigHeader';
import { ModeSwitch } from '@/features/config/components/ModeSwitch';
import { ConfigTabs } from '@/features/config/components/ConfigTabs';
import { ConfigDirtyFieldsContext } from '@/features/config/components/fields/dirtyFieldsContext';
import { TextSetting } from '@/features/config/components/fields/FieldPrimitives';
import { ApiKeysCardEditor } from '@/features/config/components/blocks/ApiKeysCardEditor';
import { buildHeaderMeta, resolveStatus } from '@/features/config/uiState';

const noop = () => {};
const english = i18n.cloneInstance({ lng: 'en' });
const render = (child: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(I18nextProvider, { i18n: english }, child));
const status = (dirty: boolean) =>
  resolveStatus({
    disconnected: false,
    loading: false,
    loadFailed: false,
    yamlError: false,
    validationBlocked: false,
    saving: false,
    dirty,
  });

describe('config panel redesign', () => {
  test('header shows at most one fact: nothing when clean, the unsaved count when dirty', () => {
    const header = (dirtyCount: number, sourceDirty = false) =>
      render(
        createElement(ConfigHeader, {
          meta: buildHeaderMeta({
            fieldCount: 94,
            status: status(dirtyCount > 0 || sourceDirty),
            dirtyCount,
            sourceDirty,
            errorCount: 0,
          }),
          reloadDisabled: false,
          reloading: false,
          onReload: noop,
          extraActions: createElement(ModeSwitch, { mode: 'visual', onChange: noop }),
        })
      );
    expect(header(0)).toContain('>Config<');
    // Routine facts ("94 settings", "In sync") stay out of the header (de-slop rule 3).
    expect(header(0)).not.toContain('94 settings');
    expect(header(0)).not.toContain('In sync');
    expect(header(0)).not.toContain('unsaved');
    expect(header(0)).not.toContain('·');
    expect(header(2)).toContain('2 unsaved');
    expect(header(2)).not.toContain('94 settings');
    expect(header(0, true)).toContain('1 unsaved');
    expect(header(0).indexOf('Reload')).toBeLessThan(header(0).indexOf('radiogroup'));
    expect(header(0)).toContain('role="radio" aria-checked="true" tabindex="0"');
  });

  test('tabs retain a single keyboard entry point and panel relationships', () => {
    const markup = render(
      createElement(ConfigTabs, {
        active: 'network',
        dirtyTabs: new Set(),
        errorCounts: {},
        onChange: noop,
      })
    );
    expect(markup).toContain('role="tablist"');
    expect([...markup.matchAll(/role="tab"/g)]).toHaveLength(7);
    expect([...markup.matchAll(/tabindex="0"/g)]).toHaveLength(1);
    expect(markup).toContain('aria-selected="true" aria-controls="config-panel-network"');
  });

  test('dirty indicators follow the existing leaf-key mapping and clear with the draft', () => {
    const row = (dirty: ReadonlySet<string>) =>
      render(
        createElement(
          ConfigDirtyFieldsContext,
          { value: dirty },
          createElement(TextSetting, {
            fieldId: 'streamingKeepaliveSeconds',
            label: 'Keepalive',
            value: '5',
            onChange: noop,
          })
        )
      );
    expect(row(new Set(['streaming.keepaliveSeconds']))).toContain('role="img"');
    expect(row(new Set(['streaming.keepaliveSeconds']))).toContain('aria-label="Unsaved"');
    expect(row(new Set(['host']))).not.toContain('role="img"');
    expect(row(new Set())).not.toContain('role="img"');
  });

  test('key list keeps credentials masked and names all icon actions', () => {
    const key = 'sk-config-fixture-secret-abcdef';
    const markup = render(createElement(ApiKeysCardEditor, { value: key, onChange: noop }));
    expect(markup).not.toContain(key);
    expect(markup).toContain('#1');
    expect(markup).toContain('aria-label="Copy"');
    expect(markup).toContain('aria-label="Edit"');
    expect(markup).toContain('aria-label="Delete"');
  });

  test('save bar stays tied to document dirty state and existing save/discard handlers', async () => {
    const page = await Bun.file('src/features/config/ConfigPage.tsx').text();
    expect(page).toContain('visible={isCurrentLayer && doc.isDirty}');
    expect(page).toContain('onSave={doc.handleSave}');
    expect(page).toContain('onDiscard={doc.handleDiscard}');
    expect(page).toContain(
      "t('config_management.unsaved_changes', { count: Math.max(1, unsavedCount) })"
    );
    expect(page).toContain('heightVar="--config-action-bar-height"');
    const style = await Bun.file(
      'src/features/config/components/FloatingSaveBar.module.scss'
    ).text();
    expect(style).toContain('-webkit-backdrop-filter: blur(12px)');
    expect(style).toContain('@media (prefers-reduced-motion: reduce)');
    const tabs = await Bun.file('src/features/config/components/ConfigTabs.module.scss').text();
    expect(tabs).toContain('flex-wrap: nowrap');
    expect(tabs).toContain('overflow-x: auto');
    expect(tabs).toContain('background: var(--bg-active)');
  });

  test('unsaved counts use every locale’s plural forms', () => {
    for (const lng of ['en', 'zh-CN', 'zh-TW', 'ru', 'vi', 'ko', 'tr']) {
      const translate = i18n.getFixedT(lng);
      for (const count of [1, 2, 5]) {
        const label = translate('config_management.unsaved_changes', { count });
        expect(label).toContain(String(count));
        expect(label).not.toContain('config_management.');
      }
    }
    expect(english.t('config_management.unsaved_changes', { count: 1 })).toBe('1 unsaved change');
    expect(english.t('config_management.unsaved_changes', { count: 2 })).toBe('2 unsaved changes');
  });
});
