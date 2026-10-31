/** Returns an enabled option for radio-group keyboard navigation, wrapping at either end. */
export function getSegmentedControlNextIndex(
  options: readonly { disabled?: boolean }[],
  currentIndex: number,
  key: string,
  rtl = false
): number | null {
  const enabled = options.flatMap((option, index) => (option.disabled ? [] : [index]));
  if (enabled.length === 0) return null;
  if (key === 'Home') return enabled[0];
  if (key === 'End') return enabled[enabled.length - 1];

  let step: number;
  switch (key) {
    case 'ArrowRight':
      step = rtl ? -1 : 1;
      break;
    case 'ArrowLeft':
      step = rtl ? 1 : -1;
      break;
    case 'ArrowDown':
      step = 1;
      break;
    case 'ArrowUp':
      step = -1;
      break;
    default:
      return null;
  }

  const position = enabled.indexOf(currentIndex);
  if (position < 0) return step > 0 ? enabled[0] : enabled[enabled.length - 1];
  return enabled[(position + step + enabled.length) % enabled.length];
}
