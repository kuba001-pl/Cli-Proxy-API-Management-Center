import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { IconCheck } from '@/components/ui/icons';
import { useActionBarHeightVar } from '@/hooks/useActionBarHeightVar';
import styles from './FloatingSaveBar.module.scss';

export type FloatingSaveBarProps = {
  visible: boolean;
  unsavedCount: number;
  statusText?: string;
  saving: boolean;
  saveDisabled: boolean;
  discardDisabled: boolean;
  onSave: () => void;
  onDiscard: () => void;
};

/** Shares the document's dirty guard and existing save/discard handlers in either editor mode. */
export function FloatingSaveBar({
  visible,
  unsavedCount,
  statusText,
  saving,
  saveDisabled,
  discardDisabled,
  onSave,
  onDiscard,
}: FloatingSaveBarProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  useActionBarHeightVar(containerRef, '--config-action-bar-height', visible);

  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.container} ref={containerRef}>
      <div className={styles.bar} role="group" aria-label={t('config_management.status_dirty')}>
        <span className={styles.status} role="status" title={statusText}>
          <span className={styles.warningDot} aria-hidden="true" />
          {t('config_management.unsaved_changes', { count: Math.max(1, unsavedCount) })}
          {statusText ? <span className={styles.statusDetail}>{statusText}</span> : null}
        </span>
        <div className={styles.actionsGroup}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDiscard}
            disabled={discardDisabled}
          >
            {t('config_management.actions.discard')}
          </Button>
          <Button type="button" size="sm" onClick={onSave} disabled={saveDisabled}>
            {saving ? <LoadingSpinner size={14} /> : <IconCheck size={15} />}
            {t('config_management.actions.save')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
