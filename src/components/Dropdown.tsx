import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/utils/cx';
import { IconCheck, type IconProps } from './Icons';

export type DropdownItem =
  | {
      type?: 'item';
      id: string;
      label: ReactNode;
      /** Text used for type-ahead when `label` is not a plain string. */
      textValue?: string;
      description?: ReactNode;
      icon?: ComponentType<IconProps>;
      /** Set for choices (shown with a check mark, announced as a radio item). */
      checked?: boolean;
      disabled?: boolean;
      onSelect: () => void;
    }
  | { type: 'separator'; id: string }
  | { type: 'label'; id: string; label: ReactNode };

type ActionItem = Extract<DropdownItem, { onSelect: () => void }>;

export interface DropdownTriggerProps {
  ref: RefObject<HTMLButtonElement>;
  id: string;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

export interface DropdownProps {
  /** Renders the trigger. Spread the given props onto a <button>. */
  trigger: (props: DropdownTriggerProps) => ReactNode;
  items: readonly DropdownItem[];
  align?: 'start' | 'end';
  /** Tailwind width class for the menu. */
  width?: string;
}

function isAction(item: DropdownItem): item is ActionItem {
  return item.type === undefined || item.type === 'item';
}

interface MenuPosition {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

/** Below the trigger, or above it when there is clearly more room there. */
function menuPosition(rect: DOMRect, align: 'start' | 'end'): MenuPosition {
  const below = window.innerHeight - rect.bottom - 8;
  const above = rect.top - 8;
  const horizontal =
    align === 'end' ? { right: window.innerWidth - rect.right } : { left: rect.left };
  if (below < 240 && above > below) {
    return { ...horizontal, bottom: window.innerHeight - rect.top + 4, maxHeight: above - 4 };
  }
  return { ...horizontal, top: rect.bottom + 4, maxHeight: below - 4 };
}

function itemText(item: ActionItem): string {
  return (item.textValue ?? (typeof item.label === 'string' ? item.label : '')).toLowerCase();
}

/**
 * Menu button (WAI-ARIA menu pattern). Opens with click, Enter, Space or the arrow keys;
 * arrows, Home, End and type-ahead move between items; Enter or Space selects; Escape closes
 * and returns focus to the trigger. Disabled items are skipped.
 *
 * The menu renders in a portal with fixed positioning, so it is never clipped by a scrolling
 * or transformed container (grid cells are both). It closes when the page scrolls.
 */
export function Dropdown({ trigger, items, align = 'start', width = 'w-56' }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const triggerId = useId();
  const menuId = useId();

  const actions = items.filter(isAction);
  const actionIndex = new Map(actions.map((item, index) => [item.id, index]));
  const enabled = actions.map((item, index) => ({ item, index })).filter((e) => !e.item.disabled);

  const openAt = (position: 'first' | 'last') => {
    const target = position === 'first' ? enabled[0] : enabled[enabled.length - 1];
    setFocusIndex(target?.index ?? 0);
    const rect = triggerRef.current?.getBoundingClientRect();
    setPosition(rect ? menuPosition(rect, align) : null);
    setOpen(true);
  };

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  // Move DOM focus to the active item whenever the menu is open.
  useEffect(() => {
    if (open) itemRefs.current[focusIndex]?.focus();
  }, [open, focusIndex]);

  useEffect(() => {
    if (!open) return undefined;
    const inside = (target: EventTarget | null) =>
      target instanceof Node &&
      (root.current?.contains(target) === true || menuRef.current?.contains(target) === true);
    const onPointer = (event: PointerEvent) => {
      if (!inside(event.target)) setOpen(false);
    };
    // A fixed menu would drift away from its trigger, so close it when anything scrolls
    // (except the menu's own list).
    const onScroll = (event: Event) => {
      if (!inside(event.target)) setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const move = (delta: number) => {
    const at = enabled.findIndex((e) => e.index === focusIndex);
    const next = enabled[(at + delta + enabled.length) % enabled.length];
    if (next) setFocusIndex(next.index);
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        return;
      case 'Home':
        event.preventDefault();
        setFocusIndex(enabled[0]?.index ?? 0);
        return;
      case 'End':
        event.preventDefault();
        setFocusIndex(enabled[enabled.length - 1]?.index ?? 0);
        return;
      case 'Escape':
        event.preventDefault();
        close(true);
        return;
      case 'Tab':
        // Focus the trigger without preventing the default, so Tab continues from it.
        close(true);
        return;
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const key = event.key.toLowerCase();
          const at = enabled.findIndex((e) => e.index === focusIndex);
          const ordered = [...enabled.slice(at + 1), ...enabled.slice(0, at + 1)];
          const match = ordered.find((e) => itemText(e.item).startsWith(key));
          if (match) setFocusIndex(match.index);
        }
    }
  };

  const select = (item: ActionItem) => {
    if (item.disabled) return;
    close(true);
    item.onSelect();
  };

  return (
    <div ref={root} className="relative">
      {trigger({
        ref: triggerRef,
        id: triggerId,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
        onClick: () => (open ? close(false) : openAt('first')),
        onKeyDown: (event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openAt(event.key === 'ArrowDown' ? 'first' : 'last');
          }
        },
      })}
      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-labelledby={triggerId}
              onKeyDown={onMenuKeyDown}
              style={{ position: 'fixed', ...position, maxHeight: position?.maxHeight }}
              className={cx(
                'z-[60] overflow-y-auto rounded-md border border-line-strong bg-panel py-1 shadow-xl scroll-thin',
                width,
              )}
            >
              {items.map((item) => {
                if (item.type === 'separator') {
                  return (
                    <div key={item.id} role="separator" className="my-1 border-t border-line" />
                  );
                }
                if (item.type === 'label') {
                  return (
                    <div
                      key={item.id}
                      role="presentation"
                      className="px-2.5 pb-0.5 pt-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle"
                    >
                      {item.label}
                    </div>
                  );
                }
                const index = actionIndex.get(item.id) ?? -1;
                const Icon = item.icon;
                const isChoice = item.checked !== undefined;
                return (
                  <button
                    key={item.id}
                    ref={(node) => {
                      itemRefs.current[index] = node;
                    }}
                    type="button"
                    role={isChoice ? 'menuitemradio' : 'menuitem'}
                    aria-checked={isChoice ? item.checked : undefined}
                    aria-disabled={item.disabled || undefined}
                    tabIndex={index === focusIndex ? 0 : -1}
                    onClick={() => select(item)}
                    onPointerMove={() => {
                      if (!item.disabled && index !== focusIndex) setFocusIndex(index);
                    }}
                    className={cx(
                      'flex w-full items-start gap-2 px-2.5 py-1.5 text-left text-sm outline-none',
                      item.disabled
                        ? 'cursor-not-allowed text-subtle'
                        : 'text-fg hover:bg-raised focus:bg-raised',
                    )}
                  >
                    <span className="mt-0.5 flex w-3.5 shrink-0 justify-center text-accent">
                      {item.checked ? (
                        <IconCheck size={14} />
                      ) : Icon ? (
                        <Icon size={14} className="text-muted" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.label}</span>
                      {item.description ? (
                        <span className="block truncate text-2xs text-subtle">
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
