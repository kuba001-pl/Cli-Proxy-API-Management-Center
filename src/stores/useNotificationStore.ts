/**
 * 通知状态管理
 * 替代原项目中的 showNotification 方法
 */

import { create } from 'zustand';
import type { ReactNode } from 'react';
import type { Notification, NotificationType } from '@/types';
import { generateId } from '@/utils/helpers';
import { NOTIFICATION_DURATION_MS } from '@/utils/constants';

/**
 * Redaction context for privacy mode. Messages are stored raw; the renderers mask them with
 * the privacy state current at render time, so toggling privacy updates visible toasts.
 */
export interface NotificationPrivacyContext {
  /** Known identities (emails, account labels, credential-file identity parts) to dot out. */
  identities?: string[];
}

export interface StoredNotification extends Notification {
  identities?: string[];
}

interface ConfirmationOptions extends NotificationPrivacyContext {
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'secondary';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface NotificationState {
  notifications: StoredNotification[];
  confirmation: {
    isOpen: boolean;
    isLoading: boolean;
    options: ConfirmationOptions | null;
  };
  showNotification: (
    message: string,
    type?: NotificationType,
    duration?: number,
    privacy?: NotificationPrivacyContext
  ) => void;
  removeNotification: (id: string) => void;
  showConfirmation: (options: ConfirmationOptions) => void;
  hideConfirmation: () => void;
  setConfirmationLoading: (loading: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  confirmation: {
    isOpen: false,
    isLoading: false,
    options: null,
  },

  showNotification: (message, type = 'info', duration = NOTIFICATION_DURATION_MS, privacy) => {
    const id = generateId();
    const notification: StoredNotification = {
      id,
      message,
      type,
      duration,
      ...(privacy?.identities?.length ? { identities: [...privacy.identities] } : {}),
    };

    set((state) => ({
      notifications: [...state.notifications, notification],
    }));

    // NotificationContainer owns readable-time expiry and cleans up timers on unmount.
    // Keeping timers out of the store allows hover/focus/hidden-tab pauses.
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  showConfirmation: (options) => {
    set({
      confirmation: {
        isOpen: true,
        isLoading: false,
        options,
      },
    });
  },

  hideConfirmation: () => {
    set((state) => ({
      confirmation: {
        ...state.confirmation,
        isOpen: false,
        options: null, // Cleanup
      },
    }));
  },

  setConfirmationLoading: (loading) => {
    set((state) => ({
      confirmation: {
        ...state.confirmation,
        isLoading: loading,
      },
    }));
  },
}));
