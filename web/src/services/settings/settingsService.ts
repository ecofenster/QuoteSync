import { apiFetch } from "../api/apiClient";
import type { GroupedSystemSettings, SystemSettingRecord } from "../../types/systemSettings";

function safeGroupName(value: string | null | undefined) {
  const next = String(value || "").trim();
  return next || "ungrouped";
}

export async function getAllSettings(): Promise<SystemSettingRecord[]> {
  const data = await apiFetch("/api/settings");
  return Array.isArray(data) ? (data as SystemSettingRecord[]) : [];
}

export async function getGroupedSettings(): Promise<GroupedSystemSettings> {
  const rows = await getAllSettings();

  return rows.reduce((acc, row) => {
    const groupName = safeGroupName(row.group_name);
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(row);
    return acc;
  }, {} as GroupedSystemSettings);
}