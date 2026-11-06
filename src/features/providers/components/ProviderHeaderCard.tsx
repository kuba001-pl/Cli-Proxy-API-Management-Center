import { Button } from '@/components/ui/Button';
import { useTranslation } from 'react-i18next';
import { IconLoader2, IconPlus, IconRefreshCw } from '@/components/ui/icons';
import styles from './ProviderHeaderCard.module.scss';

interface ProviderHeaderCardProps {
  title?: string;
  totalActive: number;
  totalResources: number;
  providerFamilies: number;
  updatedAtLabel: string;
  isFetching?: boolean;
  isNewDisabled?: boolean;
  showNewAction?: boolean;
  showSummary?: boolean;
  newLabel?: string;
  onRefresh: () => void;
  onNew: () => void;
}

export function ProviderHeaderCard({
  title,
  totalActive,
  totalResources,
  isFetching = false,
  isNewDisabled = false,
  showNewAction = true,
  showSummary = true,
  newLabel,
  onRefresh,
  onNew,
}: ProviderHeaderCardProps) {
  const { t } = useTranslation();
  const cardClassName = styles.card;

  return (
    <section className={cardClassName}>
      <div className={styles.row}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>{title ?? t('providersPage.header.title')}</h1>
          {showSummary ? (
            // One fact, not a " · " chain: family count and fetch time were noise.
            <p className={styles.chips}>
              {t('providersPage.header.activeResources', {
                active: totalActive,
                total: totalResources,
              })}
            </p>
          ) : null}
        </div>
        <div className={styles.actions}>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={onRefresh}
            disabled={isFetching}
            aria-label={
              isFetching ? t('providersPage.actions.syncing') : t('providersPage.actions.refresh')
            }
          >
            <span className={`${styles.btnIcon} ${isFetching ? styles.spin : ''}`.trim()}>
              {isFetching ? <IconLoader2 size={16} /> : <IconRefreshCw size={16} />}
            </span>
            <span>
              {isFetching ? t('providersPage.actions.syncing') : t('providersPage.actions.refresh')}
            </span>
          </Button>
          {showNewAction ? (
            <Button
              size="sm"
              variant="primary"
              type="button"
              onClick={onNew}
              disabled={isNewDisabled}
            >
              <IconPlus size={16} />
              <span>{newLabel ?? t('providersPage.actions.new')}</span>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
