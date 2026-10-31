import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { IconCheck } from '@/components/ui/icons';
import { useActionBarHeightVar } from '@/hooks/useActionBarHeightVar';
import styles from './RoutingSaveBar.module.scss';

export interface RoutingSaveBarProps {
  visible: boolean;
  count: number;
  saving: boolean;
  saveDisabled: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

/** Matches Config's floating toolbar; saving still opens Routing's change review first. */
export function RoutingSaveBar({
  visible,
  count,
  saving,
  saveDisabled,
  onSave,
  onDiscard,
}: RoutingSaveBarProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  useActionBarHeightVar(containerRef, '--routing-action-bar-height', visible);

  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <div ref={containerRef} className={styles.container}>
      <div className={styles.bar} role="region" aria-label={t('routing.dirty_region')}>
        <span className={styles.status} role="status">
          <span className={styles.warningDot} aria-hidden="true" />
          {t('routing.dirty_count', { count })}
        </span>
        <div className={styles.actionsGroup}>
          <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
            {t('routing.discard')}
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving || saveDisabled}>
            {saving ? <LoadingSpinner size={14} /> : <IconCheck size={15} />}
            {t('routing.save')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
