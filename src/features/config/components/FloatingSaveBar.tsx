import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { IconCheck } from '@/components/ui/icons';
import { useActionBarHeightVar } from '@/hooks/useActionBarHeightVar';
import styles from './FloatingSaveBar.module.scss';

export type FloatingSaveBarProps = {
  visible: boolean;
  /** Visible status, e.g. "3 unsaved changes". */
  statusLabel: string;
  /** Extra status for assistive tech (and the tooltip), e.g. why saving is blocked. */
  statusText?: string;
  /** Accessible name of the bar's group. */
  groupLabel: string;
  saveLabel: string;
  discardLabel: string;
  saving: boolean;
  saveDisabled: boolean;
  discardDisabled: boolean;
  onSave: () => void;
  onDiscard: () => void;
  /** Root CSS variable that receives the bar's live height (page bottom reserve). */
  heightVar: string;
};

/**
 * The floating unsaved-changes bar shared by Config and Routing. Portalled to <body> so the
 * page-transition layer does not break fixed positioning; callers own the save semantics
 * (Config saves via its diff modal, Routing opens its change review first).
 */
export function FloatingSaveBar({
  visible,
  statusLabel,
  statusText,
  groupLabel,
  saveLabel,
  discardLabel,
  saving,
  saveDisabled,
  discardDisabled,
  onSave,
  onDiscard,
  heightVar,
}: FloatingSaveBarProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useActionBarHeightVar(containerRef, heightVar, visible);

  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.container} ref={containerRef}>
      <div className={styles.bar} role="group" aria-label={groupLabel}>
        <span className={styles.status} role="status" title={statusText}>
          <span className={styles.warningDot} aria-hidden="true" />
          {statusLabel}
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
            {discardLabel}
          </Button>
          <Button type="button" size="sm" onClick={onSave} disabled={saveDisabled}>
            {saving ? <LoadingSpinner size={14} /> : <IconCheck size={15} />}
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
