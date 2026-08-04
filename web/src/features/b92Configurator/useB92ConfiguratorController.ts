import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import {
  createB92DefaultConfiguratorState,
  getB92InitialConfiguratorView,
} from "./b92ConfiguratorState";
import type {
  B92ConfiguratorContextTarget,
  B92ConfiguratorFieldOperation,
  B92ConfiguratorLayoutPreset,
  B92ConfiguratorState,
  B92ConfiguratorStructureState,
} from "./b92Configurator.types";
import {
  getB92InitialProductionManifestEntry,
  getB92MappedProofFamilyId,
  getB92PreviewEntryForStructure,
  getB92PreviewFamilyForEntry,
  getB92ProductionManifestEntry,
  hasB92ProofAvailableForStructure,
  mapB92ProofEntryForFamily,
  selectB92ProofFamilyView,
  selectB92ProofFamilyViewStrict,
} from "./b92ConfiguratorProofMapping";
import type { B92ConfiguratorModalId } from "./B92ConfiguratorModalHost";
import {
  buildB92StructureFromPreset,
  getB92StructurePresetDefinition,
} from "./b92StructurePresets";

function initialState() {
  const firstProductionView = getB92InitialProductionManifestEntry() ?? getB92InitialConfiguratorView();
  return createB92DefaultConfiguratorState({
    selectedViewId: firstProductionView?.viewId ?? null,
    selectedFamilyId: firstProductionView?.familyId ?? null,
    selectedView: firstProductionView?.view ?? "internal",
  });
}

function equalSplit(total: number, parts: number) {
  const safeParts = Math.max(1, Math.round(parts));
  const base = Math.floor(total / safeParts);
  const remainder = total - base * safeParts;
  return Array.from({ length: safeParts }, (_, index) => base + (index < remainder ? 1 : 0));
}

function withUpdatedFieldOperation(
  structure: B92ConfiguratorStructureState,
  fieldId: string,
  operation: B92ConfiguratorFieldOperation
): B92ConfiguratorStructureState {
  return {
    ...structure,
    selectedFieldId: fieldId,
    fields: structure.fields.map((field) => (field.id === fieldId ? { ...field, operation } : field)),
  };
}

export function useB92ConfiguratorController() {
  const [state, setState] = useState<B92ConfiguratorState>(() => initialState());
  const [activeModal, setActiveModal] = useState<B92ConfiguratorModalId | null>(null);

  const selectedEntry = useMemo(() => getB92ProductionManifestEntry(state.selectedViewId), [state.selectedViewId]);
  const activeFieldTarget = state.activeContextTarget?.type === "field" ? state.activeContextTarget : null;
  const selectedContextField = activeFieldTarget
    ? state.structure.fields.find((field) => field.id === activeFieldTarget.fieldId) ?? null
    : state.structure.fields.find((field) => field.id === state.structure.selectedFieldId) ?? null;
  const currentMappedProofFamilyId = getB92MappedProofFamilyId(state.structure);
  const currentPresetHasProof = hasB92ProofAvailableForStructure(state.structure, selectedEntry);
  const previewEntry = getB92PreviewEntryForStructure(state.structure, selectedEntry);
  const previewFamily = getB92PreviewFamilyForEntry(previewEntry);

  function selectViewId(viewId: string) {
    const entry = getB92ProductionManifestEntry(viewId);
    if (!entry) return;
    setState((current) => ({
      ...current,
      selectedViewId: entry.viewId,
      selectedFamilyId: entry.familyId,
      selectedView: entry.view,
      sourceModelDesignId: entry.mappedDesignIds[0] ?? null,
      contextStatusMessage: null,
    }));
  }

  function selectCurrentFamilyView(view: B92ConfiguratorState["selectedView"]) {
    const familyId = currentMappedProofFamilyId ?? selectedEntry?.familyId ?? state.selectedFamilyId;
    const nextEntry = selectB92ProofFamilyView(familyId, view);
    if (nextEntry) selectViewId(nextEntry.viewId);
  }

  function selectPreviewFamily(familyId: string) {
    if (!previewEntry) return;
    const nextEntry = selectB92ProofFamilyViewStrict(familyId, previewEntry.view);
    if (nextEntry) selectViewId(nextEntry.viewId);
  }

  function selectStructurePreset(preset: B92ConfiguratorLayoutPreset, mode: "fields" | "coupled" = "fields") {
    const structure = buildB92StructureFromPreset(preset);
    const definition = getB92StructurePresetDefinition(preset);

    setState((current) => {
      const nextStructure: B92ConfiguratorStructureState =
        mode === "coupled"
          ? {
              ...structure,
              structureMode: "coupled",
              selectedCouplingTarget: current.structure.selectedCouplingTarget ?? current.structure.selectedFieldId ?? null,
            }
          : {
              ...structure,
              structureMode: "fields",
              selectedCouplingTarget: null,
            };
      const mappedFamilyId = getB92MappedProofFamilyId(nextStructure, mode);
      const mappedEntry = mappedFamilyId ? mapB92ProofEntryForFamily(mappedFamilyId, current.selectedView) : null;

      return {
        ...current,
        selectedViewId: mode === "coupled" ? current.selectedViewId : mappedEntry?.viewId ?? null,
        selectedFamilyId: mode === "coupled" ? current.selectedFamilyId : mappedEntry?.familyId ?? null,
        selectedView: mappedEntry?.view ?? current.selectedView,
        sourceModelDesignId: mode === "coupled" ? current.sourceModelDesignId : mappedEntry?.mappedDesignIds[0] ?? null,
        structure: nextStructure,
        activeContextTarget: nextStructure.selectedFieldId ? { type: "field", fieldId: nextStructure.selectedFieldId } : null,
        contextMenu: { open: false, x: 0, y: 0, target: null },
        contextStatusMessage:
          mode === "coupled"
            ? `Coupled grid ${definition.label} selected in safe state only; coupling drawings and geometry are not generated yet.`
            : mappedEntry
              ? `Structure set to ${definition.label}; B92 resolver mapped it to approved proof ${mappedEntry.familyId}.`
              : definition.unsupportedReason ?? "No approved proof family is mapped to this structure yet.",
        dimensions: {
          ...current.dimensions,
          splitMode: nextStructure.splitMode,
          columnWidthsMm: equalSplit(current.dimensions.widthMm, nextStructure.columns),
          rowHeightsMm: equalSplit(current.dimensions.heightMm, nextStructure.rows),
        },
      };
    });
  }

  function closeContextMenu() {
    setState((current) => ({
      ...current,
      contextMenu: { ...current.contextMenu, open: false, target: null },
    }));
  }

  function openPreviewContextMenu(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    const target: B92ConfiguratorContextTarget = state.structure.selectedFieldId
      ? { type: "field", fieldId: state.structure.selectedFieldId }
      : { type: "frame-edge", frameEdgeId: "outer-frame" };
    setState((current) => ({
      ...current,
      activeContextTarget: target,
      contextMenu: {
        open: true,
        x: event.clientX,
        y: event.clientY,
        target,
      },
      contextStatusMessage: "Right-click target uses selected field fallback until proof hit-testing is added.",
    }));
  }

  function commitFieldOperation(fieldId: string, operation: B92ConfiguratorFieldOperation) {
    setState((current) => {
      const target: B92ConfiguratorContextTarget = { type: "field", fieldId };
      if (!current.structure.fields.some((field) => field.id === fieldId)) {
        return {
          ...current,
          contextMenu: { ...current.contextMenu, open: false, target: null },
          contextStatusMessage: `Field operation action ignored; ${fieldId} is not present in the current structure.`,
        };
      }

      const nextStructure = withUpdatedFieldOperation(current.structure, fieldId, operation);
      const mappedFamilyId = getB92MappedProofFamilyId(nextStructure);
      const mappedEntry = mappedFamilyId ? mapB92ProofEntryForFamily(mappedFamilyId, current.selectedView) : null;

      if (!mappedEntry) {
        return {
          ...current,
          activeContextTarget: target,
          contextMenu: { ...current.contextMenu, open: false, target: null },
          contextStatusMessage: `Unsupported field operation for ${current.structure.layoutPreset}; no approved B92 proof family exists for that combination yet.`,
        };
      }

      return {
        ...current,
        selectedViewId: mappedEntry.viewId,
        selectedFamilyId: mappedEntry.familyId,
        selectedView: mappedEntry.view,
        sourceModelDesignId: mappedEntry.mappedDesignIds[0] ?? null,
        structure: nextStructure,
        activeContextTarget: target,
        contextMenu: { ...current.contextMenu, open: false, target: null },
        contextStatusMessage: `Field ${fieldId} set to ${operation}; mapped to approved proof ${mappedEntry.familyId}.`,
      };
    });
  }

  function setFieldOperation(operation: B92ConfiguratorFieldOperation) {
    const target = state.contextMenu.target ?? state.activeContextTarget;
    if (target?.type !== "field") {
      setState((current) => ({
        ...current,
        contextMenu: { ...current.contextMenu, open: false, target: null },
        contextStatusMessage: "Field operation actions require a selected field target.",
      }));
      return;
    }
    commitFieldOperation(target.fieldId, operation);
  }

  function patchFinishes(patch: Partial<B92ConfiguratorState["finishes"]>) {
    setState((current) => ({
      ...current,
      finishes: {
        ...current.finishes,
        ...patch,
      },
    }));
  }

  function setOverallDimensions(widthMm: number, heightMm: number) {
    setState((current) => {
      const preset = getB92StructurePresetDefinition(current.structure.layoutPreset);
      return {
        ...current,
        dimensions: {
          ...current.dimensions,
          widthMm,
          heightMm,
          splitMode: "equal",
          columnWidthsMm: equalSplit(widthMm, current.structure.columns),
          rowHeightsMm: equalSplit(heightMm, current.structure.rows),
        },
        contextStatusMessage: `Size set to ${widthMm}mm x ${heightMm}mm. Equal field splits recalculated for ${preset.label}.`,
      };
    });
  }

  return {
    state,
    activeModal,
    selectedEntry,
    selectedContextField,
    currentPresetHasProof,
    previewEntry,
    previewFamily,
    setActiveModal,
    selectViewId,
    selectCurrentFamilyView,
    selectPreviewFamily,
    selectStructurePreset,
    closeContextMenu,
    openPreviewContextMenu,
    commitFieldOperation,
    setFieldOperation,
    patchFinishes,
    setOverallDimensions,
  };
}
