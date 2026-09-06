import React from "react";
import QuoteSyncLogo from "../components/QuoteSyncLogo";
import ThemeSelector from "../components/ThemeSelector";
import VisualThemeLabSelector from "../components/VisualThemeLabSelector";
import TextSizeSelector from "../components/TextSizeSelector";
import { RuntimeHealthProvider } from "../features/runtimeHealth/RuntimeHealthContext";
import { RuntimeHealthBadge, RuntimeHealthNotice } from "../features/runtimeHealth/RuntimeHealthStatus";
import { appShellMenuItems } from "./appShellNav";
import "./AppShell.css";

type Props = {
  title?: string;
  children: React.ReactNode;
  onMenuClick?: (key: string) => void;
  activeNavKey?: string;
};

function AppShellFrame(props: Props) {
  const { title = "QuoteSuite", children, onMenuClick, activeNavKey = "" } = props;

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__inner">
          <div className="app-shell__brand">
            <QuoteSyncLogo alt={title} />
          </div>

          <div className="app-shell__actions">
            <nav className="app-shell__nav">
              {appShellMenuItems.map((item) => {
                if (item.children) {
                  return (
                    <details key={item.key} className="app-shell__nav-menu">
                      <summary
                        className="app-shell__nav-button ui-button"
                        data-state={activeNavKey === item.key ? "active" : undefined}
                      >
                        {item.label}
                      </summary>
                      <div className="app-shell__nav-menu-panel">
                        {item.children.map((child) => (
                          <button
                            key={child.key}
                            type="button"
                            onClick={(event) => {
                              onMenuClick?.(child.key);
                              event.currentTarget.closest("details")?.removeAttribute("open");
                            }}
                            className="app-shell__nav-menu-item"
                          >
                            {child.label}
                          </button>
                        ))}
                      </div>
                    </details>
                  );
                }

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onMenuClick?.(item.key)}
                    className="app-shell__nav-button ui-button"
                    data-state={activeNavKey === item.key ? "active" : undefined}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <RuntimeHealthBadge />
            <VisualThemeLabSelector />
            <ThemeSelector className="app-shell__theme-selector" />
            <TextSizeSelector />
          </div>
        </div>
        <RuntimeHealthNotice />
      </header>

      <main className="app-shell__main">{children}</main>
    </div>
  );
}

export default function AppShell(props: Props) {
  return (
    <RuntimeHealthProvider>
      <AppShellFrame {...props} />
    </RuntimeHealthProvider>
  );
}
