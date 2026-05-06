import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { WindowTypeSourceModelFieldOperation } from "./windowTypeSourceModel.types";
import type { FieldOperationMenuOption } from "./fieldOperationOptions";

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
  availableOperations: FieldOperationMenuOption[];
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

  if (!open || !field || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      className="admin-card ui-card"
      style={{
        position: "fixed",
        top: y,
        left: x,
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
      <div style={{ display: "grid", gap: 4 }}>
        {availableOperations.map((option) => (
          <button
            key={`${option.operation}-${option.label}`}
            type="button"
            className="admin-nav-button"
            role="menuitem"
            onClick={() => {
              onSelectOperation(option.operation);
              onClose();
            }}
            style={{
              justifyContent: "flex-start",
              cursor: "pointer",
            }}
          >
            <span className="admin-nav-button-label">{option.label}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}
