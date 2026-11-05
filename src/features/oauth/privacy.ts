import { credentialFileIdentity, findEmails, privacyFileName, privacyText } from '@/utils/privacy';

/**
 * Display name of a credential file (selected upload or backend-returned auth file). The
 * filename's identity segment is always concealed, together with any known identity
 * (email, project) and email embedded in the name. Display only: callers keep passing the
 * original `File` / name to import and navigation actions.
 */
export const credentialFileDisplayName = (
  enabled: boolean,
  fileName: string | null | undefined,
  identities: Array<string | null | undefined> = []
): string => {
  if (!enabled || !fileName) return fileName ?? '';
  return privacyFileName(true, fileName, [
    ...identities,
    ...findEmails(fileName),
    credentialFileIdentity(fileName),
  ]);
};

/**
 * Display title of a plugin-declared OAuth entry. Entry names are free text published by the
 * plugin and may embed account identities, so they are masked like other free text. Display
 * only: provider ids and the raw title stay untouched for login actions.
 */
export const pluginOAuthDisplayTitle = (enabled: boolean, title: string): string =>
  privacyText(enabled, title);
