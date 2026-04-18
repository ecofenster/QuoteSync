import React from "react";

export default function ClientPortalPlaceholderPage() {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid #e4e4e7",
        background: "#ffffff",
        padding: 20,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>Client Portal</div>
      <div style={{ fontSize: 14, color: "#3f3f46" }}>
        Placeholder foundation for the future client-facing portal area.
      </div>
    </div>
  );
}