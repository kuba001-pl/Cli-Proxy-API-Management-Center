import { describe, expect, test } from 'bun:test';
import {
  getQuotaCacheKey,
  getQuotaDisplayName,
  getQuotaPrivacyDisplayName,
} from '@/utils/quota/identity';
import { PRIVACY_MASK } from '@/utils/privacy';
import { filterEntriesBySearch } from '@/features/quota/logic';
import type { AuthFileItem } from '@/types';

const file: AuthFileItem = {
  name: 'claude-hash-person@example.test.json',
  type: 'claude',
  email: 'person@example.test',
};

describe('quota privacy display identity', () => {
  test('keeps the original label when privacy is disabled', () => {
    expect(getQuotaPrivacyDisplayName(file, false)).toBe(getQuotaDisplayName(file));
  });

  test('masks email and sanitized email filenames without losing the provider or extension', () => {
    expect(getQuotaPrivacyDisplayName(file, true)).toBe(`claude-hash-${PRIVACY_MASK}.json`);
    expect(
      getQuotaPrivacyDisplayName({ ...file, name: 'claude-person_example_test.json' }, true)
    ).toBe(`claude-${PRIVACY_MASK}.json`);
  });

  test('masks Devin email and auth-index display suffixes completely', () => {
    const devin = { ...file, name: 'devin-shared.json', type: 'devin', authIndex: 'identity-123' };
    expect(getQuotaPrivacyDisplayName(devin, true)).toBe(`devin-shared.json · ${PRIVACY_MASK}`);
    expect(getQuotaPrivacyDisplayName({ ...devin, email: undefined }, true)).toBe(
      `devin-shared.json · ${PRIVACY_MASK}`
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
      `Label: claude-hash-${PRIVACY_MASK}.json`
    );
  });

  test('never reads the credential-bearing account field into a label', () => {
    const credential = { name: 'credential.json', type: 'devin', account: 'secret-api-key' };
    expect(getQuotaPrivacyDisplayName(credential, true)).toBe('credential.json');
    expect(getQuotaPrivacyDisplayName(credential, false)).toBe('credential.json');
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
