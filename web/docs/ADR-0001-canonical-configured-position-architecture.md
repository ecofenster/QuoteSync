# ADR-0001: Canonical Configured Position Architecture

Date: 2026-07-08

Status: Proposed for Phase 4 implementation

## Context

QuoteSync currently has several overlapping representations of a configured window or door position:

- `src/models/types.ts` defines persisted estimate `Position` records. This is the current data shape saved inside `estimates.positions_json`.
- `src/features/estimateWorkflow/workflow.types.ts` defines `ConfiguratorWorkflowDraft`, including a nested `configuration` state used by the old/disabled estimate configurator workflow.
- `src/features/configurator/configuratorSchema.types.ts` defines a newer shared configurator schema, including `ConfiguratorSystemDefinitionV2`, layout, field, junction, glass, and render references.
- `src/features/admin/windowTypes/windowTypeSourceModel.types.ts` defines `WindowTypeSourceModel`, which carries the richest admin/proof source semantics: system, view, layout, field rules, operation, profile refs, geometry rules, constraints, provenance, and B92 dev/proof flags.
- `src/features/configurator/rendering/profileResolution/windowTypeRenderContract.ts` defines `WindowTypeRenderModel`, a downstream render contract built from a source model and runtime dimensions.
- `src/features/configurator/rendering/buildWindowDrawingModel.ts` accepts a loose `PosDraft` and derives a `DrawingModel` from persisted position fields, resolved render profiles, and optional `windowConfiguration`.
- `src/features/b92Configurator/b92Configurator.types.ts` defines a B92-specific standalone configurator state that is not the estimate persistence model.
- B92 proof evidence lives mostly in `_project/Test/Europa 92 Alu Clad/...` and summary documents. These documents are authoritative evidence, but not yet normalized into one runtime proof manifest consumed by the estimate workflow.

The result is that a configured position can currently be inferred from multiple places. That makes rendering and future document output fragile because the renderer may receive partial or inconsistent truth.

## Decision

The canonical source of truth for a configured position will be a new `ConfiguredPositionContract`.

The intended pipeline is:

```text
Admin Catalog / Window Type Source Model
  -> ConfiguredPositionContract
  -> Drawing/Render Adapter
  -> Estimate Position persistence
  -> Quote/Document Output
```

More precisely:

```text
Admin Catalog records
  -> WindowTypeSourceModel
  -> ConfiguredPositionContract
  -> WindowTypeRenderModel
  -> DrawingModel
  -> SVG/PDF/quote/document output
```

`ConfiguredPositionContract` is the canonical boundary between user-selected estimate data and system-approved configurator/render/proof data.

`WindowTypeSourceModel` remains the canonical admin definition for product/system/layout/profile/proof mapping. It is not itself an estimate position because it does not contain customer-specific quantity, room, final width/height, finish choices, selected glass, selected hardware, price inputs, or estimate metadata.

`DrawingModel` and `WindowTypeRenderModel` are derived outputs. They must not become persistence sources of truth.

The existing persisted `Position` shape remains the storage envelope during Phase 4, but its configured data should be normalized into a `configuredContract` field or equivalent versioned payload. Existing flat fields such as `widthMm`, `heightMm`, `fieldsX`, `fieldsY`, `insertion`, and `cellInsertions` should become compatibility projections from the contract, not independent truth.

## Proposed ConfiguredPositionContract

This is an architecture contract, not an implementation in Phase 3.

```ts
export type ConfiguredPositionContract = {
  schemaVersion: 1;

  identity: {
    positionId: string;
    positionRef: string;
    estimateId: string;
    clientId: string;
    createdAt?: string;
    updatedAt?: string;
  };

  estimateContext: {
    quantity: number;
    roomName: string;
    positionType: "Window" | "Door";
    useEstimateDefaults: boolean;
  };

  product: {
    manufacturerId: string | null;
    productId: string | null;
    windowTypeId: string | null;
    systemCode: string;
    productFamily: string | null;
    sourceModelId: string | null;
    sourceModelVersion: string | null;
  };

  dimensions: {
    widthMm: number;
    heightMm: number;
    colWidthsMm?: number[];
    rowHeightsMm?: number[];
    splitMode: "equal" | "manual";
    divisionBasis: "frame" | "glass";
  };

  layout: {
    rows: number;
    columns: number;
    mode: "single" | "linear_horizontal" | "linear_vertical" | "grid" | "freehand";
    presetKey?: string | null;
    fields: Array<{
      id: string;
      row: number;
      column: number;
      operation: string;
      openingDirection: "inward" | "outward" | "neutral";
      handing?: "left" | "right" | "center" | null;
      sequence?: "tilt_first" | "turn_first" | null;
    }>;
    junctions: Array<{
      id: string;
      axis: "vertical" | "horizontal";
      index: number;
      type: "static" | "flying";
      betweenFieldIds?: [string, string];
      ownerFieldId?: string | null;
    }>;
  };

  profileProof: {
    sourceModel: "admin_catalog" | "admin_seed" | "manual" | "imported_reference";
    sourceModelProvenanceId?: string | null;
    b92?: {
      proofStatus: "approved_locked" | "accepted_reference" | "generated_preview" | "unproved" | "not_applicable";
      approvedProofIds: string[];
      acceptedReferenceIds: string[];
      profileRefs: string[];
      unresolvedProfileRefs: string[];
      constraints: Array<{
        sourceId: string;
        severity: "info" | "warning" | "blocking";
        note?: string;
      }>;
    };
  };

  glass: {
    optionId?: string | null;
    label?: string | null;
    spec?: string | null;
    calculatedBy?: "admin_rule" | "estimate_override" | "manual";
  };

  hardware: {
    handleType?: string | null;
    handleHeightMm?: number | null;
    hingeType?: string | null;
    locking?: Record<string, unknown>;
  };

  finish: {
    mode: "single" | "dual";
    internalColour?: string | null;
    externalColour?: string | null;
    lacquerId?: string | null;
    ralInternal?: string | null;
    ralExternal?: string | null;
  };

  pricing: {
    pricingMode: "pending" | "manual" | "calculated";
    itemPrice?: number | null;
    inputs?: Record<string, unknown>;
  };

  render: {
    orientationView: "inside" | "outside";
    internalRenderProfileId?: string | null;
    externalRenderProfileId?: string | null;
    renderDefinitionContextKey?: string | null;
    openingSymbolMode?: "din" | "uk";
  };

  compatibilityProjection: {
    widthMm: number;
    heightMm: number;
    fieldsX: number;
    fieldsY: number;
    insertion: string;
    cellInsertions: Record<string, string>;
  };
};
```

## Ownership

| Concern | Canonical owner | Derived/consumer |
| --- | --- | --- |
| Product/system | Admin Catalog plus `WindowTypeSourceModel` | `ConfiguredPositionContract.product` stores selected refs |
| Customer/estimate identity | Estimate flow | Contract `identity` and persisted `Position` envelope |
| Quantity, room, position ref | Estimate position flow | Quote/document output |
| Dimensions | `ConfiguredPositionContract.dimensions` | `WindowTypeRenderModel`, `DrawingModel`, quote output |
| Field layout | Admin source model for allowed layout; contract for selected runtime layout | Renderer and estimate UI |
| Opening types/handing | Admin source model defines valid operations; contract records selected per-field operations | Renderer, B92 resolver, documents |
| Profile/proof mapping | `WindowTypeSourceModel` plus B92 proof manifest/evidence | `WindowTypeRenderModel`, diagnostics, documents |
| Glass | Admin catalog option/rule plus estimate selected override | Contract and pricing |
| Hardware | Admin catalog/defaults plus estimate selected override | Contract and documents |
| Finish/colour | Estimate defaults plus per-position override | Renderer and documents |
| Pricing inputs | Estimate/pricing layer | Quote output; not renderer |
| Render/drawing output | Render adapters from contract | Disposable `DrawingModel`; not persisted truth |
| Estimate persistence | Estimate API/database `positions_json` envelope | Stores versioned contract plus legacy projection during migration |

## Competing Sources To Deprecate Or Freeze

Freeze now:

- `buildWindowDrawingModel(PosDraft)` as a compatibility renderer entrypoint. Do not expand its responsibilities.
- `GridEditor` direct mutation of flat position fields. Keep only as legacy editor until Phase 4 adapter replaces it.
- `ConfiguratorWorkflowDraft.configuration` as persistence truth. It can remain workflow UI state, but must compile to `ConfiguredPositionContract`.
- `Position.windowConfiguration` as an unversioned blob. Do not add new semantics to it.
- Seed fallback source models in admin preview. They may remain for technical preview only, never as estimate persistence authority.
- Generated fixed-grid source models in admin preview. They are preview scaffolding, not approved canonical source.
- `B92ConfiguratorState` as a standalone B92 workbench state. It is not the estimate contract.

Deprecate later:

- Flat persisted position truth: `fieldsX`, `fieldsY`, `insertion`, `cellInsertions`, `colWidthsMm`, `rowHeightsMm` as independent fields.
- Renderer-inferred opening semantics from display strings such as `"Tilt & Turn Left"`.
- `resolvedProfiles` passed into drawing code as an ad hoc truth source.
- Direct quote/document consumption of loose `any` positions without contract normalization.

Preserve:

- `WindowTypeSourceModel` direction and provenance fields.
- B92 proof evidence and generated summary documents.
- `WindowTypeRenderModel` as the downstream resolved render contract.
- `DrawingModel` as a render-only intermediate.
- Phase 1 client/data protection work.

## Required Phase 4 Implementation Steps

1. Add `ConfiguredPositionContract` types in a focused source file, probably under `src/features/configurator/configuredPositionContract.types.ts`.
2. Add a pure compiler from `ConfiguratorWorkflowDraft` plus selected Admin Catalog records into `ConfiguredPositionContract`.
3. Add a pure adapter from legacy persisted `Position` into `ConfiguredPositionContract` for old estimates.
4. Add a pure projection from `ConfiguredPositionContract` back to legacy flat position fields for compatibility.
5. Add a render adapter from `ConfiguredPositionContract` to `WindowTypeRenderModel`, then to `DrawingModel`.
6. Change estimate save/load logic to preserve the full versioned contract while still writing compatibility projection fields.
7. Make quote/document output read normalized contracts first and legacy projections second.
8. Introduce a runtime B92 proof manifest/index that maps approved/locked and accepted-reference proof IDs to source-model/profile rules.
9. Add validation gates: contract cannot render or quote as proof-backed B92 if required profile refs are unresolved or proof status is only `generated_preview`.
10. Add tests around contract compilation, legacy migration, render adapter input, and quote/document normalization.

## Risks And Open Questions

- The B92 proof evidence is strong but still document/file based. Phase 4 needs a machine-readable manifest without rewriting proof geometry.
- Some admin preview source models are seed/generated fallbacks. Phase 4 must prevent those from silently becoming production estimate authority.
- `buildWindowDrawingModel` contains useful rendering work but too much inference. Replacing it abruptly would be risky; wrap it first, then retire paths gradually.
- Pricing is currently loosely tied to `itemPrice`. The contract should carry pricing inputs, but pricing calculation ownership needs a later dedicated decision.
- Doors, sliders, curtain wall, rooflights, and non-B92 systems are not fully represented by the B92-heavy proof model. The contract must be generic enough, with B92 proof data optional.
- Existing persisted estimates may contain only flat legacy position data. Migration must be non-destructive and reversible.
- It remains open whether `ConfiguredPositionContract` should be stored inside `positions_json` immediately or in a future normalized table. Phase 4 should avoid schema changes unless approved.

## Consequences

Positive:

- One versioned contract becomes the handoff between estimate configuration, rendering, proof validation, and documents.
- Admin/catalog/proof knowledge is kept upstream, not duplicated in the renderer.
- Drawing output becomes repeatable and disposable.
- Legacy estimates can continue to load through adapters.

Negative:

- Phase 4 needs adapter work before feature work can safely continue.
- Some current UI paths will remain temporarily redundant until the contract compiler is wired in.
- B92 proof status must be formalized before the renderer can enforce proof-backed output reliably.

## Files Inspected For This Decision

- `src/models/types.ts`
- `src/App.tsx`
- `src/components/GridEditor.tsx`
- `src/features/admin/configuratorCatalog.types.ts`
- `src/features/admin/AdminConfiguratorCatalogWorkspace.tsx`
- `src/features/admin/AdminRenderProfileWorkspace.tsx`
- `src/features/admin/windowTypes/AdminWindowTypesWorkspace.tsx`
- `src/features/admin/windowTypes/WindowTypeEditor.tsx`
- `src/features/admin/windowTypes/WindowTypePreviewPanel.tsx`
- `src/features/admin/windowTypes/windowTypeSourceModel.types.ts`
- `src/features/admin/windowTypes/b92ProfileSectionProofRegistry.ts`
- `src/features/b92Configurator/b92Configurator.types.ts`
- `src/features/configurator/configuratorSchema.types.ts`
- `src/features/configurator/configuratorSchema.helpers.ts`
- `src/features/configurator/configuratorWorkflow.helpers.ts`
- `src/features/configurator/rendering/drawingModel.ts`
- `src/features/configurator/rendering/DrawingViewport.tsx`
- `src/features/configurator/rendering/buildWindowDrawingModel.ts`
- `src/features/configurator/rendering/profileSectionMapping.ts`
- `src/features/configurator/rendering/profileResolution/windowTypeRenderContract.ts`
- `src/features/configurator/rendering/profileResolution/adminWindowTypeSourceAdapter.ts`
- `src/features/configurator/rendering/profileResolution/catalogWindowTypeSourceAdapter.ts`
- `src/features/configurator/rendering/profileResolution/b92WindowTypeRenderAdapter.ts`
- `src/features/configurator/rendering/profileResolution/b92SegmentResolver.ts`
- `src/features/configurator/rendering/profileResolution/b92DatumProjection.types.ts`
- `src/features/configurator/rendering/profileResolution/b92ProjectionEngine.ts`
- `src/features/estimateWorkflow/workflow.types.ts`
- `src/features/estimateWorkflow/EstimateWorkflowProvider.tsx`
- `src/features/estimatePositions/EstimatePositionsFeature.tsx`
- `src/features/estimateCollection/EstimateExpandedPanel.tsx`
- `src/services/documents/estimateDocumentService.ts`
- `_project/PROJECT_MAP.md`
- `_project/Test/Europa 92 Alu Clad/generated-summary.md`
