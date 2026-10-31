import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { FIELD_VALUE_KEYS } from '../../constants';
import { ConfigDirtyFieldsContext } from './dirtyFieldsContext';
import styles from './Field.module.scss';

export function DirtyFieldIndicator({ fieldId }: { fieldId: string }) {
  const dirtyFields = useContext(ConfigDirtyFieldsContext);
  const { t } = useTranslation();
  if (!(FIELD_VALUE_KEYS[fieldId] ?? []).some((key) => dirtyFields.has(key))) return null;

  return (
    <span
      className={styles.dirtyDot}
      role="img"
      aria-label={t('config_management.status_dirty_short')}
    />
  );
}
