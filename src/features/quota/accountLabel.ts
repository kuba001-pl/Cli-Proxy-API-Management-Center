import type { AuthFileItem } from '@/types';
import { privacyIdentity } from '@/utils/privacy';
import { getQuotaPrivacyDisplayName } from '@/utils/quota/identity';
import { isDevinFile, isPluginQuotaFile } from '@/utils/quota/validators';

export interface QuotaAccountLabel {
  /** What a person recognises first: the account email, else the display filename. */
  primary: string;
  /** The filename, when the primary line is the email; null when it would repeat. */
  secondary: string | null;
}

/**
 * Identity-first label for quota rows. Devin and plugin labels already combine the
 * filename and identity, so they keep the shared display name unchanged.
 */
export function quotaAccountLabel(file: AuthFileItem, privacyEnabled: boolean): QuotaAccountLabel {
  const name = getQuotaPrivacyDisplayName(file, privacyEnabled);
  if (isDevinFile(file) || isPluginQuotaFile(file)) return { primary: name, secondary: null };
  const email = typeof file.email === 'string' ? file.email.trim() : '';
  if (!email) return { primary: name, secondary: null };
  return { primary: privacyIdentity(privacyEnabled, email), secondary: name };
}
