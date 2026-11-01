import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { IconEllipsis } from '@/components/ui/icons';
import { resolveDropdownStyle } from '@/components/ui/selectPosition';
import styles from './ResourceActionsMenu.module.scss';
import {
  resolveInitialFocusIndex,
  resolveMenuKey,
  resolveTriggerKey,
  type MenuFocusTarget,
  type MenuKeyAction,
} from './resourceActionsMenuKeys';

const MENU_MIN_WIDTH = 150;
const HIDDEN_STYLE: CSSProperties = { position: 'fixed', visibility: 'hidden' };

export interface ResourceActionsMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

interface ResourceActionsMenuProps {
  label: string;
  items: ResourceActionsMenuItem[];
}

const enabledItems = (menu: HTMLElement | null): HTMLButtonElement[] =>
  Array.from(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);

/**
 * Row overflow menu (Figma: edit + ellipsis), WAI-ARIA menu-button pattern. Portaled with
 * fixed positioning so the horizontally scrolling table cannot clip it. Trigger:
 * Enter/Space/ArrowDown open on the first item, ArrowUp on the last. Menu: arrows/Home/End
 * move, Escape closes and restores focus to the trigger, Tab closes and moves on.
 */
export function ResourceActionsMenu({ label, items }: ResourceActionsMenuProps) {
  const [open, setOpen] = useState(false);
  // null until the fixed position has been measured; the menu stays hidden until then.
  const [placement, setPlacement] = useState<CSSProperties | null>(null);
  const focusTargetRef = useRef<MenuFocusTarget>('first');
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const positioned = placement !== null;

  const openMenu = useCallback((focus: MenuFocusTarget) => {
    focusTargetRef.current = focus;
    setOpen(true);
  }, []);

  const close = useCallback((restoreFocus: boolean) => {
    if (restoreFocus) buttonRef.current?.focus();
    setOpen(false);
    setPlacement(null);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const next = resolveDropdownStyle(
        rect,
        window.innerWidth,
        window.innerHeight,
        MENU_MIN_WIDTH
      );
      setPlacement({ ...next, width: MENU_MIN_WIDTH, maxHeight: undefined });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  // Move focus only once the visible position has committed (a hidden element cannot
  // take focus), so this depends on `positioned`, not just `open`.
  useLayoutEffect(() => {
    if (!open || !positioned) return;
    const buttons = enabledItems(menuRef.current);
    const index = resolveInitialFocusIndex(focusTargetRef.current, buttons.length);
    if (index >= 0) buttons[index].focus();
    else menuRef.current?.focus();
  }, [open, positioned]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  const applyAction = (event: KeyboardEvent<HTMLElement>, action: MenuKeyAction | null) => {
    if (!action) return;
    if (action.preventDefault) event.preventDefault();
    event.stopPropagation();
    if (action.type === 'open') {
      if (open) {
        const buttons = enabledItems(menuRef.current);
        const index = resolveInitialFocusIndex(action.focus, buttons.length);
        if (index >= 0) buttons[index].focus();
      } else {
        openMenu(action.focus);
      }
    } else if (action.type === 'focus') {
      enabledItems(menuRef.current)[action.index]?.focus();
    } else {
      close(action.restoreFocus);
    }
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    applyAction(event, resolveTriggerKey(event.key, open));
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = enabledItems(menuRef.current);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    applyAction(event, resolveMenuKey(event.key, index, buttons.length));
  };

  const handleMenuBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (!next) return;
    if (menuRef.current?.contains(next) || buttonRef.current?.contains(next)) return;
    close(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onKeyDown={handleTriggerKeyDown}
        onClick={(event) => {
          event.stopPropagation();
          if (open) close(false);
          else openMenu('first');
        }}
      >
        <IconEllipsis size={16} />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              tabIndex={-1}
              className={styles.menu}
              style={placement ?? HIDDEN_STYLE}
              onKeyDown={handleMenuKeyDown}
              onBlur={handleMenuBlur}
              onClick={(event) => event.stopPropagation()}
            >
              {items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className={`${styles.item} ${item.danger ? styles.itemDanger : ''}`.trim()}
                  disabled={item.disabled}
                  onClick={() => {
                    close(true);
                    item.onSelect();
                  }}
                >
                  {item.icon ? (
                    <span className={styles.itemIcon} aria-hidden="true">
                      {item.icon}
                    </span>
                  ) : null}
                  {item.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
