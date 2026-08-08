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
      className="admin-card ui-card window-types-context-menu"
      data-x={`${Math.round(x)}px`}
      data-y={`${Math.round(y)}px`}
      role="menu"
      aria-label={`Field operation menu for field ${field.key}`}
    >
      <div className="qs-migrated-135">
        <div className="admin-setting-label">Field operation</div>
        <div className="admin-body-copy">
          Field {field.key} · row {field.row}, column {field.column}
        </div>
      </div>
      <div className="qs-migrated-17">
        {availableOperations.map((option) => (
          <button
            key={`${option.operation}-${option.label}`}
            type="button"
            className="admin-nav-button qs-migrated-193"
            role="menuitem"
            onClick={() => {
              onSelectOperation(option.operation);
              onClose();
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
