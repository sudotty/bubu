import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

export interface ContextMenuItem {
  readonly label: string;
  readonly icon?: ReactNode;
  readonly danger?: boolean;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
}

export function ContextMenu({
  x,
  y,
  label,
  items,
  onClose,
  returnFocus,
}: {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly items: readonly ContextMenuItem[];
  readonly onClose: () => void;
  readonly returnFocus?: HTMLElement | null;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const close = () => onClose();
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
    };
  }, [onClose]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number | undefined;
    if (event.key === "ArrowDown") nextIndex = (index + 1 + buttons.length) % buttons.length;
    if (event.key === "ArrowUp") nextIndex = (index - 1 + buttons.length) % buttons.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = buttons.length - 1;
    if (event.key === "Tab") nextIndex = (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      requestAnimationFrame(() => returnFocus?.focus());
      return;
    }
    if (nextIndex === undefined) return;
    event.preventDefault();
    buttons[nextIndex]?.focus();
  }

  return (
    <div
      ref={menuRef}
      className="context-menu"
      role="menu"
      aria-label={label}
      style={{ left: Math.min(x, window.innerWidth - 224), top: Math.min(y, window.innerHeight - items.length * 42 - 18) }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={handleKeyDown}
    >
      {items.map((item) => (
        <button
          type="button"
          role="menuitem"
          className={item.danger ? "context-menu-danger" : undefined}
          disabled={item.disabled}
          key={item.label}
          onClick={() => {
            item.onSelect();
            onClose();
          }}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
