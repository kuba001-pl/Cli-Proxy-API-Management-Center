import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { ConfigEditorMode } from '../constants';

export type ModeSwitchProps = {
  mode: ConfigEditorMode;
  disabled?: boolean;
  onChange: (mode: ConfigEditorMode) => void;
};

export function ModeSwitch({ mode, disabled = false, onChange }: ModeSwitchProps) {
  const { t } = useTranslation();
  return (
    <SegmentedControl
      value={mode}
      onChange={onChange}
      disabled={disabled}
      ariaLabel={t('config_management.mode.label')}
      options={[
        { value: 'visual', label: t('config_management.mode.visual') },
        { value: 'source', label: t('config_management.mode.source') },
      ]}
    />
  );
}
