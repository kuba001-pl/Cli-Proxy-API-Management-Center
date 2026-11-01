import { useTranslation } from 'react-i18next';
import { FloatingSaveBar } from '@/features/config/components/FloatingSaveBar';

export interface RoutingSaveBarProps {
  visible: boolean;
  count: number;
  saving: boolean;
  saveDisabled: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

/** Config's floating save bar with Routing copy; saving still opens the change review first. */
export function RoutingSaveBar({
  visible,
  count,
  saving,
  saveDisabled,
  onSave,
  onDiscard,
}: RoutingSaveBarProps) {
  const { t } = useTranslation();
  return (
    <FloatingSaveBar
      visible={visible}
      statusLabel={t('routing.dirty_count', { count })}
      groupLabel={t('routing.dirty_region')}
      saveLabel={t('routing.save')}
      discardLabel={t('routing.discard')}
      saving={saving}
      saveDisabled={saving || saveDisabled}
      discardDisabled={saving}
      onSave={onSave}
      onDiscard={onDiscard}
      heightVar="--routing-action-bar-height"
    />
  );
}
