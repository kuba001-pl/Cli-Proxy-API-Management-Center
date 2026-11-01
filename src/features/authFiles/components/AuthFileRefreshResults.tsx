import { usePrivacyStore } from '@/stores/usePrivacyStore';
import { authFilePrivacyIdentities } from '../privacy';
import type { AuthFileItem } from '@/types';
import { privacyFileName, privacyText } from '@/utils/privacy';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { AuthFileRefreshResult } from '@/services/api/authFiles';
import styles from './AuthFileRefreshResults.module.scss';

export function AuthFileRefreshResultsContent({
  results,
  files = [],
}: {
  results: AuthFileRefreshResult[];
  files?: AuthFileItem[];
}) {
  const { t } = useTranslation();
  const privacy = usePrivacyStore((state) => state.enabled);
  const identities = files.flatMap(authFilePrivacyIdentities);
  const success = results.filter((result) => result.success).length;
  return (
    <div>
      <p role="status">
        {results.length === 0
          ? t('auth_files.refresh_all_empty')
          : t('auth_files.refresh_all_summary', { success, failed: results.length - success })}
      </p>
      <ul className={styles.results}>
        {results.map((result, index) => (
          <li key={`${result.id}:${index}`} className={styles.result}>
            <strong className={styles.identity}>
              {privacyFileName(privacy, result.id, identities)}
            </strong>
            <span className={result.success ? styles.success : styles.failure}>
              {t(
                result.success
                  ? 'auth_files.refresh_result_success'
                  : 'auth_files.refresh_result_failed'
              )}
            </span>
            {!result.success && result.error && (
              <p className={styles.error}>{privacyText(privacy, result.error, identities)}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AuthFileRefreshResults({
  results,
  files,
  onClose,
}: {
  results: AuthFileRefreshResult[] | null;
  files?: AuthFileItem[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      open={results !== null}
      title={t('auth_files.refresh_all_results')}
      onClose={onClose}
      footer={<Button onClick={onClose}>{t('common.close')}</Button>}
    >
      {results !== null && <AuthFileRefreshResultsContent files={files} results={results} />}
    </Modal>
  );
}
