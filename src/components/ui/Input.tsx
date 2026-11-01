import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: ReactNode;
  error?: string;
  /** Decorative leading slot (e.g. a search glyph); rendered non-interactive. */
  leftElement?: ReactNode;
  rightElement?: ReactNode;
  mono?: boolean;
}

export function Input({
  label,
  hint,
  error,
  leftElement,
  rightElement,
  mono = false,
  className = '',
  id,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy =
    [rest['aria-describedby'], errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="form-group">
      {label && <label htmlFor={inputId}>{label}</label>}
      <div style={{ position: 'relative' }}>
        {leftElement && (
          <span className="input-leading" aria-hidden="true">
            {leftElement}
          </span>
        )}
        <input
          id={inputId}
          className={['input', mono && 'input-mono', leftElement && 'input-has-leading', className]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={Boolean(error) || rest['aria-invalid']}
          aria-describedby={describedBy}
          {...rest}
        />
        {rightElement && (
          <div
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
          >
            {rightElement}
          </div>
        )}
      </div>
      {hint && (
        <div id={hintId} className="hint">
          {hint}
        </div>
      )}
      {error && (
        <div id={errorId} className="error-box">
          {error}
        </div>
      )}
    </div>
  );
}
