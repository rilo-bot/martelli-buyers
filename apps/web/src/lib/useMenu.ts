import { useEffect, useRef } from 'react';

/**
 * Keyboard + focus management for hand-rolled popup menus.
 * - Closes on outside pointerdown and on Escape.
 * - Moves focus to the first menu item when opened.
 * - Restores focus to the trigger when closed.
 *
 * Attach `triggerRef` to the toggle button and `menuRef` to the menu container
 * (the element holding role="menuitem" children).
 */
export function useMenu(open: boolean, onClose: () => void) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        triggerRef.current?.focus();
      }
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    // Focus the first item once the menu paints.
    const id = window.setTimeout(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }, 0);

    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(id);
    };
  }, [open, onClose]);

  return { triggerRef, menuRef };
}
