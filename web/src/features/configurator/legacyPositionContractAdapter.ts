import type { ConfiguredPositionContract } from "./configuredPositionContract.types";

export type LegacyPositionMetrics = {
  widthMm: number;
  heightMm: number;
  qty: number;
  itemPrice: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function toNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function isConfiguredPositionContract(value: unknown): value is ConfiguredPositionContract {
  if (!isRecord(value)) return false;
  const product = isRecord(value.product) ? value.product : null;
  return value.schemaVersion === 1 && value.source === "b92_configurator" && product?.systemCode === "B92";
}

export function legacyPositionToConfiguredContract(position: unknown): ConfiguredPositionContract | null {
  if (!isRecord(position)) return null;
  return isConfiguredPositionContract(position.configuredContract) ? position.configuredContract : null;
}

export function legacyPositionMetrics(position: unknown): LegacyPositionMetrics {
  const contract = legacyPositionToConfiguredContract(position);
  const record = isRecord(position) ? position : {};
  return {
    widthMm: contract?.dimensions.widthMm ?? toNumber(record.widthMm, 0),
    heightMm: contract?.dimensions.heightMm ?? toNumber(record.heightMm, 0),
    qty: contract?.estimateContext.quantity ?? toNumber(record.qty, 1),
    itemPrice: contract?.pricing.itemPrice ?? (record.itemPrice == null ? null : toNumber(record.itemPrice, 0)),
  };
}
