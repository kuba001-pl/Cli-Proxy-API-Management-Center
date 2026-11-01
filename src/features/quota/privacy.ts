import type { AuthFileItem } from '@/types';
import { credentialFileIdentity } from '@/utils/privacy';
import { normalizeRecentRequestAuthIndex } from '@/utils/recentRequests';
import { isDevinFile, isPluginQuotaFile } from '@/utils/quota/validators';

/**
 * Redaction targets for Quota page free text (e.g. a failed credential-list read). Uses the
 * last known credentials: emails, account labels, project IDs and filename identity portions.
 * Generic email/URL-userinfo/home-dir masking in `privacyText` covers anything unknown.
 */
export function quotaListErrorIdentities(files: readonly AuthFileItem[]): string[] {
  return files.flatMap((file) =>
    [file.email, file.account, file.projectId, credentialFileIdentity(file.name)].filter(
      (value): value is string => typeof value === 'string' && Boolean(value.trim())
    )
  );
}

/**
 * Notification/confirmation context for one credential. Callers store the raw label/message;
 * the toast and confirmation renderers mask them with these targets at display time, so a
 * toast enqueued with privacy off is still redacted after privacy is switched on.
 */
export function quotaNotificationPrivacy(file: AuthFileItem): { identities: string[] } {
  const identities = quotaListErrorIdentities([file]);
  // Devin/plugin labels append the auth index, which privacy-mode labels also dot out.
  const authIndex =
    isDevinFile(file) || isPluginQuotaFile(file)
      ? normalizeRecentRequestAuthIndex(file.authIndex)
      : null;
  return { identities: authIndex ? [...identities, String(authIndex)] : identities };
}
