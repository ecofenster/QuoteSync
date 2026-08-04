import { getContractAwarePositionMetrics } from "../../features/configurator/configuredPositionContract.utils";

export function estimateTotals(e: any) {
  const positions = e.positions ?? [];

  const totalSquareMetres = positions.reduce(
    (sum: number, p: any) => {
      const metrics = getContractAwarePositionMetrics(p);
      return sum + ((metrics.widthMm * metrics.heightMm) / 1000000) * Math.max(1, metrics.qty);
    },
    0
  );

  const totalLinearMetres = positions.reduce(
    (sum: number, p: any) => {
      const metrics = getContractAwarePositionMetrics(p);
      return sum + (((2 * metrics.widthMm) + 2 * metrics.heightMm) / 1000) * Math.max(1, metrics.qty);
    },
    0
  );

  const totalQty = positions.reduce(
    (sum: number, p: any) => sum + Math.max(1, getContractAwarePositionMetrics(p).qty),
    0
  );

  return { totalSquareMetres, totalLinearMetres, totalQty };
}

export function estimateCostTotal(
  e: any,
  itemPriceByPositionId?: Record<string, string>
) {
  return (e.positions ?? []).reduce((sum: number, p: any) => {
    const raw = itemPriceByPositionId?.[p.id] ?? String(p.itemPrice ?? "");
    const value = Number(raw || 0);
    return sum + (Number.isFinite(value) ? value : 0) * Math.max(1, getContractAwarePositionMetrics(p).qty);
  }, 0);
}
