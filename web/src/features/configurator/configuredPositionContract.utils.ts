import type { ConfiguredPositionContract } from "./configuredPositionContract.types";
import {
  isConfiguredPositionContract as isConfiguredPositionContractFromLegacy,
  legacyPositionMetrics,
  legacyPositionToConfiguredContract,
} from "./legacyPositionContractAdapter";

export function isConfiguredPositionContract(value: unknown): value is ConfiguredPositionContract {
  return isConfiguredPositionContractFromLegacy(value);
}

export function getConfiguredPositionContract(position: unknown): ConfiguredPositionContract | null {
  return legacyPositionToConfiguredContract(position);
}

export function describeConfiguredPositionContract(contract: ConfiguredPositionContract): string {
  const operations = contract.layout.fields
    .slice()
    .sort((left, right) => left.row - right.row || left.column - right.column)
    .map((field) => field.operation.replace(/_/g, " "))
    .join(" / ");
  const proof =
    contract.profileProof.proofStatus === "approved_locked"
      ? "approved"
      : contract.profileProof.proofStatus === "accepted_reference"
        ? "accepted reference"
        : contract.profileProof.proofStatus.replace(/_/g, " ");
  return `B92 ${contract.layout.columns}x${contract.layout.rows} • ${operations} • ${contract.dimensions.widthMm} x ${contract.dimensions.heightMm} mm • ${proof}`;
}

export function describePositionForOutput(position: unknown, legacyDescription: string): string {
  const contract = getConfiguredPositionContract(position);
  return contract ? describeConfiguredPositionContract(contract) : legacyDescription;
}

export function getContractAwarePositionMetrics(position: unknown): {
  widthMm: number;
  heightMm: number;
  qty: number;
  itemPrice: number | null;
} {
  return legacyPositionMetrics(position);
}

function evenSplit(total: number, parts: number) {
  const safeParts = Math.max(1, Math.round(parts));
  const base = Math.floor(total / safeParts);
  const remainder = total - base * safeParts;
  return Array.from({ length: safeParts }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function applyConfiguredContractFlatPatch(
  contract: ConfiguredPositionContract,
  patch: Record<string, unknown>
): ConfiguredPositionContract {
  const widthMm = patch.widthMm == null ? contract.dimensions.widthMm : Math.max(1, Number(patch.widthMm || 0));
  const heightMm = patch.heightMm == null ? contract.dimensions.heightMm : Math.max(1, Number(patch.heightMm || 0));
  const colWidthsMm =
    widthMm === contract.dimensions.widthMm
      ? contract.dimensions.colWidthsMm
      : contract.dimensions.splitMode === "equal"
        ? evenSplit(widthMm, contract.layout.columns)
        : contract.dimensions.colWidthsMm;
  const rowHeightsMm =
    heightMm === contract.dimensions.heightMm
      ? contract.dimensions.rowHeightsMm
      : contract.dimensions.splitMode === "equal"
        ? evenSplit(heightMm, contract.layout.rows)
        : contract.dimensions.rowHeightsMm;
  const quantity = patch.qty == null ? contract.estimateContext.quantity : Math.max(1, Number(patch.qty || 1));
  const roomName = patch.roomName == null ? contract.estimateContext.roomName : String(patch.roomName ?? "");
  const positionRef = patch.positionRef == null ? contract.identity.positionRef : String(patch.positionRef ?? "");
  const itemPrice = patch.itemPrice == null ? contract.pricing.itemPrice : Number(patch.itemPrice || 0);
  return {
    ...contract,
    identity: {
      ...contract.identity,
      positionRef,
      updatedAt: new Date().toISOString(),
    },
    estimateContext: {
      ...contract.estimateContext,
      quantity,
      roomName,
    },
    dimensions: {
      ...contract.dimensions,
      widthMm,
      heightMm,
      colWidthsMm,
      rowHeightsMm,
    },
    pricing: {
      ...contract.pricing,
      pricingMode: itemPrice && itemPrice > 0 ? "manual" : contract.pricing.pricingMode,
      itemPrice,
    },
    compatibilityProjection: {
      ...contract.compatibilityProjection,
      widthMm,
      heightMm,
      colWidthsMm,
      rowHeightsMm,
    },
  };
}
