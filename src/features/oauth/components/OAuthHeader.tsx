import { useTranslation } from 'react-i18next';
import styles from './OAuthHeader.module.scss';

export interface OAuthHeaderProps {
  providerCount: number;
  waitingCount: number;
  addedCount: number;
}

/**
 * Title plus, only while something is happening, one live fact: sign-ins waiting for
 * authorization and credentials added this session. The provider count was noise.
 * `providerCount` stays in the props for upstream compatibility.
 */
export function OAuthHeader({ waitingCount, addedCount }: OAuthHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className={styles.header}>
      <h1 className={styles.title} data-reveal>
        {t('nav.oauth', { defaultValue: 'OAuth' })}
      </h1>
      {(waitingCount > 0 || addedCount > 0) && (
        <p className={styles.meta} data-reveal>
          {waitingCount > 0 && (
            <span className={styles.metaWaiting}>
              <span className={styles.pulse} aria-hidden="true" />
              {t('auth_login.meta_waiting', { count: waitingCount })}
            </span>
          )}
          {waitingCount > 0 && addedCount > 0 && (
            <span className={styles.metaDot} aria-hidden="true">
              ·
            </span>
          )}
          {addedCount > 0 && (
            <span className={styles.metaAdded}>
              {t('auth_login.meta_added', { count: addedCount })}
            </span>
          )}
        </p>
      )}
    </header>
  );
}
