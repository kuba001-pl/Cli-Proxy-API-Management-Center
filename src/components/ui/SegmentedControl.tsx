import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { getSegmentedControlNextIndex } from './segmentedControlNavigation';
import styles from './SegmentedControl.module.scss';

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Localized accessible name supplied by the caller. */
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled);
  const focusIndex =
    selectedIndex < 0 ? options.findIndex((option) => !option.disabled) : selectedIndex;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (disabled) return;
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const nextIndex = getSegmentedControlNextIndex(options, index, event.key, rtl);
    if (nextIndex === null) return;
    event.preventDefault();
    buttons.current[nextIndex]?.focus();
    onChange(options[nextIndex].value);
  };

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      aria-disabled={disabled || undefined}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(button) => {
            buttons.current[index] = button;
          }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={!disabled && index === focusIndex ? 0 : -1}
          disabled={disabled || option.disabled}
          className={styles.option}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
