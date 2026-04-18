import React, { useEffect, useMemo, useState } from "react";
import Toggle from "../../components/Toggle";
import { getGroupedSettings } from "../../services/settings/settingsService";
import { apiFetch } from "../../services/api/apiClient";
import type { GroupedSystemSettings, SystemSettingRecord } from "../../types/systemSettings";
import { H3, Small } from "../estimatePicker/tabs/shared";

type AdminSectionKey =
  | "settings"
  | "project_preferences"
  | "feature_controls"
  | "configurator_controls"
  | "branding"
  | "integrations"
  | "supplier_defaults";

type EditableBooleanValue = {
  enabled: boolean;
};

type EditableDimensionsValue = {
  width: number;
  height: number;
};

const shellCardStyle: React.CSSProperties = {
  borderRadius: 16,
  border: "1px solid #e4e4e7",
  background: "#ffffff",
};

const sectionList: Array<{ key: AdminSectionKey; label: string; description: string }> = [
  { key: "settings", label: "Settings", description: "System-wide settings and feature behaviour." },
  { key: "project_preferences", label: "Project Preferences", description: "Default/demo loading behaviour for QuoteSync projects." },
  { key: "feature_controls", label: "Feature Controls", description: "Enable or disable major system capabilities." },
  { key: "configurator_controls", label: "Configurator Controls", description: "Default configurator behaviour and presentation." },
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
    <pre
      style={{
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontSize: 12,
        lineHeight: 1.5,
        color: "#3f3f46",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
      }}
    >
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
    <div style={{ ...shellCardStyle, padding: 20, display: "grid", gap: 10 }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{title}</div>
      <div style={{ fontSize: 14, color: "#52525b", maxWidth: 820 }}>{description}</div>
      <div
        style={{
          borderRadius: 12,
          border: "1px dashed #d4d4d8",
          background: "#fafafa",
          padding: 14,
          fontSize: 14,
          color: "#52525b",
        }}
      >
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
    <div
      style={{
        borderRadius: 12,
        border: "1px solid #e4e4e7",
        background: "#fafafa",
        padding: 14,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#18181b" }}>{setting.key}</div>
        <div style={{ fontSize: 11, color: "#71717a" }}>
          Updated: {setting.updated_at || "Unknown"}
        </div>
      </div>

      {!editable ? <ReadOnlyValue value={localValue} /> : null}

      {editable && normalizedBoolean ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 13, color: "#3f3f46", fontWeight: 700 }}>Enabled</div>
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
        <div
          style={{
            borderRadius: 10,
            border: "1px solid #fde68a",
            background: "#fffbeb",
            padding: "10px 12px",
            fontSize: 12,
            color: "#92400e",
            display: "grid",
            gap: 8,
          }}
        >
          <div>This setting has an invalid boolean value shape in storage.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                const nextValue = { enabled: false };
                setLocalValue(nextValue);
                void save(nextValue);
              }}
              disabled={isSaving}
              style={{
                borderRadius: 10,
                border: "1px solid #18181b",
                background: "#18181b",
                color: "#fff",
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 800,
                cursor: isSaving ? "default" : "pointer",
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? "Repairing..." : "Repair toggle value"}
            </button>
            <div style={{ fontSize: 12, color: "#a16207" }}>
              Current raw value: {localValue == null ? "null" : JSON.stringify(localValue)}
            </div>
          </div>
        </div>
      ) : null}

      {editable && setting.key === "configurator.defaultDimensions" && (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(160px, 220px))", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#3f3f46", fontWeight: 700 }}>Default width (mm)</span>
              <input
                type="number"
                value={widthInput}
                onChange={(e) => setWidthInput(e.currentTarget.value)}
                style={{
                  height: 40,
                  borderRadius: 10,
                  border: "1px solid #d4d4d8",
                  padding: "0 12px",
                  background: "#fff",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#3f3f46", fontWeight: 700 }}>Default height (mm)</span>
              <input
                type="number"
                value={heightInput}
                onChange={(e) => setHeightInput(e.currentTarget.value)}
                style={{
                  height: 40,
                  borderRadius: 10,
                  border: "1px solid #d4d4d8",
                  padding: "0 12px",
                  background: "#fff",
                }}
              />
            </label>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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
              style={{
                borderRadius: 10,
                border: "1px solid #18181b",
                background: "#18181b",
                color: "#fff",
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 800,
                cursor: isSaving ? "default" : "pointer",
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? "Saving..." : "Save dimensions"}
            </button>

            {isDimensionsValue(localValue) ? (
              <div style={{ fontSize: 12, color: "#52525b" }}>
                Current: {localValue.width} × {localValue.height} mm
              </div>
            ) : null}
          </div>
        </div>
      )}

      {saveError ? (
        <div
          style={{
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            padding: "10px 12px",
            fontSize: 12,
            fontWeight: 700,
            color: "#991b1b",
          }}
        >
          {saveError}
        </div>
      ) : null}
</div>
);
}

export default function AdminPlaceholderPage() {
  const [settingsByGroup, setSettingsByGroup] = useState<GroupedSystemSettings>({});
  const [activeSection, setActiveSection] = useState<AdminSectionKey>("settings");
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
        <div style={{ ...shellCardStyle, padding: 20, display: "grid", gap: 6 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#18181b" }}>Admin</div>
          <div style={{ fontSize: 14, color: "#52525b", maxWidth: 900 }}>
            Proper admin control area. Settings are one part of Admin, and boolean controls use the site toggle component rather than tick boxes.
          </div>
        </div>

        {isLoading ? (
          <div style={{ ...shellCardStyle, padding: 14, fontSize: 14, color: "#3f3f46" }}>Loading settings...</div>
        ) : null}

        {errorMessage ? (
          <div
            style={{
              ...shellCardStyle,
              padding: 14,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              fontSize: 14,
              fontWeight: 700,
              color: "#991b1b",
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage && orderedGroups.length === 0 ? (
          <div style={{ ...shellCardStyle, padding: 14, fontSize: 14, color: "#3f3f46" }}>No settings found.</div>
        ) : null}

        {!isLoading && !errorMessage && orderedGroups.length > 0 ? (
          <div style={{ display: "grid", gap: 16 }}>
            {orderedGroups.map(([groupName, settings]) => (
              <div
                key={groupName}
                style={{
                  ...shellCardStyle,
                  padding: 18,
                  display: "grid",
                  gap: 14,
                }}
              >
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#18181b" }}>
                    {formatGroupTitle(groupName)}
                  </div>
                  <div style={{ fontSize: 12, color: "#71717a" }}>
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
        <div style={{ ...shellCardStyle, padding: 20, display: "grid", gap: 6 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#18181b" }}>Project Preferences</div>
          <div style={{ fontSize: 14, color: "#52525b", maxWidth: 900 }}>
            Configure default loading behaviour for QuoteSync.
          </div>
        </div>

        <div style={{ ...shellCardStyle, padding: 18, display: "grid", gap: 14, maxWidth: 900 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#18181b" }}>Load Defaults</div>
              <div style={{ fontSize: 14, color: "#52525b", maxWidth: 720 }}>
                When enabled, new estimates start with the default supplier, product and technical settings. When disabled, new estimates start blank.
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#18181b" }}>No</div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 900, color: "#18181b" }}>Load Demo Clients</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#18181b" }}>No</div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 900, color: "#18181b" }}>Load Demo Estimates</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#18181b" }}>No</div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 900, color: "#18181b" }}>Load Demo Forecast</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#18181b" }}>No</div>
          </div>
        </div>
      </div>
    ) : activeSection === "feature_controls" ? (
      <AdminSectionPlaceholder
        title="Feature Controls"
        description="Dedicated feature access and capability controls will live here. This phase keeps the main settings section active first."
      />
    ) : activeSection === "configurator_controls" ? (
      <AdminSectionPlaceholder
        title="Configurator Controls"
        description="Configurator-specific admin controls will move here as the configurator becomes settings-driven rather than hardcoded."
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

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "280px minmax(0, 1fr)",
        gap: 16,
        alignItems: "start",
      }}
    >
      <div style={{ ...shellCardStyle, padding: 14, display: "grid", gap: 10, position: "sticky", top: 16 }}>
        <div style={{ fontSize: 12, color: "#71717a", fontWeight: 800, textTransform: "uppercase" }}>
          Admin
        </div>

        {sectionList.map((section) => {
          const active = activeSection === section.key;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => setActiveSection(section.key)}
              style={{
                textAlign: "left",
                borderRadius: 12,
                border: active ? "1px solid #18181b" : "1px solid #e4e4e7",
                background: active ? "#18181b" : "#fff",
                color: active ? "#fff" : "#18181b",
                padding: 12,
                cursor: "pointer",
                display: "grid",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 900 }}>{section.label}</span>
              <span style={{ fontSize: 12, color: active ? "rgba(255,255,255,0.8)" : "#71717a" }}>
                {section.description}
              </span>
            </button>
          );
        })}
      </div>

      <div>{sectionContent}</div>
</div>
);
}