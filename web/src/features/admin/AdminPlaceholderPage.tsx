import React, { useEffect, useMemo, useState } from "react";
import Toggle from "../../components/Toggle";
import { getGroupedSettings } from "../../services/settings/settingsService";
import { apiFetch } from "../../services/api/apiClient";
import type { GroupedSystemSettings, SystemSettingRecord } from "../../types/systemSettings";
import { H3, Small } from "../estimatePicker/tabs/shared";
import AdminConfiguratorCatalogWorkspace from "./AdminConfiguratorCatalogWorkspace";
import AdminSupplierQuoteImportBeta from "./AdminSupplierQuoteImportBeta";
import "./AdminPlaceholderPage.css";

type AdminSectionKey =
  | "settings"
  | "project_preferences"
  | "feature_controls"
  | "configurator_controls"
  | "branding"
  | "integrations"
  | "supplier_defaults";

type AdminConfiguratorInitialTab = "manufacturers" | "windowTypes" | "configuratorRender" | "b92Configurator";
type AdminWindowTypesInitialCategory = "windows";

type EditableBooleanValue = {
  enabled: boolean;
};

type EditableDimensionsValue = {
  width: number;
  height: number;
};

const sectionList: Array<{ key: AdminSectionKey; label: string; description: string }> = [
  { key: "settings", label: "Settings", description: "System-wide settings and feature behaviour." },
  { key: "project_preferences", label: "Project Preferences", description: "Default/demo loading behaviour for QuoteSync projects." },
  { key: "feature_controls", label: "Feature Controls", description: "Enable or disable major system capabilities." },
  { key: "configurator_controls", label: "Configurator Controls", description: "Manufacturers, window types, and render-definition controls." },
  { key: "branding", label: "Branding", description: "Brand identity, logo, colours, and document identity." },
  { key: "integrations", label: "Integrations", description: "Maps, what3words, and future third-party services." },
  { key: "supplier_defaults", label: "Supplier / Product Defaults", description: "Future supplier and product control area." },
];

const editableKeys = new Set<string>([
  "configurator.defaultDimensions",
  "configurator.showDimensions",
  "feature.configurator.enabled",
  "feature.clientPortal.enabled",
  "feature.projectCalculator.enabled",
]);

function formatGroupTitle(groupName: string) {
  return groupName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeBooleanValue(value: unknown): EditableBooleanValue | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "object" && value !== null && "enabled" in value) {
    const enabled = (value as { enabled?: unknown }).enabled;
    if (typeof enabled === "boolean") {
      return { enabled };
    }
    if (enabled === "true" || enabled === "false") {
      return { enabled: enabled === "true" };
    }
    if (enabled === 1 || enabled === 0) {
      return { enabled: enabled === 1 };
    }
  }

  if (value === true || value === false) {
    return { enabled: value };
  }

  if (value === "true" || value === "false") {
    return { enabled: value === "true" };
  }

  if (value === 1 || value === 0) {
    return { enabled: value === 1 };
  }

  return null;
}

function isDimensionsValue(value: unknown): value is EditableDimensionsValue {
  return !!value && typeof value === "object" && "width" in value && "height" in value;
}

function toNumberInputValue(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? String(next) : "";
}

function ReadOnlyValue({ value }: { value: unknown }) {
  return (
    <pre className="admin-readonly-value">
      {value == null ? "null" : JSON.stringify(value, null, 2)}
    </pre>
  );
}

function AdminSectionPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="admin-card ui-card" style={{ padding: 20, display: "grid", gap: 10 }}>
      <div className="admin-section-title">{title}</div>
      <div className="admin-body-copy" style={{ maxWidth: 820 }}>{description}</div>
      <div className="admin-placeholder-box">
        This section is planned, but not being implemented in this phase.
      </div>
    </div>
  );
}

function SettingRow({
  setting,
  onSaved,
}: {
  setting: SystemSettingRecord;
  onSaved: (saved: SystemSettingRecord) => void;
}) {
  const editable = editableKeys.has(setting.key);
  const normalizedBoolean = normalizeBooleanValue(setting.value);
  const [localValue, setLocalValue] = useState<unknown>(setting.value);
  const [widthInput, setWidthInput] = useState<string>(
    isDimensionsValue(setting.value) ? toNumberInputValue(setting.value.width) : ""
  );
  const [heightInput, setHeightInput] = useState<string>(
    isDimensionsValue(setting.value) ? toNumberInputValue(setting.value.height) : ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setLocalValue(setting.value);
    setWidthInput(isDimensionsValue(setting.value) ? toNumberInputValue(setting.value.width) : "");
    setHeightInput(isDimensionsValue(setting.value) ? toNumberInputValue(setting.value.height) : "");
    setSaveError("");
  }, [setting.key, setting.updated_at, setting.value]);

  async function save(nextValue: unknown) {
    setIsSaving(true);
    setSaveError("");

    try {
      const saved = (await apiFetch(`/api/settings/${setting.key}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: nextValue }),
      })) as SystemSettingRecord;

      setLocalValue(saved.value);
      if (isDimensionsValue(saved.value)) {
        setWidthInput(toNumberInputValue(saved.value.width));
        setHeightInput(toNumberInputValue(saved.value.height));
      }
      onSaved(saved);
    } catch (error) {
      console.error(`Failed to save setting ${setting.key}`, error);
      setSaveError("Failed to save setting.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="admin-setting-row">
      <div style={{ display: "grid", gap: 4 }}>
        <div className="admin-setting-key">{setting.key}</div>
        <div className="admin-setting-updated">
          Updated: {setting.updated_at || "Unknown"}
        </div>
      </div>

      {!editable ? <ReadOnlyValue value={localValue} /> : null}

      {editable && normalizedBoolean ? (
        <div
          className="admin-flex-row"
          style={{
            justifyContent: "space-between",
          }}
        >
          <div className="admin-setting-label">Enabled</div>
          <Toggle
            value={!!normalizedBoolean.enabled}
            onChange={(value) => {
              const nextValue = { enabled: value };
              setLocalValue(nextValue);
              void save(nextValue);
            }}
          />
        </div>
      ) : null}

      {editable && !normalizedBoolean && setting.key !== "configurator.defaultDimensions" ? (
        <div className="admin-warning-box">
          <div>This setting has an invalid boolean value shape in storage.</div>
          <div className="admin-flex-row">
            <button
              type="button"
              onClick={() => {
                const nextValue = { enabled: false };
                setLocalValue(nextValue);
                void save(nextValue);
              }}
              disabled={isSaving}
              className="admin-primary-button admin-primary-button--small ui-button ui-button--primary"
              style={{
                cursor: isSaving ? "default" : "pointer",
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? "Repairing..." : "Repair toggle value"}
            </button>
            <div className="admin-warning-inline">
              Current raw value: {localValue == null ? "null" : JSON.stringify(localValue)}
            </div>
          </div>
        </div>
      ) : null}

      {editable && setting.key === "configurator.defaultDimensions" && (
        <div style={{ display: "grid", gap: 12 }}>
          <div className="admin-dimensions-grid">
            <label style={{ display: "grid", gap: 6 }}>
              <span className="admin-setting-label">Default width (mm)</span>
              <input
                type="number"
                value={widthInput}
                onChange={(e) => setWidthInput(e.currentTarget.value)}
                className="admin-input ui-input"
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="admin-setting-label">Default height (mm)</span>
              <input
                type="number"
                value={heightInput}
                onChange={(e) => setHeightInput(e.currentTarget.value)}
                className="admin-input ui-input"
              />
            </label>
          </div>

          <div className="admin-flex-row">
            <button
              type="button"
              onClick={() => {
                const nextWidth = Math.max(1, Number(widthInput || 0));
                const nextHeight = Math.max(1, Number(heightInput || 0));
                const nextValue = { width: nextWidth, height: nextHeight };
                setLocalValue(nextValue);
                void save(nextValue);
              }}
              disabled={isSaving}
              className="admin-primary-button ui-button ui-button--primary"
              style={{
                cursor: isSaving ? "default" : "pointer",
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? "Saving..." : "Save dimensions"}
            </button>

            {isDimensionsValue(localValue) ? (
              <div className="admin-body-copy admin-body-copy--small">
                Current: {localValue.width} × {localValue.height} mm
              </div>
            ) : null}
          </div>
        </div>
      )}

      {saveError ? (
        <div className="admin-error-box">
          {saveError}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminPlaceholderPage(props: {
  initialSection?: AdminSectionKey;
  initialConfiguratorTab?: AdminConfiguratorInitialTab;
  initialWindowTypesCategory?: AdminWindowTypesInitialCategory;
} = {}) {
  const [settingsByGroup, setSettingsByGroup] = useState<GroupedSystemSettings>({});
  const [activeSection, setActiveSection] = useState<AdminSectionKey>(props.initialSection ?? "settings");
  const [configuratorRenderWorkspaceActive, setConfiguratorRenderWorkspaceActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const grouped = await getGroupedSettings();
        if (!cancelled) {
          setSettingsByGroup(grouped);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load admin settings", error);
          setErrorMessage("Failed to load settings from the API.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const orderedGroups = useMemo(
    () => Object.entries(settingsByGroup).sort(([a], [b]) => a.localeCompare(b)),
    [settingsByGroup]
  );

  function handleSavedSetting(saved: SystemSettingRecord) {
    setSettingsByGroup((prev) => {
      const next: GroupedSystemSettings = { ...prev };
      const targetGroup = String(saved.group_name || "ungrouped");

      for (const groupName of Object.keys(next)) {
        next[groupName] = next[groupName]
          .filter((row) => row.key !== saved.key)
          .slice();
      }

      if (!next[targetGroup]) {
        next[targetGroup] = [];
      }

      next[targetGroup] = [...next[targetGroup], saved].sort((a, b) => a.key.localeCompare(b.key));

      return next;
    });
  }

  const sectionContent =
    activeSection === "settings" ? (
      <div style={{ display: "grid", gap: 16 }}>
        <div className="admin-card ui-card" style={{ padding: 20, display: "grid", gap: 6 }}>
          <div className="admin-page-title">Admin</div>
          <div className="admin-body-copy" style={{ maxWidth: 900 }}>
            Proper admin control area. Settings are one part of Admin, and boolean controls use the site toggle component rather than tick boxes.
          </div>
        </div>

        {isLoading ? (
          <div className="admin-card admin-status-card ui-card">Loading settings...</div>
        ) : null}

        {errorMessage ? (
          <div className="admin-card admin-status-card admin-status-card--error ui-card">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage && orderedGroups.length === 0 ? (
          <div className="admin-card admin-status-card ui-card">No settings found.</div>
        ) : null}

        {!isLoading && !errorMessage && orderedGroups.length > 0 ? (
          <div style={{ display: "grid", gap: 16 }}>
            {orderedGroups.map(([groupName, settings]) => (
              <div
                key={groupName}
                className="admin-card ui-card"
                style={{
                  padding: 18,
                  display: "grid",
                  gap: 14,
                }}
              >
                <div>
                  <div className="admin-group-title">
                    {formatGroupTitle(groupName)}
                  </div>
                  <div className="admin-setting-updated">
                    {settings.length} setting{settings.length === 1 ? "" : "s"}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {settings.map((setting) => (
                    <SettingRow key={setting.key} setting={setting} onSaved={handleSavedSetting} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    ) : activeSection === "project_preferences" ? (
      <div style={{ display: "grid", gap: 16 }}>
        <div className="admin-card ui-card" style={{ padding: 20, display: "grid", gap: 6 }}>
          <div className="admin-page-title">Project Preferences</div>
          <div className="admin-body-copy" style={{ maxWidth: 900 }}>
            Configure default loading behaviour for QuoteSync.
          </div>
        </div>

        <div className="admin-card ui-card" style={{ padding: 18, display: "grid", gap: 14, maxWidth: 900 }}>
          <div className="admin-project-pref-row">
            <div>
              <div className="admin-group-title">Load Defaults</div>
              <div className="admin-body-copy" style={{ maxWidth: 720 }}>
                When enabled, new estimates start with the default supplier, product and technical settings. When disabled, new estimates start blank.
              </div>
            </div>
            <div className="admin-project-pref-value">No</div>
          </div>

          <div className="admin-project-pref-row">
            <div className="admin-group-title">Load Demo Clients</div>
            <div className="admin-project-pref-value">No</div>
          </div>

          <div className="admin-project-pref-row">
            <div className="admin-group-title">Load Demo Estimates</div>
            <div className="admin-project-pref-value">No</div>
          </div>

          <div className="admin-project-pref-row">
            <div className="admin-group-title">Load Demo Forecast</div>
            <div className="admin-project-pref-value">No</div>
          </div>
        </div>
      </div>
    ) : activeSection === "feature_controls" ? (
      <AdminSupplierQuoteImportBeta />
    ) : activeSection === "configurator_controls" ? (
      <AdminConfiguratorCatalogWorkspace
        initialTab={props.initialConfiguratorTab}
        initialWindowTypesCategory={props.initialWindowTypesCategory}
        onRenderWorkspaceActive={setConfiguratorRenderWorkspaceActive}
      />
    ) : activeSection === "branding" ? (
      <AdminSectionPlaceholder
        title="Branding"
        description="Brand identity, logo management, and document branding will be implemented here in a later phase."
      />
    ) : activeSection === "integrations" ? (
      <AdminSectionPlaceholder
        title="Integrations"
        description="Third-party and API integration management will move here once the first settings-driven controls are in place."
      />
    ) : (
      <AdminSectionPlaceholder
        title="Supplier / Product Defaults"
        description="Supplier and product defaults will be managed here in a later phase once the admin settings foundation is fully established."
      />
    );

  const hideAdminSidebar = activeSection === "configurator_controls" && configuratorRenderWorkspaceActive;

  return (
    <div
      className="admin-shell"
      style={{
        gridTemplateColumns: hideAdminSidebar ? "minmax(0, 1fr)" : "280px minmax(0, 1fr)",
      }}
    >
      {!hideAdminSidebar ? (
      <div className="admin-card admin-sidebar-card ui-card" style={{ padding: 14, position: "sticky", top: 16 }}>
        <div className="admin-sidebar-title">
          Admin
        </div>

        {sectionList.map((section) => {
          const active = activeSection === section.key;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => setActiveSection(section.key)}
              className={active ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
            >
              <span className="admin-nav-button-label">{section.label}</span>
              <span className={active ? "admin-nav-button-desc admin-nav-button-desc--active" : "admin-nav-button-desc"}>
                {section.description}
              </span>
            </button>
          );
        })}
      </div>
      ) : null}

      <div>{sectionContent}</div>
    </div>
  );
}



