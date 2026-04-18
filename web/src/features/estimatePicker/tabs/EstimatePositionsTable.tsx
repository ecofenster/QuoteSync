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

const selectStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 14,
  border: "1px solid #e4e4e7",
  background: "#fff",
  color: "#111827",
  padding: "0 12px",
  fontSize: 14,
  fontWeight: 700,
};

const actionButtonStyle: React.CSSProperties = {
  minWidth: 34,
  height: 34,
  borderRadius: 10,
  border: "1px solid #e4e4e7",
  background: "#fff",
  color: "#111827",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const configureButtonStyle: React.CSSProperties = {
  height: 34,
  borderRadius: 10,
  border: "1px solid #e4e4e7",
  background: "#fff",
  color: "#111827",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  padding: "0 10px",
  whiteSpace: "nowrap",
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
    <div
      style={{
        border: "1px solid #e4e4e7",
        borderRadius: 14,
        background: "#fff",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: 12,
          borderBottom: "1px solid #e4e4e7",
          background: "#fafafa",
          display: "flex",
          alignItems: "end",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a" }}>Quick add</div>
          <select value={quickAddPositionType} onChange={(e) => setQuickAddPositionType(e.target.value as "Window" | "Door")} style={selectStyle} disabled={isSaving}>
            <option value="Window">Window</option>
            <option value="Door">Door</option>
          </select>
        </div>

        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a" }}>Type</div>
          <select value={quickAddInsertion} onChange={(e) => setQuickAddInsertion(e.target.value)} style={selectStyle} disabled={isSaving}>
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
          style={{
            height: 40,
            borderRadius: 18,
            border: "none",
            background: "#18181b",
            color: "#fff",
            padding: "0 16px",
            fontSize: 14,
            fontWeight: 800,
            cursor: isSaving ? "not-allowed" : "pointer",
            opacity: isSaving ? 0.55 : 1,
          }}
        >
          Add Position
        </button>

        <div style={{ fontSize: 12, color: "#71717a", fontWeight: 700 }}>
          {isSaving ? "Saving changes..." : "Changes save on blur"}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1320, background: "#fff" }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              <th style={{ textAlign: "left", padding: 10, fontSize: 12, borderBottom: "1px solid #e4e4e7", position: "sticky", top: 0, zIndex: 2, background: "#fafafa", width: 42 }}></th>
              <th style={{ textAlign: "left", padding: 10, fontSize: 12, borderBottom: "1px solid #e4e4e7", position: "sticky", top: 0, zIndex: 2, background: "#fafafa", width: 150 }}>Reference</th>
              <th style={{ textAlign: "left", padding: 10, fontSize: 12, borderBottom: "1px solid #e4e4e7", position: "sticky", top: 0, zIndex: 2, background: "#fafafa", width: 170 }}>Room</th>
              <th style={{ textAlign: "left", padding: 10, fontSize: 12, borderBottom: "1px solid #e4e4e7", position: "sticky", top: 0, zIndex: 2, background: "#fafafa" }}>Picture</th>
              <th style={{ textAlign: "left", padding: 10, fontSize: 12, borderBottom: "1px solid #e4e4e7", position: "sticky", top: 0, zIndex: 2, background: "#fafafa", minWidth: 260 }}>Brief description</th>
              <th style={{ textAlign: "right", padding: 10, fontSize: 12, borderBottom: "1px solid #e4e4e7", position: "sticky", top: 0, zIndex: 2, background: "#fafafa", width: 90 }}>Qty</th>
              <th style={{ textAlign: "right", padding: 10, fontSize: 12, borderBottom: "1px solid #e4e4e7", position: "sticky", top: 0, zIndex: 2, background: "#fafafa", width: 140 }}>Item price</th>
              <th style={{ textAlign: "right", padding: 10, fontSize: 12, borderBottom: "1px solid #e4e4e7", position: "sticky", top: 0, zIndex: 2, background: "#fafafa", width: 130 }}>Quantity price</th>
              <th style={{ textAlign: "center", padding: 10, fontSize: 12, borderBottom: "1px solid #e4e4e7", position: "sticky", top: 0, zIndex: 2, background: "#fafafa", width: 220 }}>Actions</th>
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
                  <tr onClick={() => togglePosition(p.id)} style={{ cursor: "pointer" }} aria-expanded={isExpanded}>
                    <td
                      style={{
                        padding: 10,
                        borderBottom: isExpanded ? "none" : "1px solid #f4f4f5",
                        verticalAlign: "middle",
                        textAlign: "center",
                        width: 42,
                        minWidth: 42,
                        cursor: "pointer",
                      }}
                    >
                      <ExpandToggle expanded={isExpanded} />
                    </td>

                    <td
                      style={{ padding: 10, borderBottom: isExpanded ? "none" : "1px solid #f4f4f5", verticalAlign: "middle" }}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <Input
                        value={p.positionRef ?? ""}
                        onChange={(ev) => onUpdatePositionDraft(p.id, { positionRef: ev.target.value })}
                        onBlur={() => commitField(p.id)}
                      />
                    </td>

                    <td
                      style={{ padding: 10, borderBottom: isExpanded ? "none" : "1px solid #f4f4f5", verticalAlign: "middle" }}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <Input
                        value={p.roomName ?? ""}
                        onChange={(ev) => onUpdatePositionDraft(p.id, { roomName: ev.target.value })}
                        onBlur={() => commitField(p.id)}
                      />
                    </td>

                    <td style={{ padding: 10, borderBottom: isExpanded ? "none" : "1px solid #f4f4f5", verticalAlign: "middle" }}>
                      <PositionPreview position={p} />
                    </td>

                    <td style={{ padding: 10, borderBottom: isExpanded ? "none" : "1px solid #f4f4f5", verticalAlign: "middle" }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 700 }}>{positionDescription(p)}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={(ev) => ev.stopPropagation()}>
                          <Input
                            value={String(p.widthMm ?? "")}
                            onChange={(ev) => onUpdatePositionDraft(p.id, { widthMm: Number(ev.target.value || 0) })}
                            onBlur={() => commitField(p.id)}
                            inputMode="numeric"
                            style={{ width: 90 }}
                          />
                          <span style={{ fontSize: 12, color: "#71717a" }}>×</span>
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
                      style={{ padding: 10, borderBottom: isExpanded ? "none" : "1px solid #f4f4f5", verticalAlign: "middle", textAlign: "right" }}
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
                      style={{ padding: 10, borderBottom: isExpanded ? "none" : "1px solid #f4f4f5", verticalAlign: "middle", textAlign: "right", width: 140 }}
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

                    <td style={{ padding: 10, borderBottom: isExpanded ? "none" : "1px solid #f4f4f5", verticalAlign: "middle", textAlign: "right", fontWeight: 800 }}>
                      {formatMoney(quantityPrice)}
                    </td>

                    <td
                      style={{ padding: 10, borderBottom: isExpanded ? "none" : "1px solid #f4f4f5", verticalAlign: "middle", textAlign: "center" }}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => {
                            handleConfigurePosition(p.id);
                          }}
                          disabled={isSaving}
                          title="Open configurator"
                          style={{
                            ...configureButtonStyle,
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
                          style={{
                            ...actionButtonStyle,
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
                          style={{
                            ...actionButtonStyle,
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
                          style={{
                            ...actionButtonStyle,
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
                          style={{
                            ...actionButtonStyle,
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
                      <td colSpan={9} style={{ padding: 0, borderBottom: "1px solid #f4f4f5" }}>
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