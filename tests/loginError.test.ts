import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { getLoginErrorMessage } from '@/pages/login/loginError';
import { LegacyBackendError } from '@/services/api/legacyBackendProbe';

const t = (key: string) => `t:${key}`;

describe('login error mapping', () => {
  test('separates the localized summary from the backend status and detail', () => {
    expect(getLoginErrorMessage({ status: 401, message: 'invalid management key' }, t)).toEqual({
      summary: 't:login.error_unauthorized',
      detail: '401 · invalid management key',
    });
  });

  test('drops the generic axios message but keeps the status', () => {
    expect(
      getLoginErrorMessage({ status: 503, message: 'Request failed with status code 503' }, t)
    ).toEqual({ summary: 't:login.error_server', detail: '503' });
  });

  test('network and legacy failures have no backend detail', () => {
    expect(getLoginErrorMessage({ code: 'ERR_NETWORK', message: 'Network Error' }, t)).toEqual({
      summary: 't:login.error_network',
    });
    expect(getLoginErrorMessage(new LegacyBackendError(), t)).toEqual({
      summary: 't:login.error_legacy_backend',
    });
  });

  test('reports a failed login once, inline, without a duplicate notification', () => {
    const source = readFileSync('src/pages/LoginPage.tsx', 'utf8');
    expect(source).not.toContain('showNotification');
    expect(source).toContain('errorDetail={error?.detail}');
  });
});
