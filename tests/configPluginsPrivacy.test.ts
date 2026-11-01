import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { usePrivacyStore } from '@/stores/usePrivacyStore';
import { PRIVACY_MASK } from '@/utils/privacy';
import {
  maskUrlUserinfo,
  privacyConfigText,
  privacyDisplayText,
  resolveSourcePreview,
} from '@/features/config/privacy';
import { CodexLiveICEServersEditor } from '@/features/config/components/blocks/CodexLiveICEServersEditor';
import { ProxyUrlField } from '@/features/config/components/fields/sharedFields';
import { DEFAULT_VISUAL_VALUES } from '@/types/visualConfig';

const translations = i18n.cloneInstance({ lng: 'en' });
const render = (element: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(I18nextProvider, { i18n: translations }, element));
const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// Static rendering reads zustand's server snapshot (the store's initial-state object), not live
// state, so tests flip that object directly and restore it afterwards.
const serverSnapshot = usePrivacyStore.getInitialState() as { enabled: boolean };
const enablePrivacy = () => {
  usePrivacyStore.setState({ enabled: true });
  serverSnapshot.enabled = true;
};
afterEach(() => {
  serverSnapshot.enabled = false;
  usePrivacyStore.setState({ enabled: false });
});

const YAML = [
  'proxy-url: socks5://alice:s3cret@127.0.0.1:1080/',
  'codex-live:',
  '  ice-servers:',
  '    - urls: [turn:turn.example.test:3478]',
  '      username: turn-user # shared',
  '      credential: synthetic',
  'owner: person@example.com',
  'auth-dir: /home/alice/.cli-proxy-api',
].join('\n');

describe('config/plugins privacy display helpers', () => {
  test('masks URL userinfo, identity keys, emails and home-dir usernames', () => {
    const masked = privacyConfigText(true, YAML);
    for (const secret of ['alice', 's3cret', 'turn-user', 'person@example.com']) {
      expect(masked).not.toContain(secret);
    }
    expect(masked).toContain(`proxy-url: socks5://${PRIVACY_MASK}@127.0.0.1:1080/`);
    expect(masked).toContain(`username: ${PRIVACY_MASK} # shared`);
    expect(masked).toContain(`auth-dir: /home/${PRIVACY_MASK}/.cli-proxy-api`);
    expect(masked).toContain('credential: synthetic');
    expect(masked.split('\n')).toHaveLength(YAML.split('\n').length);
  });

  test('is a no-op when privacy is off', () => {
    expect(privacyConfigText(false, YAML)).toBe(YAML);
    expect(privacyDisplayText(false, 'Jane <jane@example.com>')).toBe('Jane <jane@example.com>');
  });

  test('masks emails and URL credentials in free text such as plugin metadata', () => {
    const author = privacyDisplayText(true, 'Jane <jane@example.com>');
    expect(author).not.toContain('jane@example.com');
    expect(author).toContain(PRIVACY_MASK);
    const url = maskUrlUserinfo('https://bob:pw@store.example.com/index.json');
    expect(url).toBe(`https://${PRIVACY_MASK}@store.example.com/index.json`);
  });
});

describe('config source editor privacy mode', () => {
  test('privacy yields a separate masked preview and never a replacement document', () => {
    const preview = resolveSourcePreview(YAML, true);
    expect(preview.masked).toBe(true);
    if (preview.masked) expect(preview.previewText).not.toContain('turn-user');
    expect(resolveSourcePreview(YAML, false)).toEqual({ masked: false });
  });

  test('every locale has a real translation for the paused-editing notice', () => {
    const en = JSON.parse(source('src/i18n/locales/en.json')).config_management
      .privacy_source_paused as string;
    for (const locale of ['zh-CN', 'zh-TW', 'ru', 'vi', 'ko', 'tr']) {
      const value = JSON.parse(source(`src/i18n/locales/${locale}.json`)).config_management
        .privacy_source_paused;
      expect(typeof value).toBe('string');
      expect(value).not.toBe(en);
    }
  });
});

describe('config visual fields privacy mode', () => {
  const server = {
    id: 'fixture-ice',
    urlsText: 'turn:turn.example.test:3478',
    username: 'turn-user',
    credential: 'synthetic-turn-password',
  };
  const renderIce = () =>
    render(createElement(CodexLiveICEServersEditor, { value: [server], onChange: () => {} }));

  test('ICE usernames render as password inputs only when privacy is on', () => {
    expect(renderIce()).not.toMatch(/type="password"[^>]*value="turn-user"/);
    enablePrivacy();
    expect(renderIce()).toMatch(/type="password"[^>]*value="turn-user"/);
    expect(server.username).toBe('turn-user');
  });

  test('proxy URL field is visually concealed when privacy is on', () => {
    enablePrivacy();
    const markup = render(
      createElement(ProxyUrlField, {
        values: { ...DEFAULT_VISUAL_VALUES, proxyUrl: 'socks5://alice:pw@127.0.0.1:1080' },
        disabled: false,
        onChange: () => {},
      })
    );
    expect(markup).toMatch(/type="password"[^>]*value="socks5:\/\/alice:pw@127.0.0.1:1080"/);
  });
});

describe('privacy wiring in config, plugins and OAuth editor pages', () => {
  test('diff modal masks displayed line text only', () => {
    const diff = source('src/features/config/components/DiffModal.tsx');
    // Whole documents are masked so multi-line YAML scalars keep their context.
    expect(diff).toContain('privacyConfigLines(true, original)');
    expect(diff).toContain('privacyConfigLines(true, modified)');
    expect(diff).not.toContain('privacyConfigText(privacyEnabled, line.text)');
    expect(diff).toContain('computeUnifiedDiff(original, modified)');
  });

  test('plugin metadata and errors are masked reactively', () => {
    const plugins = source('src/features/plugins/PluginsPage.tsx');
    expect(plugins).toContain('privacyText(privacyEnabled, plugin.metadata?.author)');
    expect(plugins).toContain('privacyText(privacyEnabled, plugin.path)');
    expect(plugins).toContain('privacyText(privacyEnabled, error)');
    expect(plugins).toContain('privacyText(privacyEnabled, field.description)');
    const store = source('src/features/plugins/PluginStorePage.tsx');
    expect(store).toContain('privacyText(privacyEnabled, entry.author)');
    expect(store).toContain('privacyText(privacyEnabled, error.message)');
    // C08: store source warnings.
    expect(store).toContain('privacyText(privacyEnabled, sourceLabel)');
    expect(store).toContain('privacyText(privacyEnabled, sourceError.message)');
    // C06: the global plugin directory, text and native tooltip.
    for (const page of [plugins, store]) {
      expect(page).toContain("privacyText(privacyEnabled, data?.pluginsDir || 'plugins')");
      expect(page).toContain('title={pluginsDirLabel}');
      expect(page).not.toContain('title={data.pluginsDir');
    }
  });

  test('OAuth editor initial-load errors are masked at render', () => {
    for (const page of [
      'src/pages/AuthFilesOAuthExcludedEditPage.tsx',
      'src/pages/AuthFilesOAuthModelAliasEditPage.tsx',
    ]) {
      const text = source(page);
      expect(text).toContain('usePrivacyStore((state) => state.enabled)');
      expect(text).toContain('privacyText(privacyEnabled, initialLoadError)');
    }
  });
});
