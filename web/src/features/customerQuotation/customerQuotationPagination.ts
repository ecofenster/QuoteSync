import type { CustomerQuotationPosition } from "./customerQuotationProjection";

export type CustomerQuotationPositionPage = { positions: CustomerQuotationPosition[]; wide: boolean };

export function requiresFullQuotationPage(position: Pick<CustomerQuotationPosition, "widthMm" | "heightMm" | "specification">) {
  const exceptionallyLarge = position.widthMm >= 4000 || position.heightMm >= 2800;
  const denseSpecification = position.specification.length >= 16;
  return exceptionallyLarge && denseSpecification;
}

export const isWideQuotationPosition = requiresFullQuotationPage;

export function paginateCustomerQuotationPositions(positions: CustomerQuotationPosition[]): CustomerQuotationPositionPage[] {
  const pages: CustomerQuotationPositionPage[] = [];
  for (let index = 0; index < positions.length;) {
    const current = positions[index];
    if (requiresFullQuotationPage(current)) { pages.push({ positions: [current], wide: true }); index += 1; continue; }
    const next = positions[index + 1];
    if (next && !requiresFullQuotationPage(next)) { pages.push({ positions: [current, next], wide: false }); index += 2; continue; }
    pages.push({ positions: [current], wide: false }); index += 1;
  }
  return pages;
}
