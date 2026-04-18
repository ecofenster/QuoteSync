export type SystemSettingValue = unknown;

export type SystemSettingRecord = {
  key: string;
  value: SystemSettingValue;
  group_name: string | null;
  updated_at: string | null;
};

export type GroupedSystemSettings = Record<string, SystemSettingRecord[]>;