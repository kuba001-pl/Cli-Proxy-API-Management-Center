import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  resolveInitialFocusIndex,
  resolveMenuKey,
  resolveTriggerKey,
} from '../src/features/providers/components/resourceActionsMenuKeys';

describe('resource actions menu keyboard (WAI-ARIA menu button)', () => {
  test('trigger Enter/Space/ArrowDown open on the first item, ArrowUp on the last', () => {
    for (const key of ['Enter', ' ', 'ArrowDown']) {
      expect(resolveTriggerKey(key, false)).toEqual({
        type: 'open',
        focus: 'first',
        preventDefault: true,
      });
    }
    expect(resolveTriggerKey('ArrowUp', false)).toEqual({
      type: 'open',
      focus: 'last',
      preventDefault: true,
    });
    expect(resolveTriggerKey('a', false)).toBeNull();
    expect(resolveTriggerKey('Escape', false)).toBeNull();
  });

  test('Escape on the trigger closes an open menu', () => {
    expect(resolveTriggerKey('Escape', true)).toEqual({
      type: 'close',
      restoreFocus: true,
      preventDefault: true,
    });
  });

  test('arrow keys wrap and Home/End jump between items', () => {
    expect(resolveMenuKey('ArrowDown', 0, 2)).toMatchObject({ type: 'focus', index: 1 });
    expect(resolveMenuKey('ArrowDown', 1, 2)).toMatchObject({ type: 'focus', index: 0 });
    expect(resolveMenuKey('ArrowUp', 0, 2)).toMatchObject({ type: 'focus', index: 1 });
    expect(resolveMenuKey('ArrowUp', 1, 3)).toMatchObject({ type: 'focus', index: 0 });
    expect(resolveMenuKey('ArrowDown', -1, 3)).toMatchObject({ type: 'focus', index: 0 });
    expect(resolveMenuKey('ArrowUp', -1, 3)).toMatchObject({ type: 'focus', index: 2 });
    expect(resolveMenuKey('Home', 2, 3)).toMatchObject({ type: 'focus', index: 0 });
    expect(resolveMenuKey('End', 0, 3)).toMatchObject({ type: 'focus', index: 2 });
    expect(resolveMenuKey('ArrowDown', -1, 0)).toBeNull();
    expect(resolveMenuKey('x', 0, 2)).toBeNull();
  });

  test('Escape restores focus to the trigger; Tab closes without blocking navigation', () => {
    expect(resolveMenuKey('Escape', 0, 2)).toEqual({
      type: 'close',
      restoreFocus: true,
      preventDefault: true,
    });
    expect(resolveMenuKey('Tab', 0, 2)).toEqual({
      type: 'close',
      restoreFocus: true,
      preventDefault: false,
    });
    expect(resolveMenuKey('Escape', -1, 0)).toMatchObject({ type: 'close' });
  });

  test('initial focus index honours first/last and empty menus', () => {
    expect(resolveInitialFocusIndex('first', 2)).toBe(0);
    expect(resolveInitialFocusIndex('last', 2)).toBe(1);
    expect(resolveInitialFocusIndex('first', 0)).toBe(-1);
  });

  test('component focuses items only after positioning commits and handles trigger keys', () => {
    const source = readFileSync(
      new URL('../src/features/providers/components/ResourceActionsMenu.tsx', import.meta.url),
      'utf8'
    );
    expect(source).toContain('}, [open, positioned]);');
    expect(source).toContain('onKeyDown={handleTriggerKeyDown}');
    expect(source).toContain('role="menu"');
    expect(source).toContain('role="menuitem"');
    expect(source).toContain("document.addEventListener('pointerdown'");
  });
});
