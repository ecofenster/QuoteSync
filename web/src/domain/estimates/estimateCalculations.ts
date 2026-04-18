export function estimateTotals(e: any) {
  const positions = e.positions ?? [];

  const totalSquareMetres = positions.reduce(
    (sum: number, p: any) =>
      sum +
      ((Number(p.widthMm || 0) * Number(p.heightMm || 0)) / 1000000) *
        Math.max(1, Number(p.qty || 1)),
    0
  );

  const totalLinearMetres = positions.reduce(
    (sum: number, p: any) =>
      sum +
      (((2 * Number(p.widthMm || 0)) +
        2 * Number(p.heightMm || 0)) /
        1000) *
        Math.max(1, Number(p.qty || 1)),
    0
  );

  const totalQty = positions.reduce(
    (sum: number, p: any) => sum + Math.max(1, Number(p.qty || 1)),
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
    return sum + (Number.isFinite(value) ? value : 0) * Math.max(1, Number(p.qty || 1));
  }, 0);
}