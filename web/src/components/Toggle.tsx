import React from "react";

type ToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  labelOn?: string;
  labelOff?: string;
};

export default function Toggle({
  value,
  onChange,
  labelOn = "Yes",
  labelOff = "No",
}: ToggleProps) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <span>{value ? labelOn : labelOff}</span>

      <div
        style={{
          position: "relative",
          width: 48,
          height: 26,
        }}
      >
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.currentTarget.checked)}
          style={{
            opacity: 0,
            width: 0,
            height: 0,
          }}
        />

        <span
          style={{
            position: "absolute",
            inset: 0,
            background: value ? "#111827" : "#e5e7eb",
            borderRadius: 999,
            transition: "background 0.2s",
          }}
        />

        <span
          style={{
            position: "absolute",
            top: 3,
            left: value ? 26 : 3,
            width: 20,
            height: 20,
            background: "#fff",
            borderRadius: "50%",
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </div>
    </label>
  );
}