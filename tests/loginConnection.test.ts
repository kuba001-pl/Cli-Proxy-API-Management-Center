import { describe, expect, test } from 'bun:test';
import { isCustomConnection, resolveLoginApiBase } from '@/pages/login/loginConnection';

const detectedBase = 'http://localhost:8317';

describe('login custom connection state', () => {
  test('starts on only when the saved URL differs from the detected one', () => {
    expect(isCustomConnection('https://proxy.example.com', detectedBase)).toBe(true);
    expect(isCustomConnection('http://localhost:8317/', detectedBase)).toBe(false);
    expect(isCustomConnection('localhost:8317/v8/management', detectedBase)).toBe(false);
    expect(isCustomConnection('', detectedBase)).toBe(false);
    expect(isCustomConnection(undefined, detectedBase)).toBe(false);
    expect(isCustomConnection(null, detectedBase)).toBe(false);
  });
});

describe('login submission URL', () => {
  test('switch off always uses the detected URL, even with a custom URL typed', () => {
    expect(
      resolveLoginApiBase({
        customEnabled: false,
        apiBase: 'https://proxy.example.com',
        detectedBase,
      })
    ).toBe(detectedBase);
  });

  test('switch on uses the normalized custom URL', () => {
    expect(
      resolveLoginApiBase({
        customEnabled: true,
        apiBase: ' proxy.example.com/v8/management/ ',
        detectedBase,
      })
    ).toBe('http://proxy.example.com');
  });

  test('switch on with an empty custom URL falls back to the detected URL', () => {
    expect(resolveLoginApiBase({ customEnabled: true, apiBase: '   ', detectedBase })).toBe(
      detectedBase
    );
  });

  test('the login page submits through the switch-aware resolver', async () => {
    const page = await Bun.file('src/pages/LoginPage.tsx').text();
    expect(page).toContain(
      'resolveLoginApiBase({ customEnabled: customBase, apiBase, detectedBase })'
    );
    expect(page).toContain('isCustomConnection(useAuthStore.getState().apiBase, detectedBase)');
    expect(page).toContain('editingBase={customBase}');
  });
});
