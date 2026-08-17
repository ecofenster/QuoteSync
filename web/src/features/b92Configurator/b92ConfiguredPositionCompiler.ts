import type {
  ConfiguredPositionContract,
  ConfiguredPositionContractField,
  ConfiguredPositionContractJunction,
  ConfiguredPositionFieldOperation,
} from "../configurator/configuredPositionContract.types";
import { getConfiguredPositionContract } from "../configurator/configuredPositionContract.utils";
import type {
  B92ConfiguratorFieldOperation,
  B92ConfiguratorPromotedViewManifestEntry,
  B92ConfiguratorState,
  B92ConfiguratorStructureState,
} from "./b92Configurator.types";
import {
  getB92MappedProofFamilyId,
  getB92ProductionManifestEntry,
  mapB92ProofEntryForFamily,
} from "./b92ConfiguratorProofMapping";
import { createB92DefaultConfiguratorState } from "./b92ConfiguratorState";
import {
  getB92ContractProofStatus,
  getB92ProofManifestEntry,
  isB92ProductionProofEntrySupported,
} from "./b92ProofManifest";

export type B92ContractCompileContext = {
  clientId: string;
  estimateId: string;
  positionId: string;
  positionRef: string;
  quantity: number;
  roomName: string;
  itemPrice?: number | null;
  useEstimateDefaults?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type B92ContractCompileResult =
  | { ok: true; contract: ConfiguredPositionContract }
  | { ok: false; errors: string[] };

function operationToContractOperation(operation: B92ConfiguratorFieldOperation): ConfiguredPositionFieldOperation {
  if (operation === "fixed-sash") return "fixed_sash";
  if (operation === "tilt-turn-left") return "tilt_turn_left";
  if (operation === "tilt-turn-right") return "tilt_turn_right";
  if (operation === "turn-left") return "turn_left";
  if (operation === "turn-right") return "turn_right";
  if (operation === "tilt") return "tilt";
  return "fixed";
}

function handingForOperation(operation: ConfiguredPositionFieldOperation): "left" | "right" | "center" | null {
  if (operation === "tilt_turn_left" || operation === "turn_left") return "left";
  if (operation === "tilt_turn_right" || operation === "turn_right") return "right";
  return null;
}

function insertionForOperation(operation: ConfiguredPositionFieldOperation) {
  if (operation === "fixed_sash") return "Fixed Sash";
  if (operation === "tilt_turn_left") return "Tilt & Turn Left";
  if (operation === "tilt_turn_right") return "Tilt & Turn Right";
  if (operation === "turn_left") return "Turn Left";
  if (operation === "turn_right") return "Turn Right";
  if (operation === "tilt") return "Tilt";
  return "Fixed";
}

function layoutMode(structure: B92ConfiguratorStructureState): ConfiguredPositionContract["layout"]["mode"] {
  if (structure.rows === 1 && structure.columns === 1) return "single";
  if (structure.rows === 1) return "linear_horizontal";
  if (structure.columns === 1) return "linear_vertical";
  return "grid";
}

function buildFields(structure: B92ConfiguratorStructureState): ConfiguredPositionContractField[] {
  return structure.fields
    .slice()
    .sort((left, right) => left.row - right.row || left.column - right.column)
    .map((field) => {
      const operation = operationToContractOperation(field.operation);
      return {
        id: field.id,
        row: field.row,
        column: field.column,
        operation,
        openingDirection: operation === "fixed" || operation === "fixed_sash" ? "neutral" : "inward",
        handing: handingForOperation(operation),
      };
    });
}

function buildJunctions(structure: B92ConfiguratorStructureState): ConfiguredPositionContractJunction[] {
  const vertical = Array.from({ length: Math.max(0, structure.columns - 1) }, (_, index): ConfiguredPositionContractJunction => ({
    id: `vertical-${index + 1}`,
    axis: "vertical",
    index: index + 1,
    type: "static",
    ownerFieldId: null,
  }));
  const horizontal = Array.from({ length: Math.max(0, structure.rows - 1) }, (_, index): ConfiguredPositionContractJunction => ({
    id: `horizontal-${index + 1}`,
    axis: "horizontal",
    index: index + 1,
    type: "static",
    ownerFieldId: null,
  }));
  return [...vertical, ...horizontal];
}

function cellInsertions(fields: ConfiguredPositionContractField[]) {
  return Object.fromEntries(
    fields.map((field) => [`${field.column},${field.row}`, insertionForOperation(field.operation)])
  );
}

function resolveEntry(state: B92ConfiguratorState): B92ConfiguratorPromotedViewManifestEntry | null {
  const mappedFamilyId = getB92MappedProofFamilyId(state.structure);
  if (!mappedFamilyId) return null;
  const selectedEntry = getB92ProductionManifestEntry(state.selectedViewId);
  if (selectedEntry?.familyId === mappedFamilyId) return selectedEntry;
  return mapB92ProofEntryForFamily(mappedFamilyId, state.selectedView);
}

export function compileB92ConfiguratorStateToConfiguredPositionContract(
  state: B92ConfiguratorState,
  context: B92ContractCompileContext
): B92ContractCompileResult {
  const entry = resolveEntry(state);
  const errors: string[] = [];
  const mappedFamilyId = getB92MappedProofFamilyId(state.structure);
  if (!mappedFamilyId) errors.push("Unsupported B92 field/layout combination: no approved production proof family is mapped.");
  if (!entry) errors.push("Unsupported B92 field/layout combination: no production manifest entry is available.");
  const proofManifestEntry = getB92ProofManifestEntry(entry?.familyId);
  if (entry && !isB92ProductionProofEntrySupported(entry, proofManifestEntry)) {
    errors.push(`B92 manifest entry ${entry.viewId} is not allowed for production estimate positions.`);
  }
  const profileRefs = proofManifestEntry?.profileRefs ?? [];
  if (entry && (!proofManifestEntry || profileRefs.length === 0)) {
    errors.push(`B92 manifest entry ${entry.familyId} has no explicit machine-readable profile/proof refs registered.`);
  }
  if (errors.length > 0 || !entry || !proofManifestEntry) return { ok: false, errors };

  const fields = buildFields(state.structure);
  const insertions = cellInsertions(fields);
  const now = context.updatedAt ?? new Date().toISOString();
  const proofStatus = getB92ContractProofStatus(entry, proofManifestEntry);

  return {
    ok: true,
    contract: {
      schemaVersion: 1,
      source: "b92_configurator",
      identity: {
        positionId: context.positionId,
        positionRef: context.positionRef,
        estimateId: context.estimateId,
        clientId: context.clientId,
        createdAt: context.createdAt ?? now,
        updatedAt: now,
      },
      estimateContext: {
        quantity: Math.max(1, Number(context.quantity || 1)),
        roomName: context.roomName,
        positionType: "Window",
        useEstimateDefaults: context.useEstimateDefaults ?? true,
      },
      product: {
        manufacturerId: null,
        productId: "B92",
        windowTypeId: entry.familyId,
        systemCode: "B92",
        productFamily: "Europa 92 Alu Clad",
        sourceModelId: state.sourceModelDesignId,
        sourceModelVersion: entry.generatedGeometrySourceId,
      },
      dimensions: {
        widthMm: state.dimensions.widthMm,
        heightMm: state.dimensions.heightMm,
        colWidthsMm: state.dimensions.columnWidthsMm,
        rowHeightsMm: state.dimensions.rowHeightsMm,
        splitMode: state.dimensions.splitMode,
        divisionBasis: "frame",
      },
      layout: {
        rows: state.structure.rows,
        columns: state.structure.columns,
        mode: layoutMode(state.structure),
        presetKey: state.structure.layoutPreset,
        fields,
        junctions: buildJunctions(state.structure),
      },
      profileProof: {
        sourceModel: "b92_configurator_manifest",
        sourceModelProvenanceId: entry.generatedGeometrySourceId,
        proofStatus,
        approvedProofIds: proofStatus === "approved_locked" ? [entry.familyId, entry.viewId] : [],
        acceptedReferenceIds: proofStatus === "accepted_reference" ? [entry.familyId, entry.viewId] : [],
        generatedPreviewIds: [],
        profileRefs,
        unresolvedProfileRefs: [],
        sourceProof: entry.sourceProof,
        constraints: [
          {
            sourceId: entry.viewId,
            severity: proofStatus === "approved_locked" ? "info" : "warning",
            note: entry.notes,
          },
        ],
      },
      glass: {
        label: "B92 proof-derived glazing",
        spec: null,
        calculatedBy: "b92_proof_geometry",
      },
      hardware: {
        handleType: null,
        handleHeightMm: null,
        hingeType: null,
      },
      finish: {
        mode: "dual",
        internalMode: state.finishes.internalMode,
        internalRal: state.finishes.internalRal,
        internalLacquerId: state.finishes.internalLacquerId,
        externalRevealMode: state.finishes.externalRevealMode,
        externalRevealRal: state.finishes.externalRevealRal,
        externalRevealLacquerId: state.finishes.externalRevealLacquerId,
        externalCladdingMode: state.finishes.externalCladdingMode,
        externalCladdingRal: state.finishes.externalCladdingRal,
      },
      pricing: {
        pricingMode: context.itemPrice && context.itemPrice > 0 ? "manual" : "pending",
        itemPrice: context.itemPrice ?? null,
      },
      render: {
        orientationView: entry.view === "external" ? "outside" : "inside",
        renderSource: "b92_proof_preview",
        proofViewId: entry.viewId,
        proofFamilyId: entry.familyId,
        openingSymbolMode: "din",
      },
      compatibilityProjection: {
        widthMm: state.dimensions.widthMm,
        heightMm: state.dimensions.heightMm,
        fieldsX: state.structure.columns,
        fieldsY: state.structure.rows,
        insertion: insertions["0,0"] ?? "Fixed",
        cellInsertions: insertions,
        colWidthsMm: state.dimensions.columnWidthsMm,
        rowHeightsMm: state.dimensions.rowHeightsMm,
      },
    },
  };
}

export function projectConfiguredPositionContractToLegacyPosition(
  contract: ConfiguredPositionContract
) {
  return {
    positionRef: contract.identity.positionRef,
    qty: contract.estimateContext.quantity,
    roomName: contract.estimateContext.roomName,
    widthMm: contract.compatibilityProjection.widthMm,
    heightMm: contract.compatibilityProjection.heightMm,
    fieldsX: contract.compatibilityProjection.fieldsX,
    fieldsY: contract.compatibilityProjection.fieldsY,
    insertion: contract.compatibilityProjection.insertion,
    cellInsertions: contract.compatibilityProjection.cellInsertions,
    colWidthsMm: contract.compatibilityProjection.colWidthsMm,
    rowHeightsMm: contract.compatibilityProjection.rowHeightsMm,
    orientationView: contract.render.orientationView,
    positionType: contract.estimateContext.positionType,
    useEstimateDefaults: contract.estimateContext.useEstimateDefaults,
    product: "Europa 92 Alu Clad",
    productType: "Timber Aluminium Clad",
    family: "window",
  };
}

export function getContractFromPositionOrNull(position: unknown): ConfiguredPositionContract | null {
  return getConfiguredPositionContract(position);
}

export function hydrateB92ConfiguratorStateFromPosition(position:Record<string,any>):B92ConfiguratorState{
  const contract=getConfiguredPositionContract(position),base=createB92DefaultConfiguratorState();
  if(!contract)return createB92DefaultConfiguratorState({dimensions:{...base.dimensions,widthMm:Number(position.widthMm)||base.dimensions.widthMm,heightMm:Number(position.heightMm)||base.dimensions.heightMm,columnWidthsMm:[Number(position.widthMm)||base.dimensions.widthMm],rowHeightsMm:[Number(position.heightMm)||base.dimensions.heightMm]}});
  const operations:Record<string,B92ConfiguratorFieldOperation>={fixed:'fixed',fixed_sash:'fixed-sash',tilt_turn_left:'tilt-turn-left',tilt_turn_right:'tilt-turn-right',turn_left:'turn-left',turn_right:'turn-right',tilt:'tilt'};
  return createB92DefaultConfiguratorState({selectedViewId:contract.render.proofViewId,selectedFamilyId:contract.render.proofFamilyId,selectedView:contract.render.orientationView==='outside'?'external':'internal',sourceModelDesignId:contract.product.sourceModelId,dimensions:{widthMm:contract.dimensions.widthMm,heightMm:contract.dimensions.heightMm,splitMode:contract.dimensions.splitMode,columnWidthsMm:contract.dimensions.colWidthsMm,rowHeightsMm:contract.dimensions.rowHeightsMm},structure:{...base.structure,layoutPreset:contract.layout.presetKey as B92ConfiguratorStructureState['layoutPreset'],rows:contract.layout.rows,columns:contract.layout.columns,fields:contract.layout.fields.map((field,index)=>({id:field.id,index,row:field.row,column:field.column,operation:operations[field.operation]??'fixed'})),selectedFieldId:contract.layout.fields[0]?.id??null},finishes:{...base.finishes,...contract.finish}});
}
