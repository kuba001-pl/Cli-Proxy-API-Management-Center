import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// Plugin names and menu labels are free text published by the plugin. Every place that renders
// them must go through Privacy Mode. The delete confirmation passes the raw name on purpose:
// ConfirmationModal masks string messages at render time.
describe('plugin title privacy', () => {
  test('the plugins page only renders plugin titles through the mask', () => {
    let page = source('src/features/plugins/PluginsPage.tsx');
    expect(page).toContain('privacyText(privacyEnabled, getPluginTitle(plugin))');
    expect(page).toContain('privacyText(privacyEnabled, getPluginTitle(editingPlugin))');
    page = page
      .replace(/privacyText\(privacyEnabled, getPluginTitle\((plugin|editingPlugin)\)\)/g, '')
      .replace('const name = getPluginTitle(plugin);', '')
      // Search matches against the raw name; that is not a render.
      .replace('plugin.metadata?.name,', '');
    expect(page.match(/getPluginTitle\(/g) ?? []).toEqual([]);
    // The raw plugin name must not be rendered around the helper either.
    expect(page.match(/metadata\??\.name\b/g) ?? []).toEqual([]);
  });

  test('the plugin resource frame masks its accessible title', () => {
    const page = source('src/features/plugins/PluginResourcePage.tsx');
    expect(page).toContain('title={privacyText(privacyEnabled, resource.label)}');
    expect(page.replace('privacyText(privacyEnabled, resource.label)', '')).not.toMatch(
      /resource\??\.label\b/
    );
  });
});
