import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'bun:test';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { ProviderHeaderCard } from '@/features/providers/components/ProviderHeaderCard';
import { ProviderResourcePanel } from '@/features/providers/components/ProviderResourcePanel';
import { ProviderResourceTable } from '@/features/providers/components/ProviderResourceTable';
import { ResourceDetailView } from '@/features/providers/sheets/ResourceDetailView';
import { BaseProviderForm } from '@/features/providers/sheets/forms/BaseProviderForm';
import { getProviderDisplayName } from '@/features/providers/privacy';
import type { ProviderResource } from '@/features/providers/types';
import { usePrivacyStore } from '@/stores/usePrivacyStore';
import { PRIVACY_MASK } from '@/utils/privacy';
import en from '@/i18n/locales/en.json';

const i18n = createInstance();
await i18n.init({ lng: 'en', resources: { en: { translation: en } } });
const render = (element: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(RouterProvider, {
        router: createMemoryRouter([{ path: '/', element }]),
      })
    )
  );
const noop = () => {};
const resource: ProviderResource = {
  id: 'example-channel',
  brand: 'openaiCompatibility',
  originalIndex: 0,
  name: 'demo-account@example.test',
  identifier: 'demo-account@example.test',
  apiKeyPreview: 'sk-demo••••1234',
  apiKey: null,
  authIndex: null,
  baseUrl: 'https://api.example.test/v1',
  proxyUrl: null,
  prefix: null,
  modelCount: 3,
  models: ['example-model'],
  priority: 0,
  headerCount: 2,
  excludedModelCount: 0,
  apiKeyEntryCount: 2,
  disabled: false,
  flags: {},
  selector: { brand: 'openaiCompatibility', name: 'demo-account@example.test', index: 0 },
  raw: {
    name: 'demo-account@example.test',
    baseUrl: 'https://api.example.test/v1',
    apiKeyEntries: [{ apiKey: 'sk-example-fixture' }],
  },
};
const table = () =>
  render(
    createElement(ProviderResourceTable, {
      resources: [resource],
      onView: noop,
      onEdit: noop,
      onDelete: noop,
      onToggleDisabled: noop,
    })
  );

// React server rendering reads Zustand's initial snapshot rather than live browser state.
const initialPrivacyEnabled = usePrivacyStore.getInitialState().enabled;
const setPrivacy = (enabled: boolean) => {
  usePrivacyStore.getInitialState().enabled = enabled;
};
afterEach(() => setPrivacy(initialPrivacyEnabled));

describe('provider redesign', () => {
  test('keeps refresh, creation and a single active-resource caption', () => {
    const html = render(
      createElement(ProviderHeaderCard, {
        totalActive: 2,
        totalResources: 3,
        providerFamilies: 1,
        updatedAtLabel: 'Example time',
        onRefresh: noop,
        onNew: noop,
      })
    );
    expect(html).toContain('<h1');
    expect(html).toContain('AI Providers');
    expect(html).toContain('2/3 active resources');
    // De-slop: one fact under the title, no " · " chain of family count and fetch time.
    expect(html).not.toContain('Updated Example time');
    expect(html).not.toContain('provider famil');
    expect(html).toContain('aria-label="Refresh"');
    expect(html).toContain('New');
  });

  test('derives header totals from the existing group, including multiple channel keys', () => {
    const html = render(
      createElement(ProviderResourcePanel, {
        group: { id: resource.brand, resources: [resource] },
        filter: '',
        onFilterChange: noop,
        filteredResources: [resource],
        selectedId: null,
        onView: noop,
        onEdit: noop,
        onDelete: noop,
        onCreate: noop,
      })
    );
    expect(html).toContain('<dt>Keys</dt><dd>2</dd>');
    expect(html).toContain('<dt>Models</dt><dd>3</dd>');
    expect(html).toContain('<dt>Headers</dt><dd>2</dd>');
    expect(html).toContain('aria-label="Search keys, URLs, prefixes…"');
  });

  test('does not invent keys for a channel without credentials', () => {
    const emptyChannel = { ...resource, apiKeyEntryCount: 0, apiKeyPreview: null };
    const html = render(
      createElement(ProviderResourcePanel, {
        group: { id: resource.brand, resources: [emptyChannel] },
        filter: '',
        onFilterChange: noop,
        filteredResources: [],
        selectedId: null,
        onView: noop,
        onEdit: noop,
        onDelete: noop,
        onCreate: noop,
      })
    );
    expect(html).toContain('<dt>Keys</dt><dd>0</dd>');
  });

  test('keeps the table actions and enabled toggle with a masked key preview', () => {
    const html = table();
    expect(html).toContain('Enabled');
    expect(html).toContain('type="checkbox"');
    for (const label of ['Edit', 'More actions', 'Disable']) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    // View/Delete live in the accessible overflow menu (Figma: edit + ellipsis).
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    const tableSource = readFileSync(
      'src/features/providers/components/ProviderResourceTable.tsx',
      'utf8'
    );
    expect(tableSource).toContain("label: t('providersPage.actions.view')");
    expect(tableSource).toContain("label: t('providersPage.actions.delete')");
    expect(tableSource).toContain('onSelect: () => onDelete(resource)');
    expect(html).toContain(resource.apiKeyPreview!);
    expect(html).not.toContain('sk-example-fixture');
  });
});

describe('provider privacy presentation', () => {
  test('masks user-defined names completely and keeps the original resource and selector', () => {
    const before = structuredClone(resource);
    expect(getProviderDisplayName(resource, true)).toBe(PRIVACY_MASK);
    expect(getProviderDisplayName(resource, false)).toBe(resource.name!);
    expect(resource).toEqual(before);
  });

  test('preserves API-key previews and static sponsor brand names', () => {
    expect(
      getProviderDisplayName(
        { ...resource, brand: 'claude', name: null, identifier: 'sk-demo••••1234' },
        true
      )
    ).toBe('sk-demo••••1234');
    expect(getProviderDisplayName({ ...resource, brand: 'kimi', name: 'Kimi' }, true)).toBe('Kimi');
  });

  test('masks names in table and details, including identity portions of endpoint URLs', () => {
    setPrivacy(true);
    const privateResource = {
      ...resource,
      baseUrl: 'https://api.example.test/demo-account@example.test/v1',
    };
    const detail = render(createElement(ResourceDetailView, { resource: privateResource }));
    for (const html of [table(), detail]) {
      expect(html).not.toContain('demo-account@example.test');
      expect(html).toContain(PRIVACY_MASK);
    }
    expect(table()).toContain(resource.apiKeyPreview!);
  });

  test('shows non-email channel names as-is and never treats them as URL identities', () => {
    const channel = { ...resource, name: 'api', baseUrl: 'https://api.example.com/v1' };
    expect(getProviderDisplayName(channel, true)).toBe('api');
    expect(getProviderDisplayName({ ...resource, name: 'Work gateway' }, true)).toBe(
      'Work gateway'
    );
    setPrivacy(true);
    const html = render(
      createElement(ProviderResourceTable, {
        resources: [channel],
        onView: noop,
        onEdit: noop,
        onDelete: noop,
        onToggleDisabled: noop,
      })
    );
    expect(html).toContain('https://api.example.com/v1');
    expect(html).not.toContain(PRIVACY_MASK + '.example.com');
  });

  test('returns to the original label when privacy is disabled', () => {
    setPrivacy(false);
    expect(table()).toContain(resource.name!);
  });

  test('keeps form values intact under the fixed display mask', () => {
    setPrivacy(true);
    const html = render(
      createElement(BaseProviderForm, {
        brand: resource.brand,
        resource,
        mode: 'edit',
        mutating: false,
        formId: 'provider-test',
        onSubmit: async () => {},
      })
    );
    expect(html).toContain('type="password"');
    expect(html).toContain(`value="${resource.name}"`);
    expect(html).toContain(PRIVACY_MASK);
  });
});
