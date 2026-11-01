import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { usePrivacyStore } from '@/stores/usePrivacyStore';
import { PRIVACY_MASK } from '@/utils/privacy';
import {
  configDocumentIdentities,
  privacyConfigLines,
  privacyConfigText,
} from '@/features/config/privacy';
import { parseAllDocuments, parseDocument } from 'yaml';
import { privacyLogText } from '@/features/logs/model/logPrivacy';
import { ExpandableInput } from '@/features/config/components/blocks/ExpandableInput';
import { SectionConnectivity } from '@/features/config/components/sections/SectionConnectivity';
import { DEFAULT_VISUAL_VALUES } from '@/types/visualConfig';

const translations = i18n.cloneInstance({ lng: 'en' });
const render = (element: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(I18nextProvider, { i18n: translations }, element));
const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const serverSnapshot = usePrivacyStore.getInitialState() as { enabled: boolean };
const enablePrivacy = () => {
  usePrivacyStore.setState({ enabled: true });
  serverSnapshot.enabled = true;
};
afterEach(() => {
  serverSnapshot.enabled = false;
  usePrivacyStore.setState({ enabled: false });
});

describe('config YAML privacy covers every scalar style (C10)', () => {
  const cases: Array<[string, string]> = [
    ['literal block scalar', 'username: |\n  alice\n  second-line\nport: 8317'],
    ['folded block scalar in a sequence', '  - username: >-\n      alice\n\n      more\n    x: 1'],
    ['flow mapping', 'ice-servers: [{username: alice, credential: fixture}]'],
    ['quoted flow key/value', 'ice: [{"username": "alice", urls: [turn:x]}]'],
    ['plain multi-line scalar', 'user:\n  alice\nport: 1'],
    ['single-quoted value with comment', "login: 'al''ice' # shared"],
  ];

  for (const [name, yaml] of cases) {
    test(name, () => {
      const masked = privacyConfigText(true, yaml);
      expect(masked).not.toContain('alice');
      expect(masked).toContain(PRIVACY_MASK);
      // Line-for-line: the diff view indexes masked lines by raw line numbers.
      expect(masked.split('\n')).toHaveLength(yaml.split('\n').length);
    });
  }

  test('masks every line of valid multi-line plain, quoted and flow scalars (C10)', () => {
    const docs = [
      'username: alice\n  smith\nport: 1',
      'username: "alice\n  smith"\nport: 1',
      "username: 'alice\n  smith'\nport: 1",
      'x: {username: "alice\n  smith", port: 1}',
      'x: [{username: alice\n  smith}]\nport: 1',
    ];
    for (const yaml of docs) {
      const parsed = parseDocument(yaml);
      expect(parsed.errors).toHaveLength(0);
      expect(JSON.stringify(parsed.toJS())).toContain('alice smith');
      const masked = privacyConfigText(true, yaml);
      expect(masked).not.toContain('alice');
      expect(masked).not.toContain('smith');
      expect(masked).toContain('port: 1');
      expect(masked.split('\n')).toHaveLength(yaml.split('\n').length);
    }
  });

  test('keeps non-identity siblings, nested keys and comments readable', () => {
    const yaml = 'account:\n  id: 7\n  email: alice@example.test\nport: 8317\nlogin: x # note';
    const masked = privacyConfigText(true, yaml);
    expect(masked).toContain('  id: 7');
    expect(masked).toContain('port: 8317');
    expect(masked).toContain(`login: ${PRIVACY_MASK} # note`);
    expect(masked).not.toContain('alice');
    expect(privacyConfigText(true, 'ice: [{username: a, credential: fixture}]')).toContain(
      'credential: fixture'
    );
  });

  test('home-dir and URL userinfo masking comes from the core helper', () => {
    const yaml =
      'dirs: [/home/alice/a, /Users/bob/b]\nwin: "C:\\\\Users\\\\carol\\\\x"\nproxy: socks5://dave:pw@h:1';
    const masked = privacyConfigText(true, yaml);
    for (const name of ['alice', 'bob', 'carol', 'dave', 'pw@']) expect(masked).not.toContain(name);
    expect(source('src/features/config/privacy.ts')).not.toContain('HOME_PATH_PATTERN');
  });

  test('config tabs only reference classes defined in their module (C15)', () => {
    expect(source('src/features/config/components/ConfigTabs.tsx')).not.toContain(
      'styles.tabLabel'
    );
  });

  test('diff lines come from whole-document masking', () => {
    const yaml = 'a: 1\nusername: |\n  alice\nb: 2';
    expect(privacyConfigLines(true, yaml)[2]).toBe(`  ${PRIVACY_MASK}`);
    expect(privacyConfigLines(false, yaml)).toEqual(yaml.split('\n'));
  });
});

describe('source privacy preview is separate and read-only (C01)', () => {
  test('masked text goes to a hard read-only editor without onChange', () => {
    const panel = source('src/features/config/components/SourcePanel.tsx');
    const masked = panel.slice(
      panel.indexOf('key="masked-preview"'),
      panel.indexOf('key="source"')
    );
    expect(masked).toContain('value={preview.previewText}');
    expect(masked).toContain('readOnly');
    expect(masked).not.toContain('onChange');
    const editable = panel.slice(panel.indexOf('key="source"'));
    expect(editable).toContain('value={value}');
    expect(editable).toContain('onChange={onChange}');
    const editor = source('src/features/config/components/ConfigSourceEditor.tsx');
    expect(editor).toContain('onChange={readOnly ? undefined : onChange}');
    expect(editor).toContain('readOnly={readOnly}');
  });
});

describe('identity-bearing visual config fields are concealed (C05)', () => {
  const values = {
    ...DEFAULT_VISUAL_VALUES,
    authDir: '/home/alice/.cli-proxy-api',
    rmPanelRepo: 'https://alice:token@git.example.test/panel',
  };
  const renderSection = () =>
    render(
      createElement(SectionConnectivity, {
        values,
        validationErrors: {},
        disabled: false,
        onChange: () => {},
      })
    );

  test('auth dir renders as plain text without privacy and concealed with it', () => {
    expect(renderSection()).toMatch(/type="text"[^>]*value="\/home\/alice\/.cli-proxy-api"/);
    enablePrivacy();
    expect(renderSection()).toMatch(/type="password"[^>]*value="\/home\/alice\/.cli-proxy-api"/);
    expect(values.authDir).toBe('/home/alice/.cli-proxy-api');
  });

  test('sensitive list inputs conceal the value and drop the expand toggle', () => {
    const url = 'https://alice:token@store.example.test/index.json';
    const renderInput = () =>
      render(
        createElement(ExpandableInput, { value: url, privacySensitive: true, onChange: () => {} })
      );
    expect(renderInput()).toContain('aria-label="Expand"');
    enablePrivacy();
    const markup = renderInput();
    expect(markup).toMatch(/type="password"[^>]*value="https:\/\/alice:token@/);
    expect(markup).not.toContain('aria-label="Expand"');
  });
});

describe('log credential file names without email syntax (C09)', () => {
  test('masks the identity segment and keeps provider, hash and plan', () => {
    expect(privacyLogText(true, 'refresh codex-alice.json done')).toBe(
      `refresh codex-${PRIVACY_MASK}.json done`
    );
    const line = privacyLogText(true, 'retry claude-5aebc0bd-alice-plus.json for alice');
    expect(line).toBe(`retry claude-5aebc0bd-${PRIVACY_MASK}-plus.json for ${PRIVACY_MASK}`);
  });

  test('finds file names inside paths and leaves non-credential files alone', () => {
    const masked = privacyLogText(true, 'loaded /srv/auth/codex-dbffca66-bob-team.json');
    expect(masked).toBe(`loaded /srv/auth/codex-dbffca66-${PRIVACY_MASK}-team.json`);
    expect(privacyLogText(true, 'read models.json and config.json')).toBe(
      'read models.json and config.json'
    );
    expect(privacyLogText(false, 'codex-alice.json')).toBe('codex-alice.json');
  });
});

describe('YAML parser diagnostics are redacted with whole-document context (C12)', () => {
  test('a duplicate-key excerpt that omits the username header stays masked', () => {
    const yaml = 'username: |\n  alice\nusername: |\n  bob\n';
    const [document] = parseAllDocuments(yaml) as ReturnType<typeof parseDocument>[];
    const message = document.errors[0].message;
    expect(message).toContain('  alice');
    // Without document context the excerpt leaks the first block-scalar body.
    expect(privacyConfigText(true, message)).toContain('alice');
    const masked = privacyConfigText(true, message, configDocumentIdentities(yaml));
    expect(masked).not.toContain('alice');
    expect(masked).toContain('Map keys must be unique');
    expect(privacyConfigText(false, message, configDocumentIdentities(yaml))).toBe(message);
  });

  test('collects identity values from parsed and line-rule spans, not unrelated keys', () => {
    const identities = configDocumentIdentities(
      'username: alice\n  smith\nemail: "bob@example.test"\nport: 8317\nhost: example.test'
    );
    expect(identities).toEqual(expect.arrayContaining(['alice smith', 'alice', 'smith']));
    expect(identities).toContain('bob@example.test');
    expect(identities).not.toContain('8317');
    expect(identities).not.toContain('example.test');
  });
});

describe('config, routing and logs polish contracts', () => {
  test('config load and YAML parse errors are masked at render (C12)', () => {
    const page = source('src/features/config/ConfigPage.tsx');
    expect(page).toContain('privacyDisplayText(privacyEnabled, doc.error)');
    expect(page).toContain(
      'privacyConfigText(privacyEnabled, visualParseError, parseErrorIdentities)'
    );
    expect(page).toContain('configDocumentIdentities(doc.content)');
    expect(page).toContain('{ identities: parseErrorIdentities }');
  });

  test('save bar fits the content column at the desktop boundary (C14)', () => {
    const styles = source('src/features/config/components/FloatingSaveBar.module.scss');
    expect(styles).not.toMatch(/min-width:\s*514px/);
    expect(styles).toContain('min-width: min(514px, var(--save-bar-max))');
    expect(styles).toContain('flex-wrap: wrap');
  });

  test('diff colors use semantic theme tokens (B12)', () => {
    const styles = source('src/features/config/components/DiffModal.module.scss');
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(styles).toContain('var(--status-success)');
    expect(styles).toContain('var(--status-danger)');
  });

  test('SectionCard no longer accepts retired index/icon props (C17)', () => {
    const card = source('src/features/config/components/SectionCard.tsx');
    expect(card).not.toContain('indexLabel');
    expect(card).not.toMatch(/\bicon\?:/);
  });

  test('error-log actions use the sans stack (B15)', () => {
    const styles = source('src/features/logs/LogsPage.module.scss');
    const actions = styles.slice(styles.indexOf('.fileActions {'));
    expect(actions.slice(0, actions.indexOf('\n}'))).toContain('font-family: $font-family');
  });

  test('save/load failure and clear-logs titles exist in every locale (B03, B04)', () => {
    for (const lng of ['en', 'zh-CN', 'zh-TW', 'ru', 'vi', 'ko', 'tr']) {
      const t = i18n.getFixedT(lng);
      for (const key of [
        'notification.save_failed',
        'notification.load_failed',
        'logs.clear_confirm_title',
      ]) {
        expect(i18n.exists(key, { lng, fallbackLng: false })).toBe(true);
        expect(t(key)).not.toBe(key);
      }
    }
    expect(source('src/features/logs/hooks/useLogStream.ts')).toContain(
      "t('logs.clear_confirm_title')"
    );
  });
});
