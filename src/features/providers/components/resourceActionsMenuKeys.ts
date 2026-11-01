/**
 * Pure keyboard logic for the row overflow menu, following the WAI-ARIA menu-button pattern.
 * Kept free of DOM access so it can be unit tested without a browser.
 */

export type MenuFocusTarget = 'first' | 'last';

export type MenuKeyAction =
  /** Open the menu and focus the given end once it is positioned. */
  | { type: 'open'; focus: MenuFocusTarget; preventDefault: true }
  /** Move focus to the item at `index` (index into enabled items). */
  | { type: 'focus'; index: number; preventDefault: true }
  /**
   * Close the menu. `restoreFocus` returns focus to the trigger. Tab keeps its default
   * action so focus continues to the next/previous element after the trigger.
   */
  | { type: 'close'; restoreFocus: boolean; preventDefault: boolean };

/** Keys pressed while focus is on the trigger button. */
export function resolveTriggerKey(key: string, open: boolean): MenuKeyAction | null {
  if (open && key === 'Escape') return { type: 'close', restoreFocus: true, preventDefault: true };
  switch (key) {
    case 'Enter':
    case ' ':
    case 'Spacebar':
    case 'ArrowDown':
      return { type: 'open', focus: 'first', preventDefault: true };
    case 'ArrowUp':
      return { type: 'open', focus: 'last', preventDefault: true };
    default:
      return null;
  }
}

/**
 * Keys pressed while focus is inside the open menu. `currentIndex` is the focused enabled
 * item's index (-1 when none), `count` the number of enabled items.
 */
export function resolveMenuKey(
  key: string,
  currentIndex: number,
  count: number
): MenuKeyAction | null {
  if (key === 'Escape') return { type: 'close', restoreFocus: true, preventDefault: true };
  if (key === 'Tab') return { type: 'close', restoreFocus: true, preventDefault: false };
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowDown':
      return {
        type: 'focus',
        index: currentIndex < 0 ? 0 : (currentIndex + 1) % count,
        preventDefault: true,
      };
    case 'ArrowUp':
      return {
        type: 'focus',
        index: currentIndex < 0 ? count - 1 : (currentIndex - 1 + count) % count,
        preventDefault: true,
      };
    case 'Home':
      return { type: 'focus', index: 0, preventDefault: true };
    case 'End':
      return { type: 'focus', index: count - 1, preventDefault: true };
    default:
      return null;
  }
}

/** Index to focus when the menu opens with the given target. */
export function resolveInitialFocusIndex(target: MenuFocusTarget, count: number): number {
  if (count <= 0) return -1;
  return target === 'last' ? count - 1 : 0;
}
