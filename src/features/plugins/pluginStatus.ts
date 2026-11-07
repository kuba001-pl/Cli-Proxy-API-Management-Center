import type { PluginListEntry } from '@/types/plugin';

export type PluginStateTone = 'active' | 'off' | 'warning';

export type PluginDisplayState = {
  /** i18n key for the one-word state shown beside the plugin name. */
  labelKey: string;
  /** i18n key for the visible explanation when an enabled plugin is not running. */
  hintKey?: string;
  tone: PluginStateTone;
};

type PluginStateInput = Pick<PluginListEntry, 'enabled' | 'registered' | 'effectiveEnabled'>;

/**
 * One human-readable state per plugin row, derived from the backend's existing flags:
 * running → Active; switched off → Disabled; otherwise explain why an enabled plugin is not
 * running (system off, not loaded by the runtime, or not yet effective).
 */
export function resolvePluginDisplayState(
  plugin: PluginStateInput,
  pluginSystemEnabled: boolean
): PluginDisplayState {
  if (plugin.effectiveEnabled) {
    return { labelKey: 'plugin_management.status_active', tone: 'active' };
  }
  if (!plugin.enabled) {
    return { labelKey: 'plugin_management.status_disabled', tone: 'off' };
  }
  if (!pluginSystemEnabled) {
    return {
      labelKey: 'plugin_management.status_paused',
      hintKey: 'plugin_management.status_paused_hint',
      tone: 'warning',
    };
  }
  if (!plugin.registered) {
    return {
      labelKey: 'plugin_management.status_not_loaded',
      hintKey: 'plugin_management.status_not_loaded_hint',
      tone: 'warning',
    };
  }
  return {
    labelKey: 'plugin_management.status_inactive',
    hintKey: 'plugin_management.status_inactive_hint',
    tone: 'warning',
  };
}
