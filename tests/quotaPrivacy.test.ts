import { describe, expect, test } from 'bun:test';
import {
  getQuotaCacheKey,
  getQuotaDisplayName,
  getQuotaPrivacyDisplayName,
} from '@/utils/quota/identity';
import { PRIVACY_MASK } from '@/utils/privacy';
import { filterEntriesBySearch } from '@/features/quota/logic';
import { quotaNotificationPrivacy } from '@/features/quota/privacy';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { NotificationContainer } from '@/components/common/NotificationContainer';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { usePrivacyStore } from '@/stores/usePrivacyStore';
import type { AuthFileItem } from '@/types';

const file: AuthFileItem = {
  name: 'claude-a1b2c3d4-person@example.test.json',
  type: 'claude',
  email: 'person@example.test',
};

describe('quota privacy display identity', () => {
  test('keeps the original label when privacy is disabled', () => {
    expect(getQuotaPrivacyDisplayName(file, false)).toBe(getQuotaDisplayName(file));
  });

  test('masks email and sanitized email filenames without losing the provider or extension', () => {
    expect(getQuotaPrivacyDisplayName(file, true)).toBe(`claude-a1b2c3d4-${PRIVACY_MASK}.json`);
    expect(
      getQuotaPrivacyDisplayName({ ...file, name: 'claude-person_example_test.json' }, true)
    ).toBe(`claude-${PRIVACY_MASK}.json`);
  });

  test('masks Devin email and auth-index display suffixes completely', () => {
    const devin = { ...file, name: 'devin-shared.json', type: 'devin', authIndex: 'identity-123' };
    // The filename carries no metadata identity, so its own stem is the redaction target
    // (same projection as Auth Files).
    expect(getQuotaPrivacyDisplayName(devin, true)).toBe(
      `devin-${PRIVACY_MASK}.json · ${PRIVACY_MASK}`
    );
    expect(getQuotaPrivacyDisplayName({ ...devin, email: undefined }, true)).toBe(
      `devin-${PRIVACY_MASK}.json · ${PRIVACY_MASK}`
    );
    expect(getQuotaPrivacyDisplayName(devin, false)).toBe(
      'devin-shared.json · person@example.test'
    );
  });

  test('uses the same identity handling for backend plugin quota entries', () => {
    const plugin = { ...file, type: 'custom', supportsQuota: true, authIndex: 17 };
    const label = getQuotaPrivacyDisplayName(plugin, true);
    expect(label).not.toContain(file.email!);
    expect(label).not.toContain('17');
    expect(label).toContain(PRIVACY_MASK);
  });

  test('applies host filename labels before masking', () => {
    expect(getQuotaPrivacyDisplayName(file, true, (name) => `Label: ${name}`)).toBe(
      `Label: claude-a1b2c3d4-${PRIVACY_MASK}.json`
    );
  });

  test('never reads the credential-bearing account field into a label', () => {
    const credential = { name: 'credential.json', type: 'devin', account: 'secret-api-key' };
    const masked = getQuotaPrivacyDisplayName(credential, true);
    expect(masked).not.toContain('secret-api-key');
    expect(masked).toBe(`${PRIVACY_MASK}.json`);
    expect(getQuotaPrivacyDisplayName(credential, false)).toBe('credential.json');
  });

  test('masks filename-only credentials without metadata (C02)', () => {
    const codex = { name: 'codex-dbffca66-alice-plus.json', type: 'codex' };
    expect(getQuotaPrivacyDisplayName(codex, true)).toBe(
      `codex-dbffca66-${PRIVACY_MASK}-plus.json`
    );
    expect(getQuotaPrivacyDisplayName(codex, false)).toBe('codex-dbffca66-alice-plus.json');
    // Metadata that does not appear in the name still falls back to the filename identity.
    const uploaded = { name: 'claude-bob.json', type: 'claude', email: 'other@example.test' };
    expect(getQuotaPrivacyDisplayName(uploaded, true)).toBe(`claude-${PRIVACY_MASK}.json`);
  });

  test('masks the whole filename identity when metadata covers only part of it (C02)', () => {
    const codex = { name: 'codex-alice-bob.json', type: 'codex', account: 'alice' };
    const label = getQuotaPrivacyDisplayName(codex, true);
    expect(label).toBe(`codex-${PRIVACY_MASK}.json`);
    expect(label).not.toContain('bob');
    expect(label).not.toContain('alice');
    expect(getQuotaPrivacyDisplayName(codex, false)).toBe('codex-alice-bob.json');
  });

  test('uses account only as a redaction target in labels and tooltips', () => {
    const qwen = { name: 'qwen-alice.json', type: 'qwen', account: 'alice' };
    expect(getQuotaPrivacyDisplayName(qwen, true)).toBe(`qwen-${PRIVACY_MASK}.json`);
    expect(getQuotaPrivacyDisplayName(qwen, false)).toBe('qwen-alice.json');
    const devin = { name: 'devin-alice.json', type: 'devin', account: 'alice', authIndex: 3 };
    const label = getQuotaPrivacyDisplayName(devin, true);
    expect(label).not.toContain('alice');
    expect(label).toBe(`devin-${PRIVACY_MASK}.json · ${PRIVACY_MASK}`);
  });

  test('leaves cache identity, source files and search on real values', () => {
    const original = { ...file, type: 'devin', authIndex: 12 };
    const cacheKey = getQuotaCacheKey(original);
    getQuotaPrivacyDisplayName(original, true);
    expect(getQuotaCacheKey(original)).toBe(cacheKey);
    expect(original.email).toBe('person@example.test');
    expect(original.name).toBe(file.name);
    expect(
      filterEntriesBySearch([{ file: original, type: 'devin' }], 'person@example.test')
    ).toHaveLength(1);
  });
});

describe('quota notifications keep raw text plus redaction context (C11)', () => {
  const initialPrivacy = usePrivacyStore.getInitialState().enabled;
  const initialNotifications = useNotificationStore.getInitialState().notifications;

  test('a quota toast queued with privacy off is masked after privacy is switched on', () => {
    const file = { name: 'codex-dbffca66-alice-plus.json', type: 'codex', account: 'alice' };
    const message = `Failed to refresh ${getQuotaPrivacyDisplayName(file, false)}: alice denied`;
    const { identities } = quotaNotificationPrivacy(file);
    try {
      useNotificationStore.getInitialState().notifications = [
        { id: 'q1', type: 'error', message, identities },
      ];
      usePrivacyStore.getInitialState().enabled = true;
      const masked = renderToStaticMarkup(createElement(NotificationContainer));
      expect(masked).toContain(`codex-dbffca66-${PRIVACY_MASK}-plus.json`);
      expect(masked).not.toContain('alice');
      usePrivacyStore.getInitialState().enabled = false;
      expect(renderToStaticMarkup(createElement(NotificationContainer))).toContain(message);
    } finally {
      usePrivacyStore.getInitialState().enabled = initialPrivacy;
      useNotificationStore.getInitialState().notifications = initialNotifications;
    }
  });

  test('quota producers never pre-mask at enqueue time', () => {
    for (const path of [
      'src/features/quota/hooks/useQuotaActions.ts',
      'src/features/quota/providers/claude/ClaudeResetGrants.tsx',
    ]) {
      const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
      expect(source).not.toContain('usePrivacyStore.getState().enabled');
      expect(source).not.toContain('privacyText(');
      expect(source).toContain('quotaNotificationPrivacy(file)');
    }
  });
});
