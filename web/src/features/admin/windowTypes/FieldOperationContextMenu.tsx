import React, { useEffect, useRef } from "react";
import type { WindowTypeSourceModelFieldOperation } from "./windowTypeSourceModel.types";
import type { FieldOperationMenuGroup } from "./fieldOperationOptions";

export type FieldOperationContextMenuField = {
  row: number;
  column: number;
  key: string;
};

type Props = {
  open: boolean;
  x: number;
  y: number;
  field: FieldOperationContextMenuField | null;
  availableOperations: FieldOperationMenuGroup[];
  onSelectOperation: (operation: WindowTypeSourceModelFieldOperation) => void;
  onClose: () => void;
};

export default function FieldOperationContextMenu(props: Props) {
  const { open, x, y, field, availableOperations, onSelectOperation, onClose } = props;
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open || !field) return null;

  return (
    <div
      ref={menuRef}
      className="admin-card ui-card"
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 1000,
        minWidth: 230,
        maxWidth: 280,
        padding: 10,
        display: "grid",
        gap: 8,
        boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)",
      }}
      role="menu"
      aria-label={`Field operation menu for field ${field.key}`}
    >
      <div style={{ display: "grid", gap: 2 }}>
        <div className="admin-setting-label">Field operation</div>
        <div className="admin-body-copy">
          Field {field.key} · row {field.row}, column {field.column}
        </div>
      </div>
      {availableOperations.map((group) => (
        <div key={group.id} style={{ display: "grid", gap: 5 }}>
          <div className="admin-setting-label" style={{ opacity: group.disabled ? 0.58 : 1 }}>
            {group.label}
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {group.options.map((option) => {
              const disabled = group.disabled || option.disabled;
              return (
                <button
                  key={`${group.id}-${option.operation}-${option.label}`}
                  type="button"
                  className="admin-nav-button"
                  disabled={disabled}
                  role="menuitem"
                  onClick={() => {
                    if (disabled) return;
                    onSelectOperation(option.operation);
                    onClose();
                  }}
                  style={{
                    justifyContent: "flex-start",
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                >
                  <span className="admin-nav-button-label">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
