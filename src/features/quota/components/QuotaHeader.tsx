import { useTranslation } from 'react-i18next';
import { IconRefreshCw } from '@/components/ui/icons';
import { useCountUp } from '@/hooks/motion';
import styles from './QuotaHeader.module.scss';

export type QuotaHeaderProps = {
  totalCount: number;
  loadedCount: number;
  attentionCount: number;
  refreshing: boolean;
  disableControls: boolean;
  onRefreshAll: () => void;
  /** The credential list failed to load: counts are unknown, not zero. */
  countsUnavailable?: boolean;
};

/** Compact page heading with existing counts and the refresh-all action. */
export function QuotaHeader(props: QuotaHeaderProps) {
  const {
    totalCount,
    loadedCount,
    attentionCount,
    refreshing,
    disableControls,
    onRefreshAll,
    countsUnavailable = false,
  } = props;
  const { t } = useTranslation();
  // 批量结果陆续落地时，「已加载」是页面上唯一滚动的数字
  const displayLoadedCount = useCountUp(loadedCount);

  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        <h1 className={styles.title} data-reveal>
          {t('quota_management.title')}
        </h1>
        <p className={styles.meta} data-reveal>
          {countsUnavailable ? (
            <span className={styles.metaMuted}>—</span>
          ) : (
            <>
              <span className={styles.metaTotal}>
                {t('quota_management.meta_credentials', { count: totalCount })}
              </span>
              <span className={styles.metaDot} aria-hidden="true">
                ·
              </span>
              <span className={loadedCount > 0 ? styles.metaLoaded : styles.metaMuted}>
                {t('quota_management.meta_loaded', { count: displayLoadedCount })}
              </span>
              {attentionCount > 0 && (
                <>
                  <span className={styles.metaDot} aria-hidden="true">
                    ·
                  </span>
                  <span className={styles.metaAttention}>
                    {t('quota_management.meta_attention', { count: attentionCount })}
                  </span>
                </>
              )}
            </>
          )}
        </p>
      </div>
      <div className={styles.actions} data-reveal>
        <button
          type="button"
          className={`btn btn-primary ${styles.primaryAction}`}
          onClick={onRefreshAll}
          disabled={disableControls || refreshing}
        >
          <IconRefreshCw size={14} className={refreshing ? styles.spinning : undefined} />
          {t('quota_management.refresh_all_credentials')}
        </button>
      </div>
    </header>
  );
}
