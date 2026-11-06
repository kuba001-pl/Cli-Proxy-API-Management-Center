import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconRefreshCw } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { pickHeaderFact, type HeaderMetaSegment } from '../uiState';
import styles from './ConfigHeader.module.scss';

export type ConfigHeaderProps = {
  /** Meta segments from uiState.buildHeaderMeta; the header shows only the one that matters. */
  meta: HeaderMetaSegment[];
  reloadDisabled: boolean;
  reloading: boolean;
  onReload: () => void;
  /** Editor mode switch, alongside Reload at every viewport width. */
  extraActions?: ReactNode;
  /** Optional control rendered before Reload (the Source-mode search bar). */
  leadingActions?: ReactNode;
};

/**
 * 配置面板头部：标题领衔 + 至多一条需要关注的状态 + 重载 ghost。
 * 保存动作不在头部常驻 —— 由 FloatingSaveBar 在 dirty 时承载。
 */
export function ConfigHeader({
  meta,
  reloadDisabled,
  reloading,
  onReload,
  extraActions,
  leadingActions,
}: ConfigHeaderProps) {
  const { t } = useTranslation();
  const toneClass: Record<HeaderMetaSegment['tone'], string> = {
    muted: styles.metaMuted,
    warning: styles.metaWarning,
    error: styles.metaError,
    ok: styles.metaOk,
  };
  const fact = pickHeaderFact(meta);

  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        <h1 className={styles.title} data-reveal>
          {t('config_management.title')}
        </h1>
        {fact ? (
          <p className={styles.meta} data-reveal>
            <span className={toneClass[fact.tone]}>
              {fact.count !== undefined
                ? t(fact.labelKey, { count: fact.count })
                : t(fact.labelKey)}
            </span>
          </p>
        ) : null}
      </div>
      <div className={styles.actions} data-reveal>
        {leadingActions}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReload}
          disabled={reloadDisabled}
        >
          <IconRefreshCw size={14} className={reloading ? styles.spinning : undefined} />
          {t('config_management.reload')}
        </Button>
        {extraActions}
      </div>
    </header>
  );
}
