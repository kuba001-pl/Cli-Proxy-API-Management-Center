import { afterEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NotificationContainer } from '@/components/common/NotificationContainer';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { usePrivacyStore } from '@/stores/usePrivacyStore';
import { PRIVACY_MASK } from '@/utils/privacy';

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
