import { useId, useState, type CSSProperties } from 'react';
import { IconPlus } from '@/components/ui/icons';
import type { ProviderFlowState } from '../hooks/useOAuthFlows';
import { BrandGlyph } from './BrandGlyph';
import styles from './ProviderTile.module.scss';

/** 首屏磁贴级联：起点让位给头部（140ms），级差 30ms，整组封顶 360ms。 */
const TILE_BASE_DELAY_MS = 140;
const TILE_STAGGER_MS = 30;
const TILE_MAX_DELAY_MS = 360;

export interface ProviderTileProps {
  label: string;
  caption: string;
  icon: string;
  index: number;
  status?: ProviderFlowState['status'];
  statusLabel?: string;
  /** Visible verb for what the tile does ("Sign in", "Import", "Bind"); falls back to a plus. */
  actionLabel?: string;
  onOpen: () => void;
}

/**
 * Provider tile: the whole tile is the hit area (stretched button) and opens the sign-in dialog.
 * The caption line only appears when it says something (a non-default flow, a domain, or the
 * live sign-in status while the dialog is closed). The sponsor uses SponsorCard instead.
 */
export function ProviderTile({
  label,
  caption,
  icon,
  index,
  status,
  statusLabel,
  actionLabel,
  onOpen,
}: ProviderTileProps) {
  const captionId = useId();
  const showStatus = Boolean(status && statusLabel);
  const hasCaption = showStatus || caption.length > 0;
  // 挂载时捕获延迟：之后的重渲染（状态轮询）不重播入场
  const [enterDelay] = useState(
    () => `${Math.min(TILE_BASE_DELAY_MS + index * TILE_STAGGER_MS, TILE_MAX_DELAY_MS)}ms`
  );

  return (
    <div
      className={styles.tile}
      data-status={status ?? 'idle'}
      style={{ '--tile-delay': enterDelay } as CSSProperties}
    >
      <span className={styles.glyph}>
        <BrandGlyph src={icon} size={20} className={styles.glyphImage} />
      </span>
      <span className={styles.text}>
        <button
          type="button"
          className={styles.main}
          onClick={onOpen}
          aria-haspopup="dialog"
          aria-describedby={hasCaption ? captionId : undefined}
        >
          {label}
        </button>
        {hasCaption && (
          <span className={styles.caption} id={captionId}>
            {showStatus ? (
              <span className={styles.status}>{statusLabel}</span>
            ) : (
              <span className={styles.captionText}>{caption}</span>
            )}
          </span>
        )}
      </span>
      <span className={styles.trail} aria-hidden="true">
        {actionLabel ? (
          <span className={styles.trailLabel}>{actionLabel}</span>
        ) : (
          <IconPlus size={15} />
        )}
      </span>
    </div>
  );
}
