import React from "react";
import { Input } from "./shared";
import PositionExpandedPanel from "../../estimatePositions/components/PositionExpandedPanel";
import ExpandToggle from "../../../components/common/ExpandToggle";

type Props = {
  e: any;
  itemPriceByPositionId: Record<string, string>;
  setItemPriceByPositionId: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  formatMoney: (n: number) => string;
  positionDescription: (p: any) => string;
  PositionPreview: React.ComponentType<{ position: any }>;
  expandedPositionId: string | null;
  setExpandedPositionId: React.Dispatch<React.SetStateAction<string | null>>;
  onUpdatePositionDraft: (positionId: string, patch: Record<string, any>) => void;
  onPersistPosition: (positionId: string) => Promise<void>;
  onDuplicatePosition: (positionId: string) => Promise<void>;
  onDeletePosition: (positionId: string) => Promise<void>;
  onMovePositionUp: (positionId: string) => Promise<void>;
  onMovePositionDown: (positionId: string) => Promise<void>;
  onConfigurePosition?: (positionId: string) => void;
  quickAddPositionType: "Window" | "Door";
  setQuickAddPositionType: React.Dispatch<React.SetStateAction<"Window" | "Door">>;
  quickAddInsertion: string;
  setQuickAddInsertion: React.Dispatch<React.SetStateAction<string>>;
  availableInsertions: string[];
  onQuickAddPosition: () => Promise<void>;
  isSaving: boolean;
};

export default function EstimatePositionsTable(props: Props) {
  const {
    e,
    itemPriceByPositionId,
    setItemPriceByPositionId,
    formatMoney,
    positionDescription,
    PositionPreview,
    expandedPositionId,
    setExpandedPositionId,
    onUpdatePositionDraft,
    onPersistPosition,
    onDuplicatePosition,
    onDeletePosition,
    onMovePositionUp,
    onMovePositionDown,
    onConfigurePosition,
    quickAddPositionType,
    setQuickAddPositionType,
    quickAddInsertion,
    setQuickAddInsertion,
    availableInsertions,
    onQuickAddPosition,
    isSaving,
  } = props;

  function togglePosition(positionId: string) {
    setExpandedPositionId((prev) => (prev === positionId ? null : positionId));
  }

  function commitField(positionId: string) {
    void onPersistPosition(positionId);
  }

  function handleConfigurePosition(positionId: string) {
    if (onConfigurePosition) {
      onConfigurePosition(positionId);
      return;
    }

    window.alert("Configurator entry hook added. Full configurator workspace wiring is the next integration step for this position.");
  }

  return (
    <div className="ep-positions-shell">
      <div className="ep-positions-toolbar">
        <div className="ep-positions-field">
          <div className="ep-positions-field-label">Quick add</div>
          <select className="ep-positions-select" value={quickAddPositionType} onChange={(e) => setQuickAddPositionType(e.target.value as "Window" | "Door")} disabled={isSaving}>
            <option value="Window">Window</option>
            <option value="Door">Door</option>
          </select>
        </div>

        <div className="ep-positions-field">
          <div className="ep-positions-field-label">Type</div>
          <select className="ep-positions-select" value={quickAddInsertion} onChange={(e) => setQuickAddInsertion(e.target.value)} disabled={isSaving}>
            {availableInsertions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            void onQuickAddPosition();
          }}
          disabled={isSaving}
          className="ep-positions-add-button"
          style={{
            cursor: isSaving ? "not-allowed" : "pointer",
            opacity: isSaving ? 0.55 : 1,
          }}
        >
          Add Position
        </button>

        <div className="ep-positions-saving">
          {isSaving ? "Saving changes..." : "Changes save on blur"}
        </div>
      </div>

      <div className="ep-positions-scroll">
        <table className="ep-positions-table">
          <thead>
            <tr className="ep-positions-head-row">
              <th className="ep-positions-head-cell" style={{ width: 42 }}></th>
              <th className="ep-positions-head-cell" style={{ width: 150 }}>Reference</th>
              <th className="ep-positions-head-cell" style={{ width: 170 }}>Room</th>
              <th className="ep-positions-head-cell">Picture</th>
              <th className="ep-positions-head-cell" style={{ minWidth: 260 }}>Brief description</th>
              <th className="ep-positions-head-cell ep-positions-head-cell--right" style={{ width: 90 }}>Qty</th>
              <th className="ep-positions-head-cell ep-positions-head-cell--right" style={{ width: 140 }}>Item price</th>
              <th className="ep-positions-head-cell ep-positions-head-cell--right" style={{ width: 130 }}>Quantity price</th>
              <th className="ep-positions-head-cell ep-positions-head-cell--center" style={{ width: 220 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {e.positions.map((p: any, idx: number) => {
              const itemPriceRaw = itemPriceByPositionId[p.id] ?? String(p.itemPrice ?? "");
              const itemPrice = Number(itemPriceRaw || 0);
              const quantityPrice = (Number.isFinite(itemPrice) ? itemPrice : 0) * Math.max(1, Number(p.qty || 1));
              const isExpanded = expandedPositionId === p.id;

              return (
                <React.Fragment key={p.id}>
                  <tr onClick={() => togglePosition(p.id)} className="ep-positions-row" aria-expanded={isExpanded}>
                    <td
                      className="ep-positions-cell ep-positions-cell--center"
                      style={{
                        borderBottom: isExpanded ? "none" : "1px solid #f4f4f5",
                        width: 42,
                        minWidth: 42,
                        cursor: "pointer",
                      }}
                    >
                      <ExpandToggle expanded={isExpanded} />
                    </td>

                    <td
                      className="ep-positions-cell"
                      style={{ borderBottom: isExpanded ? "none" : "1px solid #f4f4f5" }}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <Input
                        value={p.positionRef ?? ""}
                        onChange={(ev) => onUpdatePositionDraft(p.id, { positionRef: ev.target.value })}
                        onBlur={() => commitField(p.id)}
                      />
                    </td>

                    <td
                      className="ep-positions-cell"
                      style={{ borderBottom: isExpanded ? "none" : "1px solid #f4f4f5" }}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <Input
                        value={p.roomName ?? ""}
                        onChange={(ev) => onUpdatePositionDraft(p.id, { roomName: ev.target.value })}
                        onBlur={() => commitField(p.id)}
                      />
                    </td>

                    <td className="ep-positions-cell" style={{ borderBottom: isExpanded ? "none" : "1px solid #f4f4f5" }}>
                      <PositionPreview position={p} />
                    </td>

                    <td className="ep-positions-cell" style={{ borderBottom: isExpanded ? "none" : "1px solid #f4f4f5" }}>
                      <div className="ep-positions-description">
                        <div className="ep-positions-description-title">{positionDescription(p)}</div>
                        <div className="ep-positions-dimensions" onClick={(ev) => ev.stopPropagation()}>
                          <Input
                            value={String(p.widthMm ?? "")}
                            onChange={(ev) => onUpdatePositionDraft(p.id, { widthMm: Number(ev.target.value || 0) })}
                            onBlur={() => commitField(p.id)}
                            inputMode="numeric"
                            style={{ width: 90 }}
                          />
                          <span className="ep-positions-divider">×</span>
                          <Input
                            value={String(p.heightMm ?? "")}
                            onChange={(ev) => onUpdatePositionDraft(p.id, { heightMm: Number(ev.target.value || 0) })}
                            onBlur={() => commitField(p.id)}
                            inputMode="numeric"
                            style={{ width: 90 }}
                          />
                        </div>
                      </div>
                    </td>

                    <td
                      className="ep-positions-cell ep-positions-cell--right"
                      style={{ borderBottom: isExpanded ? "none" : "1px solid #f4f4f5" }}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <Input
                        value={String(p.qty ?? "")}
                        onChange={(ev) => onUpdatePositionDraft(p.id, { qty: Number(ev.target.value || 0) })}
                        onBlur={() => commitField(p.id)}
                        inputMode="numeric"
                        style={{ textAlign: "right" }}
                      />
                    </td>

                    <td
                      className="ep-positions-cell ep-positions-cell--right"
                      style={{ borderBottom: isExpanded ? "none" : "1px solid #f4f4f5", width: 140 }}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <Input
                        value={itemPriceRaw}
                        onChange={(ev) => setItemPriceByPositionId((prev) => ({ ...prev, [p.id]: ev.target.value }))}
                        placeholder=""
                        inputMode="decimal"
                        style={{ textAlign: "right" }}
                      />
                    </td>

                    <td className="ep-positions-cell ep-positions-cell--right" style={{ borderBottom: isExpanded ? "none" : "1px solid #f4f4f5", fontWeight: 800 }}>
                      {formatMoney(quantityPrice)}
                    </td>

                    <td
                      className="ep-positions-cell ep-positions-cell--center"
                      style={{ borderBottom: isExpanded ? "none" : "1px solid #f4f4f5" }}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <div className="ep-positions-actions">
                        <button
                          type="button"
                          onClick={() => {
                            handleConfigurePosition(p.id);
                          }}
                          disabled={isSaving}
                          title="Open configurator"
                          className="ep-positions-action-button ep-positions-action-button--configure"
                          style={{
                            cursor: isSaving ? "not-allowed" : "pointer",
                            opacity: isSaving ? 0.55 : 1,
                          }}
                        >
                          Configure
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void onMovePositionUp(p.id);
                          }}
                          disabled={isSaving || idx === 0}
                          title="Move position up"
                          className="ep-positions-action-button"
                          style={{
                            cursor: isSaving || idx === 0 ? "not-allowed" : "pointer",
                            opacity: isSaving || idx === 0 ? 0.55 : 1,
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void onMovePositionDown(p.id);
                          }}
                          disabled={isSaving || idx === e.positions.length - 1}
                          title="Move position down"
                          className="ep-positions-action-button"
                          style={{
                            cursor: isSaving || idx === e.positions.length - 1 ? "not-allowed" : "pointer",
                            opacity: isSaving || idx === e.positions.length - 1 ? 0.55 : 1,
                          }}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void onDuplicatePosition(p.id);
                          }}
                          disabled={isSaving}
                          title="Duplicate position"
                          className="ep-positions-action-button"
                          style={{
                            cursor: isSaving ? "not-allowed" : "pointer",
                            opacity: isSaving ? 0.55 : 1,
                          }}
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void onDeletePosition(p.id);
                          }}
                          disabled={isSaving}
                          title="Delete position"
                          className="ep-positions-action-button"
                          style={{
                            cursor: isSaving ? "not-allowed" : "pointer",
                            opacity: isSaving ? 0.55 : 1,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td colSpan={9} className="ep-positions-expanded-cell" style={{ borderBottom: "1px solid #f4f4f5" }}>
                        <PositionExpandedPanel p={p} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
