import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivacyStore } from '@/stores/usePrivacyStore';
import styles from './Blocks.module.scss';

/** Minimum character count before the expand/collapse toggle appears. */
const EXPAND_THRESHOLD = 30;

/** Auto-expanding textarea that collapses back to a single-line input on demand. */
export function ExpandableInput({
  value,
  placeholder,
  ariaLabel,
  disabled,
  className,
  privacySensitive = false,
  onChange,
}: {
  value: string;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  /**
   * The value may carry personal data. In privacy mode it renders as a single-line
   * password input (no expand, no reveal); the real value is still edited in place.
   */
  privacySensitive?: boolean;
  onChange: (nextValue: string) => void;
}) {
  const { t } = useTranslation();
  const conceal = usePrivacyStore((state) => privacySensitive && state.enabled);
  const [collapsedState, setCollapsed] = useState(true);
  const collapsed = collapsedState || conceal;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Strip newlines — these fields are single-line identifiers/paths that
    // would break YAML serialization if they contained line breaks.
    const sanitized = e.target.value.replace(/[\r\n]/g, '');
    onChange(sanitized);
    // autoResize is handled by useLayoutEffect after React syncs the
    // sanitized value back to the DOM — calling it here would measure
    // stale content.
  };

  // Resize synchronously before paint to avoid visual flicker.
  useLayoutEffect(() => {
    if (!collapsed && textareaRef.current) {
      autoResize(textareaRef.current);
    }
  }, [collapsed, value, autoResize]);

  if (collapsed) {
    return (
      <div className={styles.expandableInputWrapper}>
        <input
          className={`input ${className ?? ''}`}
          type={conceal ? 'password' : 'text'}
          autoComplete={conceal ? 'off' : undefined}
          placeholder={placeholder}
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[\r\n]/g, ''))}
          disabled={disabled}
        />
        {!conceal && value.length > EXPAND_THRESHOLD && (
          <button
            type="button"
            className={styles.expandableToggle}
            disabled={disabled}
            onClick={() => {
              setCollapsed(false);
              requestAnimationFrame(() => {
                textareaRef.current?.focus();
              });
            }}
            title={t('common.expand')}
            aria-label={t('common.expand')}
          >
            ▼
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`${styles.expandableInputWrapper} ${styles.expandableInputExpanded}`}>
      <textarea
        ref={textareaRef}
        className={`input ${styles.expandableTextarea} ${className ?? ''}`}
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        rows={2}
      />
      <button
        type="button"
        className={styles.expandableToggle}
        disabled={disabled}
        onClick={() => setCollapsed(true)}
        title={t('common.collapse')}
        aria-label={t('common.collapse')}
      >
        ▲
      </button>
    </div>
  );
}
