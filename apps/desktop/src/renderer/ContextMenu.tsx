import { useEffect, useRef, type ReactNode } from "react";

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
}: {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly items: readonly ContextMenuItem[];
  readonly onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const close = () => onClose();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", keydown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      role="menu"
      aria-label={label}
      style={{ left: Math.min(x, window.innerWidth - 224), top: Math.min(y, window.innerHeight - items.length * 42 - 18) }}
      onPointerDown={(event) => event.stopPropagation()}
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
