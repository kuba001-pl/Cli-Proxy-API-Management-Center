import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconRefreshCw, IconUpload } from '@/components/ui/icons';
import { useRevealGroup } from '@/hooks/motion';
import styles from './VaultHeader.module.scss';

export type VaultHeaderProps = {
  /** No longer rendered; optional for upstream call-site compatibility. */
  totalCount?: number;
  /** No longer rendered; optional for upstream call-site compatibility. */
  activeCount?: number;
  problemCount: number;
  loading: boolean;
  refreshing: boolean;
  uploading: boolean;
  disableControls: boolean;
  onUpload: () => void;
  onRefresh: () => void;
  refreshingCredentials?: boolean;
  credentialRefreshDisabled?: boolean;
  onRefreshCredentials?: () => void;
};

/**
 * Vault header: title, one meaningful caption (credentials needing attention, only when
 * there are any) and actions. Totals already live in the provider tabs and sidebar badge.
 */
export function VaultHeader(props: VaultHeaderProps) {
  const {
    problemCount,
    loading,
    refreshing,
    uploading,
    disableControls,
    onUpload,
    onRefresh,
    refreshingCredentials = false,
    credentialRefreshDisabled = false,
    onRefreshCredentials,
  } = props;
  const { t } = useTranslation();
  const revealRef = useRevealGroup<HTMLElement>();

  return (
    <header className={styles.header} ref={revealRef}>
      <div className={styles.copy}>
        <h1 className={styles.title} data-reveal>
          {t('auth_files.title')}
        </h1>
        {problemCount > 0 && (
          <p className={styles.meta} data-reveal>
            <span className={styles.metaProblem}>
              {t('auth_files.meta_problem', { count: problemCount })}
            </span>
          </p>
        )}
      </div>
      <div className={styles.actions} data-reveal>
        {onRefreshCredentials && (
          <Button
            variant="ghost"
            size="sm"
            loading={refreshingCredentials}
            onClick={onRefreshCredentials}
            disabled={
              disableControls || loading || refreshingCredentials || credentialRefreshDisabled
            }
          >
            {!refreshingCredentials && <IconRefreshCw size={14} />}
            {t('auth_files.refresh_all_button')}
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          className={styles.refreshButton}
          onClick={onRefresh}
          disabled={loading || refreshing}
          title={t('auth_files.reload_list')}
          aria-label={t('auth_files.reload_list')}
        >
          <IconRefreshCw size={14} className={refreshing ? styles.spinning : undefined} />
        </Button>
        <Button
          size="sm"
          loading={uploading}
          onClick={onUpload}
          disabled={disableControls || uploading}
        >
          {!uploading && <IconUpload size={15} />}
          {t('auth_files.upload_button')}
        </Button>
      </div>
    </header>
  );
}
