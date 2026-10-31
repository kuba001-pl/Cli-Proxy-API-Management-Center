/**
 * Privacy mode: hides personal / sensitive identifiers (emails, usernames,
 * credential file names) across the whole UI. Persisted locally only.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const STORAGE_KEY_PRIVACY = 'cli-proxy-privacy-mode';

interface PrivacyState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
}

export const usePrivacyStore = create<PrivacyState>()(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (enabled) => set({ enabled }),
      toggle: () => set((state) => ({ enabled: !state.enabled })),
    }),
    {
      name: STORAGE_KEY_PRIVACY,
      partialize: (state) => ({ enabled: state.enabled }),
    }
  )
);
