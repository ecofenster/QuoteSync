import React from "react";
import { appShellMenuItems } from "./appShellNav";

type Props = {
  title?: string;
  children: React.ReactNode;
  onMenuClick?: (key: string) => void;
};

export default function AppShell(props: Props) {
  const { title = "QuoteSync", children, onMenuClick } = props;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "#ffffff",
          borderBottom: "1px solid #e4e4e7",
        }}
      >
        <div
          style={{
            maxWidth: 1600,
            margin: "0 auto",
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, color: "#18181b" }}><img src="/logo.png" style={{height:32}} /> </div>

          <nav style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            {appShellMenuItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onMenuClick?.(item.key)}
                style={{
                  borderRadius: 12,
                  border: "1px solid #e4e4e7",
                  background: "#ffffff",
                  color: "#18181b",
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

     <main style={{ width: '100%', padding: 16 }}>{children}</main>
    </div>
  );
}