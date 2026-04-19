import React from "react";
import "./Toggle.css";

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
    <label className="toggle">
      <span>{value ? labelOn : labelOff}</span>

      <div className="toggle__track-wrap">
        <input
          className="toggle__input"
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.currentTarget.checked)}
        />

        <span
          className="toggle__track"
          style={{
            background: value ? "#111827" : "#e5e7eb",
          }}
        />

        <span
          className="toggle__thumb"
          style={{
            left: value ? 26 : 3,
          }}
        />
      </div>
    </label>
  );
}
