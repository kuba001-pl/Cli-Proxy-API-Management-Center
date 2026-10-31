/**
 * Display-only privacy masking for configuration text, plugin metadata and
 * backend messages. Built on the shared helpers in `@/utils/privacy`; never
 * apply these to values that are stored, edited or sent back to the backend.
 */

import { PRIVACY_MASK, privacyText } from '@/utils/privacy';

/** `scheme://user[:pass]@host` → `scheme://••••@host` (the userinfo part only). */
const URL_USERINFO_PATTERN = /([a-z][a-z0-9+.-]*:\/\/)([^\s/?#@'"`<>]+)@/gi;

/** Home-directory segments expose the OS username: `/home/<user>`, `C:\Users\<user>`. */
const HOME_PATH_PATTERN =
  /((?:^|[\s'"`(=:])(?:\/home\/|\/Users\/|[A-Za-z]:\\Users\\))([^\s/\\'"`]+)/g;

/** YAML / JSON keys whose values are personal identifiers. */
const IDENTITY_KEY_PATTERN =
  /^(\s*(?:-\s+)?["']?(?:username|user|user-name|user_name|email|e-mail|account|login)["']?\s*:\s*)(?!\s*[|>]\s*$)(?!\s*#)(\S.*?)(\s+#.*)?$/gim;

export const maskUrlUserinfo = (text: string): string =>
  text.replace(URL_USERINFO_PATTERN, (_match, scheme: string) => `${scheme}${PRIVACY_MASK}@`);

export const maskHomePaths = (text: string): string =>
  text.replace(HOME_PATH_PATTERN, (_match, prefix: string) => `${prefix}${PRIVACY_MASK}`);

const maskIdentityKeys = (text: string): string =>
  text.replace(
    IDENTITY_KEY_PATTERN,
    (_match, prefix: string, _value: string, comment: string | undefined) =>
      `${prefix}${PRIVACY_MASK}${comment ?? ''}`
  );

/** True when a URL-like value carries `user[:pass]@` credentials. */
export const hasUrlUserinfo = (value: string | null | undefined): boolean => {
  URL_USERINFO_PATTERN.lastIndex = 0;
  const result = URL_USERINFO_PATTERN.test(value ?? '');
  URL_USERINFO_PATTERN.lastIndex = 0;
  return result;
};

/** Free text (metadata, messages, URLs): emails, URL credentials and home-dir usernames. */
export const privacyDisplayText = (enabled: boolean, text: string | null | undefined): string => {
  const value = text ?? '';
  if (!enabled) return value;
  return privacyText(true, maskHomePaths(maskUrlUserinfo(value)));
};

/** YAML / config documents: additionally masks identity-keyed values such as `username:`. */
export const privacyConfigText = (enabled: boolean, text: string | null | undefined): string => {
  const value = text ?? '';
  if (!enabled) return value;
  return privacyText(true, maskIdentityKeys(maskHomePaths(maskUrlUserinfo(value))));
};

const noopChange = () => {};

/**
 * Props for the source editor: with privacy mode on, the editor becomes a read-only
 * masked preview. The real document (and pending edits) is never replaced, so turning
 * privacy off restores the editable original.
 */
export function resolveSourceEditorView({
  value,
  onChange,
  editable,
  privacyEnabled,
}: {
  value: string;
  onChange: (value: string) => void;
  editable: boolean;
  privacyEnabled: boolean;
}): { value: string; onChange: (value: string) => void; editable: boolean; masked: boolean } {
  if (!privacyEnabled) return { value, onChange, editable, masked: false };
  return {
    value: privacyConfigText(true, value),
    onChange: noopChange,
    editable: false,
    masked: true,
  };
}
