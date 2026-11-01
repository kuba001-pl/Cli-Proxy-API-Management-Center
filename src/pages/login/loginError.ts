import type { ApiError } from '@/types';
import { LegacyBackendError } from '@/services/api/legacyBackendProbe';

/** Inline login failure: a localized summary plus optional backend status/detail row. */
export type LoginErrorMessage = {
  summary: string;
  /** Raw backend evidence, e.g. `401 · invalid management key`; shown muted under the summary. */
  detail?: string;
};

/** Map a login failure to a localized summary and the backend's own status/detail. */
export function getLoginErrorMessage(
  error: unknown,
  t: (key: string) => string
): LoginErrorMessage {
  if (error instanceof LegacyBackendError) return { summary: t('login.error_legacy_backend') };
  const apiError = error as Partial<ApiError>;
  const status = typeof apiError.status === 'number' ? apiError.status : undefined;
  const code = typeof apiError.code === 'string' ? apiError.code : undefined;
  const message =
    error instanceof Error
      ? error.message
      : typeof apiError.message === 'string'
        ? apiError.message
        : typeof error === 'string'
          ? error
          : '';

  const withHttpStatus = (summary: string): LoginErrorMessage => {
    if (!status) return { summary };
    const detail = message.trim();
    const genericAxiosMessage = `Request failed with status code ${status}`;
    const backendDetail = detail && detail !== genericAxiosMessage ? ` · ${detail}` : '';
    return { summary, detail: `${status}${backendDetail}` };
  };

  if (status === 401) return withHttpStatus(t('login.error_unauthorized'));
  if (status === 403) return withHttpStatus(t('login.error_forbidden'));
  if (status === 404) return withHttpStatus(t('login.error_not_found'));
  if (status && status >= 500) return withHttpStatus(t('login.error_server'));

  const lower = message.toLowerCase();
  if (code === 'ECONNABORTED' || lower.includes('timeout')) {
    return { summary: t('login.error_timeout') };
  }
  if (code === 'ERR_NETWORK' || lower.includes('network error')) {
    return { summary: t('login.error_network') };
  }
  if (code === 'ERR_CERT_AUTHORITY_INVALID' || lower.includes('certificate')) {
    return { summary: t('login.error_ssl') };
  }
  if (lower.includes('cors') || lower.includes('cross-origin')) {
    return { summary: t('login.error_cors') };
  }
  return withHttpStatus(t('login.error_invalid'));
}
