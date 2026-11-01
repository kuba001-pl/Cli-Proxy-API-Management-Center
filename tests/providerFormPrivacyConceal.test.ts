import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { BaseProviderForm } from '@/features/providers/sheets/forms/BaseProviderForm';
import { ApiKeyEntriesEditor } from '@/features/providers/sheets/forms/ApiKeyEntriesEditor';
import { concealInputProps } from '@/features/providers/sheets/forms/privacyConceal';
import type { ProviderResource } from '@/features/providers/types';
import { usePrivacyStore } from '@/stores/usePrivacyStore';
import en from '@/i18n/locales/en.json';

const i18n = createInstance();
await i18n.init({ lng: 'en', resources: { en: { translation: en } } });
const render = (element: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(I18nextProvider, { i18n }, element));

// React server rendering reads Zustand's initial snapshot rather than live browser state.
const initialPrivacy = usePrivacyStore.getInitialState().enabled;
const setPrivacy = (enabled: boolean) => {
  usePrivacyStore.getInitialState().enabled = enabled;
};
afterEach(() => setPrivacy(initialPrivacy));

const PROXY = 'socks5://alice:pw@127.0.0.1:1080';
const BASE_URL = 'https://alice:pw@gateway.example.test/v1';
const PREFIX = 'alice-team';

const resource: ProviderResource = {
  id: 'gemini-0',
  brand: 'gemini',
  originalIndex: 0,
  name: null,
  identifier: null,
  apiKeyPreview: 'AIza••••1234',
  apiKey: null,
  authIndex: null,
  baseUrl: BASE_URL,
  proxyUrl: PROXY,
  prefix: PREFIX,
  modelCount: 0,
  models: [],
  priority: 0,
  headerCount: 1,
  excludedModelCount: 0,
  apiKeyEntryCount: 0,
  disabled: false,
  flags: {},
  selector: { brand: 'gemini', index: 0 },
  raw: { apiKey: 'AIza-fixture', baseUrl: BASE_URL, proxyUrl: PROXY, prefix: PREFIX },
} as unknown as ProviderResource;

/** The `<input …>` tag whose value attribute is exactly `value`. */
const inputWithValue = (html: string, value: string): string => {
  const escaped = value.replace(/&/g, '&amp;');
  const tag = html.match(
    new RegExp(`<input[^>]*value="${escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`)
  );
  expect(tag).not.toBeNull();
  return tag![0];
};

describe('provider edit forms conceal personal values in privacy mode (C05)', () => {
  const renderForm = () =>
    render(
      createElement(BaseProviderForm, {
        brand: 'gemini',
        resource,
        mode: 'edit',
        mutating: false,
        formId: 'provider-conceal',
        onSubmit: async () => {},
      })
    );

  test('base URL, proxy URL and prefix render as password inputs with real values', () => {
    setPrivacy(true);
    const html = renderForm();
    for (const value of [PROXY, BASE_URL, PREFIX]) {
      const tag = inputWithValue(html, value);
      expect(tag).toContain('type="password"');
      expect(tag).toContain('autoComplete="off"');
      expect(tag).toContain('data-privacy-concealed="true"');
    }
  });

  test('the same fields are ordinary text inputs when privacy is off', () => {
    setPrivacy(false);
    const html = renderForm();
    for (const value of [PROXY, BASE_URL, PREFIX]) {
      const tag = inputWithValue(html, value);
      expect(tag).toContain('type="text"');
      expect(tag).not.toContain('data-privacy-concealed');
    }
  });

  test('per-key proxy inputs and the proxy badge tooltip are concealed', () => {
    setPrivacy(true);
    const html = render(
      createElement(ApiKeyEntriesEditor, {
        entries: [{ apiKey: '', proxyUrl: PROXY }],
        removeDisabled: true,
        mutating: false,
        statuses: [],
        isTestingAny: false,
        onUpdate: () => {},
        onAdd: () => 0,
        onRemove: () => {},
        onTest: () => {},
        onTestAll: () => {},
      })
    );
    expect(inputWithValue(html, PROXY)).toContain('type="password"');
    expect(html).not.toMatch(/title="[^"]*alice/);
  });

  test('header values and sponsor proxy/prefix inputs use the shared conceal props', () => {
    expect(concealInputProps(true).type).toBe('password');
    expect(concealInputProps(false)).toEqual({ type: 'text' });
    const base = readFileSync(
      new URL('../src/features/providers/sheets/forms/BaseProviderForm.tsx', import.meta.url),
      'utf8'
    );
    const headerValue = base.slice(base.indexOf('placeholder="value"') - 200);
    expect(headerValue.slice(0, 220)).toContain('{...concealInputProps(privacyEnabled)}');
    const sponsor = readFileSync(
      new URL('../src/features/providers/sheets/forms/SponsorProviderForm.tsx', import.meta.url),
      'utf8'
    );
    for (const id of [
      'id={`${formId}-group-${index}-proxy`}',
      'id={`${formId}-group-${index}-prefix`}',
    ]) {
      const at = sponsor.indexOf(id);
      expect(at).toBeGreaterThan(-1);
      expect(sponsor.slice(at, at + 120)).toContain('{...concealInputProps(privacyEnabled)}');
    }
  });
});
