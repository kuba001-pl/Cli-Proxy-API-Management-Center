import { useTranslation } from 'react-i18next';
import { IconRefreshCw } from '@/components/ui/icons';
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

/** Compact page heading with an attention caption (when needed) and the refresh-all action. */
export function QuotaHeader(props: QuotaHeaderProps) {
  const {
    loadedCount,
    attentionCount,
    refreshing,
    disableControls,
    onRefreshAll,
    countsUnavailable = false,
  } = props;
  const { t } = useTranslation();

  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        <h1 className={styles.title} data-reveal>
          {t('quota_management.title')}
        </h1>
        {/* One meaningful fact at most: only credentials that need attention earn a caption. */}
        {!countsUnavailable && attentionCount > 0 && (
          <p className={styles.meta} data-reveal>
            <span className={styles.metaAttention}>
              {t('quota_management.meta_attention', { count: attentionCount })}
            </span>
          </p>
        )}
      </div>
      <div className={styles.actions} data-reveal>
        <button
          type="button"
          className={`btn btn-primary ${styles.primaryAction}`}
          onClick={onRefreshAll}
          disabled={disableControls || refreshing}
        >
          <IconRefreshCw size={14} className={refreshing ? styles.spinning : undefined} />
          {/* Before anything has been read this loads; afterwards it re-reads every quota. */}
          {loadedCount === 0 && attentionCount === 0
            ? t('quota_management.load_all')
            : t('quota_management.refresh_all_credentials')}
        </button>
      </div>
    </header>
  );
}
