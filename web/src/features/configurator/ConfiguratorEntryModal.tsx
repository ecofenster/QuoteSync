import React, { useEffect, useState } from "react";

type Props = {
  open: boolean;
  initialValues: GuidedConfiguratorValues;
  onApply: (values: GuidedConfiguratorValues) => void;
  onCancel: () => void;
};

export type GuidedConfiguratorValues = {
  openingFamily: string;
  openingShape: string;
  widthMm: number;
  heightMm: number;
  additionalHeightMm: number | null;
  hinging: string;
  handleType: string;
  glassType: string;
  frameRebate: string;
  externalCillRequired: boolean;
  externalCillDepthMm: number | null;
};

const OPENING_FAMILY_OPTIONS = ["Window", "Door", "Bifold Door", "Sliding Door", "French Door", "Entrance Door"];
const OPENING_SHAPE_OPTIONS = ["Rectangle", "Top Light", "Shaped Head", "Gable", "Arched", "Other"];
const HINGING_OPTIONS = ["Left hinged", "Right hinged", "Top hung", "Bottom hung", "Fixed", "Sliding", "Bifold"];
const HANDLE_OPTIONS = ["Type 1", "Type 2", "Type 3", "Type 4", "Type 5"];
const GLASS_OPTIONS = ["Double", "Triple"];
const FRAME_REBATE_OPTIONS = ["Standard", "Deep rebate", "Low threshold", "Not set"];
const INPUT_STYLE: React.CSSProperties = {
  height: 42,
  borderRadius: 12,
  border: "1px solid #e4e4e7",
  padding: "0 12px",
  background: "#fff",
  fontSize: 14,
  color: "#18181b",
  width: "100%",
};
const LABEL_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#3f3f46",
};

export default function ConfiguratorEntryModal(props: Props) {
  const { open, initialValues, onApply, onCancel } = props;
  const [values, setValues] = useState<GuidedConfiguratorValues>(initialValues);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues, open]);

  if (!open) return null;

  function update<K extends keyof GuidedConfiguratorValues>(key: K, value: GuidedConfiguratorValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleApply() {
    onApply({
      ...values,
      widthMm: Math.max(300, Number(values.widthMm || 0)),
      heightMm: Math.max(300, Number(values.heightMm || 0)),
      additionalHeightMm: values.additionalHeightMm && Number(values.additionalHeightMm) > 0 ? Number(values.additionalHeightMm) : null,
      externalCillDepthMm: values.externalCillRequired && values.externalCillDepthMm && Number(values.externalCillDepthMm) > 0
        ? Number(values.externalCillDepthMm)
        : null,
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(24,24,27,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(1040px, 96vw)",
          maxHeight: "92vh",
          overflow: "auto",
          borderRadius: 18,
          border: "1px solid #e4e4e7",
          background: "#fff",
          padding: 18,
          boxShadow: "0 20px 50px rgba(0,0,0,0.22)",
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#18181b" }}>Guided configurator setup</div>
          <div style={{ fontSize: 13, color: "#71717a" }}>
            The new configurator starts with guided questions before the detailed layout stage.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={LABEL_STYLE}>Opening family</div>
            <select value={values.openingFamily} onChange={(e) => update("openingFamily", e.currentTarget.value)} style={INPUT_STYLE}>
              {OPENING_FAMILY_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={LABEL_STYLE}>Shape</div>
            <select value={values.openingShape} onChange={(e) => update("openingShape", e.currentTarget.value)} style={INPUT_STYLE}>
              {OPENING_SHAPE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={LABEL_STYLE}>Width (mm)</div>
            <input type="number" value={String(values.widthMm)} onChange={(e) => update("widthMm", Number(e.currentTarget.value || 0))} style={INPUT_STYLE} />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={LABEL_STYLE}>Height (mm)</div>
            <input type="number" value={String(values.heightMm)} onChange={(e) => update("heightMm", Number(e.currentTarget.value || 0))} style={INPUT_STYLE} />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={LABEL_STYLE}>Additional short height (mm)</div>
            <input type="number" value={String(values.additionalHeightMm ?? "")} onChange={(e) => update("additionalHeightMm", e.currentTarget.value ? Number(e.currentTarget.value) : null)} style={INPUT_STYLE} />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={LABEL_STYLE}>Hinging / opening behaviour</div>
            <select value={values.hinging} onChange={(e) => update("hinging", e.currentTarget.value)} style={INPUT_STYLE}>
              {HINGING_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={LABEL_STYLE}>Handle</div>
            <select value={values.handleType} onChange={(e) => update("handleType", e.currentTarget.value)} style={INPUT_STYLE}>
              {HANDLE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={LABEL_STYLE}>Glass</div>
            <select value={values.glassType} onChange={(e) => update("glassType", e.currentTarget.value)} style={INPUT_STYLE}>
              {GLASS_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={LABEL_STYLE}>Frame rebate</div>
            <select value={values.frameRebate} onChange={(e) => update("frameRebate", e.currentTarget.value)} style={INPUT_STYLE}>
              {FRAME_REBATE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700, color: "#18181b", marginTop: 26 }}>
              <input
                type="checkbox"
                checked={values.externalCillRequired}
                onChange={(e) => update("externalCillRequired", e.currentTarget.checked)}
              />
              External cill required
            </label>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={LABEL_STYLE}>External cill depth (mm)</div>
            <input
              type="number"
              value={String(values.externalCillDepthMm ?? "")}
              onChange={(e) => update("externalCillDepthMm", e.currentTarget.value ? Number(e.currentTarget.value) : null)}
              style={{ ...INPUT_STYLE, background: values.externalCillRequired ? "#fff" : "#fafafa", color: values.externalCillRequired ? "#18181b" : "#a1a1aa" }}
              disabled={!values.externalCillRequired}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              borderRadius: 18,
              border: "1px solid #e4e4e7",
              background: "#fff",
              color: "#3f3f46",
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            style={{
              borderRadius: 18,
              border: "none",
              background: "#18181b",
              color: "#fff",
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Start configurator
          </button>
        </div>
      </div>
    </div>
  );
}