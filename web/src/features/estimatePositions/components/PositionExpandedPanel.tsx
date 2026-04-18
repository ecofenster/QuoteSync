import React from "react";

type Props = {
  p: any;
};

export default function PositionExpandedPanel(props: Props) {
  const { p } = props;

  return (
    <div
      style={{
        borderTop: "1px solid #e4e4e7",
        background: "#fafafa",
        padding: 14,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, color: "#18181b" }}>
        Advanced options coming soon
      </div>
      <div style={{ fontSize: 12, color: "#52525b" }}>
        Position: {p.positionRef || "—"} {p.roomName ? `• ${p.roomName}` : ""}
      </div>
    </div>
  );
}
