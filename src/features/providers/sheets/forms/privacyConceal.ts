/**
 * Presentation-only concealment for personal provider values (endpoint URLs, proxies with
 * `user:pass@`, prefixes, header values). Privacy mode renders the input as a password field
 * without a reveal control; the real value stays in form state, onChange and API payloads.
 */
export type ConcealInputProps = {
  type: 'text' | 'password';
  autoComplete?: 'off';
  spellCheck?: false;
  'data-privacy-concealed'?: 'true';
};

export function concealInputProps(conceal: boolean): ConcealInputProps {
  return conceal
    ? { type: 'password', autoComplete: 'off', spellCheck: false, 'data-privacy-concealed': 'true' }
    : { type: 'text' };
}
