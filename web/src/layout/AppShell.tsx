import React from "react";
import QuoteSyncLogo from "../components/QuoteSyncLogo";
import ThemeSelector from "../components/ThemeSelector";
import { appShellMenuItems } from "./appShellNav";
import "./AppShell.css";

type Props = {
  title?: string;
  children: React.ReactNode;
  onMenuClick?: (key: string) => void;
};

export default function AppShell(props: Props) {
  const { title = "QuoteSync", children, onMenuClick } = props;

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__inner">
          <div className="app-shell__brand">
            <QuoteSyncLogo alt={title} />
          </div>

          <div className="app-shell__actions">
            <nav className="app-shell__nav">
              {appShellMenuItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onMenuClick?.(item.key)}
                  className="app-shell__nav-button ui-button"
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <ThemeSelector className="app-shell__theme-selector" />
          </div>
        </div>
      </header>

      <main className="app-shell__main">{children}</main>
    </div>
  );
}
