import type { AuthFileItem } from '@/types';
import { credentialFileIdentity } from '@/utils/privacy';

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
