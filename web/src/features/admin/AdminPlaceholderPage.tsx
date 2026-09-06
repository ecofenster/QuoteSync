import React, { useEffect, useMemo, useState } from "react";
import Toggle from "../../components/Toggle";
import { getGroupedSettings } from "../../services/settings/settingsService";
import { apiFetch } from "../../services/api/apiClient";
import type { GroupedSystemSettings, SystemSettingRecord } from "../../types/systemSettings";
import { H3, Small } from "../estimatePicker/tabs/shared";
import AdminConfiguratorCatalogWorkspace from "./AdminConfiguratorCatalogWorkspace";
import AdminFeatureControls from "./AdminFeatureControls";
import AdminIntegrationsPanel from "./AdminIntegrationsPanel";
import AdminThemeColoursPanel from "./AdminThemeColoursPanel";
import AdminSupplierCommercialDefaults from "./AdminSupplierCommercialDefaults";
import AdminCommercialMarginPanel from "./AdminCommercialMarginPanel";
import AdminSiteVisitTravelDefaults from "./AdminSiteVisitTravelDefaults";
import AdminProjectCostingMarkupDefaults from "./AdminProjectCostingMarkupDefaults";
import AdminImportCustomsDefaults from "./AdminImportCustomsDefaults";
import AdminCustomerViewControls from "./AdminCustomerViewControls";
import AdminSectionTabs from "./AdminSectionTabs";
import DevelopmentRoadmapWorkspace from "../developmentRoadmap/DevelopmentRoadmapWorkspace";
import CalculatorAdminCatalogue from "../projectCalculatorLab/CalculatorAdminCatalogue";
import AdminManufacturerDocuments from "./AdminManufacturerDocuments";
import "./AdminPlaceholderPage.css";

type AdminSectionKey =
  | "settings"
  | "project_preferences"
  | "feature_controls"
  | "installation"
  | "configurator_controls"
  | "branding"
  | "integrations"
  | "supplier_defaults"
  | "manufacturer_documents"
  | "development";

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
  { key: "project_preferences", label: "Project Preferences", description: "Project Calculator, commercial presentation and project defaults." },
  { key: "feature_controls", label: "Feature Controls", description: "Enable or disable major system capabilities." },
  { key: "installation", label: "Installation", description: "Installation companies, installers, teams, programme rules and rates." },
  { key: "configurator_controls", label: "Configurator Controls", description: "Manufacturers, window types, and render-definition controls." },
  { key: "branding", label: "Branding", description: "Brand identity, logo, colours, and document identity." },
  { key: "integrations", label: "Integrations", description: "Maps, what3words, and future third-party services." },
  { key: "supplier_defaults", label: "Supplier / Product Defaults", description: "Supplier products, pricing, settlement, discounts and packages." },
  { key: "manufacturer_documents", label: "Manufacturer / System Documents", description: "Canonical certificates and technical drawing records." },
  { key: "development", label: "Development", description: "QuoteSuite Roadmap and future internal development tools." },
];

const editableKeys = new Set<string>([
  "system.loadDefaults",
  "system.loadDemoClients",
  "system.loadDemoEstimates",
  "system.loadDemoForecast",
  "references.clientPrefix",
  "references.estimatePrefix",
]);

const settingLabels: Record<string, string> = {
  "system.loadDefaults": "Load defaults for new Estimates",
  "system.loadDemoClients": "Load demo Clients",
  "system.loadDemoEstimates": "Load demo Estimates",
  "system.loadDemoForecast": "Load demo Forecast",
  "references.clientPrefix": "Client reference prefix",
  "references.estimatePrefix": "Estimate reference prefix",
};

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
    <div className="admin-card admin-card--content ui-card">
      <div className="admin-section-title">{title}</div>
      <div className="admin-body-copy admin-copy-width">{description}</div>
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
  const [textInput, setTextInput] = useState(typeof setting.value === "string" ? setting.value : "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setLocalValue(setting.value);
    setWidthInput(isDimensionsValue(setting.value) ? toNumberInputValue(setting.value.width) : "");
    setHeightInput(isDimensionsValue(setting.value) ? toNumberInputValue(setting.value.height) : "");
    setTextInput(typeof setting.value === "string" ? setting.value : "");
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
      <div className="qs-migrated-17">
        <div className="admin-setting-key">{settingLabels[setting.key] ?? formatGroupTitle(setting.key)}</div>
        <div className="admin-setting-updated">
          Updated: {setting.updated_at || "Unknown"}
        </div>
      </div>

      {!editable ? <ReadOnlyValue value={localValue} /> : null}

      {editable && normalizedBoolean ? (
        <div
          className="admin-flex-row qs-migrated-145"
        >
          <div className="admin-setting-label">Enabled</div>
          <Toggle
            value={!!normalizedBoolean.enabled}
            onChange={(value) => {
              const nextValue = typeof localValue === "object" && localValue !== null ? { enabled: value } : value;
              setLocalValue(nextValue);
              void save(nextValue);
            }}
          />
        </div>
      ) : null}

      {editable && typeof localValue === "string" ? (
        <div className="admin-flex-row">
          <input className="admin-input ui-input" aria-label={settingLabels[setting.key] ?? setting.key} value={textInput} onChange={(event) => setTextInput(event.currentTarget.value)} />
          <button type="button" className="ui-button ui-button--primary" disabled={isSaving || !textInput.trim()} onClick={() => void save(textInput.trim())}>{isSaving ? "Saving…" : "Save"}</button>
        </div>
      ) : null}

      {editable && !normalizedBoolean && typeof localValue !== "string" && setting.key !== "configurator.defaultDimensions" ? (
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
        <div className="qs-migrated-26">
          <div className="admin-dimensions-grid">
            <label className="qs-migrated-57">
              <span className="admin-setting-label">Default width (mm)</span>
              <input
                type="number"
                value={widthInput}
                onChange={(e) => setWidthInput(e.currentTarget.value)}
                className="admin-input ui-input"
              />
            </label>

            <label className="qs-migrated-57">
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
  const [settingsTab, setSettingsTab] = useState<"data" | "references">("data");
  const [projectPreferencesTab, setProjectPreferencesTab] = useState<"commercial" | "import_customs" | "customer" | "survey">("commercial");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (activeSection !== "settings") return;
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
  }, [activeSection]);

  const coreSettings = useMemo(() => Object.values(settingsByGroup).flat().filter((setting) => settingsTab === "data" ? setting.key.startsWith("system.") : setting.key.startsWith("references.")), [settingsByGroup, settingsTab]);

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
      <div className="admin-page-stack">
        <div className="admin-card admin-card--content ui-card">
          <div className="admin-page-title">Admin</div>
          <div className="admin-body-copy admin-copy-width">
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

        {!isLoading && !errorMessage && coreSettings.length === 0 ? (
          <div className="admin-card admin-status-card ui-card">No settings found.</div>
        ) : null}

        {!isLoading && !errorMessage ? <AdminSectionTabs tabs={[{id:"data",label:"Data & Demo"},{id:"references",label:"Reference Numbering"}]} activeTab={settingsTab} onChange={setSettingsTab} label="Settings sections" /> : null}
        {!isLoading && !errorMessage && coreSettings.length > 0 ? (
          <section className="admin-card admin-card--section ui-card" role="tabpanel">
            <div className="admin-group-title">{settingsTab === "data" ? "Data & Demo" : "Reference Numbering"}</div>
            <div className="admin-page-stack">{coreSettings.map((setting) => <SettingRow key={setting.key} setting={setting} onSaved={handleSavedSetting} />)}</div>
          </section>
        ) : null}
      </div>
    ) : activeSection === "project_preferences" ? (
      <div className="admin-page-stack">
        <div className="admin-card admin-card--content ui-card">
          <div className="admin-page-title">Project Preferences</div>
          <div className="admin-body-copy admin-copy-width">
            Configure default loading behaviour for QuoteSuite.
          </div>
        </div>

        <AdminSectionTabs tabs={[{id:"commercial",label:"Commercial"},{id:"import_customs",label:"Import / Customs"},{id:"customer",label:"Customer View"},{id:"survey",label:"Survey / Site Visit"}]} activeTab={projectPreferencesTab} onChange={setProjectPreferencesTab} label="Project Preferences sections" />
        <div role="tabpanel">
          {projectPreferencesTab === "commercial" ? <><AdminCommercialMarginPanel /><AdminProjectCostingMarkupDefaults /></> : null}
          {projectPreferencesTab === "import_customs" ? <AdminImportCustomsDefaults /> : null}
          {projectPreferencesTab === "customer" ? <AdminCustomerViewControls /> : null}
          {projectPreferencesTab === "survey" ? <AdminSiteVisitTravelDefaults /> : null}
        </div>
      </div>
    ) : activeSection === "feature_controls" ? (
      <AdminFeatureControls />
    ) : activeSection === "installation" ? (
      <CalculatorAdminCatalogue />
    ) : activeSection === "configurator_controls" ? (
      <AdminConfiguratorCatalogWorkspace
        initialTab={props.initialConfiguratorTab}
        initialWindowTypesCategory={props.initialWindowTypesCategory}
        onRenderWorkspaceActive={setConfiguratorRenderWorkspaceActive}
      />
    ) : activeSection === "branding" ? (
      <AdminThemeColoursPanel />
    ) : activeSection === "integrations" ? (
      <AdminIntegrationsPanel />
    ) : activeSection === "development" ? (
      <DevelopmentRoadmapWorkspace />
    ) : activeSection === "manufacturer_documents" ? (
      <AdminManufacturerDocuments />
    ) : (
      <AdminSupplierCommercialDefaults />
    );

  const hideAdminSidebar = activeSection === "configurator_controls" && configuratorRenderWorkspaceActive;

  return (
    <div
      className="admin-shell"
      data-sidebar={hideAdminSidebar ? "hidden" : "visible"}
    >
      {!hideAdminSidebar ? (
      <div className="admin-card admin-sidebar-card ui-card">
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



