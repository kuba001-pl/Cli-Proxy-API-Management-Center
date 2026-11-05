import { afterEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { usePrivacyStore } from '@/stores/usePrivacyStore';
import { PluginInstallGateModal } from '@/features/plugins/components/PluginInstallGateModal';
import { PluginQuotaBody } from '@/features/quota/providers/plugin/PluginQuotaBody';
import { QUOTA_CLASS_KEYS, bindQuotaClasses } from '@/features/quota/types';
import type { PluginQuotaState, PluginStoreEntry } from '@/types';

const EMAIL = 'reviewer@example.test';

const translations = i18n.cloneInstance({ lng: 'en' });
const render = (element: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(I18nextProvider, { i18n: translations }, element));

// Static rendering reads zustand's server snapshot (the store's initial-state object), not live
// state, so tests flip that object directly and restore it afterwards.
const serverSnapshot = usePrivacyStore.getInitialState() as { enabled: boolean };
const setPrivacy = (enabled: boolean) => {
  usePrivacyStore.setState({ enabled });
  serverSnapshot.enabled = enabled;
};
afterEach(() => setPrivacy(false));

const classes = bindQuotaClasses(
  Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, key])),
  'test'
);

// Every free-text field a plugin's quota response can carry holds an identity.
const quota: PluginQuotaState = {
  status: 'success',
  subscription: { plan: null, tierName: `Team ${EMAIL}`, tierId: null },
  summary: [{ key: 'spend', label: `Spend for ${EMAIL}`, value: 3 }],
  groups: [
    {
      id: 'g',
      label: `Group ${EMAIL}`,
      description: `Owned by ${EMAIL}`,
      buckets: [
        {
          id: 'b',
          label: `Bucket ${EMAIL}`,
          description: `Tooltip ${EMAIL}`,
          remainingFraction: 0.5,
        },
      ],
    },
  ],
};

const storeEntry: PluginStoreEntry = {
  storeId: 'official',
  sourceId: 'official',
  sourceName: 'Official',
  sourceUrl: 'https://plugins.example.com/index.json',
  id: 'reviewer-tools',
  name: EMAIL,
  description: '',
  author: 'Example Labs',
  version: '1.0.0',
  repository: '',
  installType: 'binary',
  authRequired: false,
  authConfigured: false,
  platforms: [],
  logo: '',
  homepage: '',
  license: '',
  tags: [],
  installed: false,
  installedVersion: '',
  path: '',
  configured: false,
  registered: false,
  enabled: false,
  effectiveEnabled: false,
  updateAvailable: false,
};
const renderGate = () =>
  render(
    createElement(PluginInstallGateModal, {
      open: true,
      entry: storeEntry,
      isUpdate: false,
      installing: false,
      onClose: () => {},
      onConfirm: () => {},
    })
  );

describe('plugin-published text in Privacy Mode (rendered output)', () => {
  test('plugin quota card masks plan, summary, group and bucket text', () => {
    setPrivacy(true);
    const masked = renderToStaticMarkup(
      createElement(PluginQuotaBody, { quota, classes, part: 'plan' })
    );
    const details = renderToStaticMarkup(
      createElement(PluginQuotaBody, { quota, classes, part: 'details' })
    );
    expect(masked + details).not.toContain(EMAIL);
    expect(details).toContain('Bucket ');

    setPrivacy(false);
    const raw = renderToStaticMarkup(createElement(PluginQuotaBody, { quota, classes }));
    // plan, summary, group label + description, bucket label + tooltip
    expect(raw.split(EMAIL).length - 1).toBe(6);
  });

  test('plugin store install gate masks the store entry name', () => {
    setPrivacy(true);
    expect(renderGate()).not.toContain(EMAIL);

    setPrivacy(false);
    expect(renderGate()).toContain(EMAIL);
  });
});
