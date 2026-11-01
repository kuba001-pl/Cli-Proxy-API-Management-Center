import { afterEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NotificationContainer } from '@/components/common/NotificationContainer';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { usePrivacyStore } from '@/stores/usePrivacyStore';
import { PRIVACY_MASK, credentialFileIdentitiesInText } from '@/utils/privacy';

// React server rendering reads Zustand's initial snapshots rather than live state.
const initialPrivacy = usePrivacyStore.getInitialState().enabled;
const initialNotifications = useNotificationStore.getInitialState().notifications;
afterEach(() => {
  usePrivacyStore.getInitialState().enabled = initialPrivacy;
  useNotificationStore.getInitialState().notifications = initialNotifications;
});

const renderWith = (enabled: boolean) => {
  usePrivacyStore.getInitialState().enabled = enabled;
  useNotificationStore.getInitialState().notifications = [
    { id: 'n1', type: 'error', message: 'Refresh failed for josé@example.com' },
  ];
  return renderToStaticMarkup(createElement(NotificationContainer));
};

describe('notification privacy', () => {
  test('masks toast text at render time and keeps the stored raw message', () => {
    const masked = renderWith(true);
    expect(masked).toContain(`Refresh failed for ${PRIVACY_MASK}`);
    expect(masked).not.toContain('example.com');
    expect(useNotificationStore.getInitialState().notifications[0].message).toBe(
      'Refresh failed for josé@example.com'
    );
    expect(renderWith(false)).toContain('Refresh failed for josé@example.com');
  });
});

describe('notification privacy: render-time redaction context (C11)', () => {
  const rawMessage = 'Failed to refresh codex-dbffca66-alice-plus.json in /home/alice/auths';

  const renderMessage = (enabled: boolean) => {
    usePrivacyStore.getInitialState().enabled = enabled;
    useNotificationStore.getInitialState().notifications = [
      {
        id: 'n2',
        type: 'error',
        message: rawMessage,
        identities: credentialFileIdentitiesInText(rawMessage),
      },
    ];
    return renderToStaticMarkup(createElement(NotificationContainer));
  };

  test('a toast queued with privacy off is masked once privacy is on, and vice versa', () => {
    const masked = renderMessage(true);
    expect(masked).toContain(`codex-dbffca66-${PRIVACY_MASK}-plus.json`);
    expect(masked).toContain(`/home/${PRIVACY_MASK}/auths`);
    expect(masked).not.toContain('alice');
    expect(renderMessage(false)).toContain(rawMessage);
  });

  test('showNotification stores the raw message with its redaction context', () => {
    const store = useNotificationStore.getState();
    store.showNotification(rawMessage, 'error', 1000, {
      identities: credentialFileIdentitiesInText(rawMessage),
    });
    const stored = useNotificationStore.getState().notifications.at(-1);
    expect(stored?.message).toBe(rawMessage);
    expect(stored?.identities).toEqual(['alice']);
    if (stored) store.removeNotification(stored.id);
  });

  test('credential file names are found in linear time without false matches', () => {
    expect(credentialFileIdentitiesInText('Uploaded "gemini-bob.json", skipped x.jsonl')).toEqual([
      'bob',
    ]);
    const startedAt = performance.now();
    credentialFileIdentitiesInText('a'.repeat(200_000) + '.json'.repeat(50_000));
    expect(performance.now() - startedAt).toBeLessThan(1000);
  });
});
