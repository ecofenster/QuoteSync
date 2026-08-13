import B92ProfileSectionAssemblyPreview from "../admin/windowTypes/B92ProfileSectionAssemblyPreview";
import B92ContextMenu from "./B92ContextMenu";
import B92ConfiguratorDetailsPanel from "./B92ConfiguratorDetailsPanel";
import B92ConfiguratorModalHost from "./B92ConfiguratorModalHost";
import B92ConfiguratorSummaryPanel from "./B92ConfiguratorSummaryPanel";
import { useB92ConfiguratorController } from "./useB92ConfiguratorController";
import "./B92Configurator.css";

export default function B92ConfiguratorShell() {
  const controller = useB92ConfiguratorController();
  const {
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
  } = controller;

  return (
    <div className="b92-configurator">
      <header className="b92-configurator__header">
        <h2 className="b92-configurator__title">B92 Configurator</h2>
        <div className="b92-body-copy">
          Guided B92 window configurator shell. Change a card, keep the profile-section preview visible, and right-click a field as an operation shortcut.
        </div>
      </header>

      <div className="b92-configurator__layout">
        <B92ConfiguratorDetailsPanel
          state={state}
          selectedEntry={selectedEntry}
          proofAvailable={currentPresetHasProof}
          onOpenModal={setActiveModal}
        />

        <div className="b92-configurator__workspace">
          <section className="b92-configurator__preview-header">
            <div className="b92-configurator__preview-heading">
              <div className="b92-section-title">Preview</div>
              <div className="b92-body-copy">B92 profile-section assembly render. Proof geometry is unchanged.</div>
            </div>
            <div className="b92-configurator__view-toggle">
              {(["internal", "external"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  className={`b92-secondary-button${selectedEntry?.view === view ? " b92-configurator__view-toggle-button--active" : ""}`}
                  onClick={() => selectCurrentFamilyView(view)}
                >
                  {view === "internal" ? "Internal" : "External"}
                </button>
              ))}
            </div>
          </section>
          <div className="b92-configurator__preview-card">
            {previewFamily && previewEntry ? (
              <B92ProfileSectionAssemblyPreview
                selectedFamily={previewFamily}
                view={previewEntry.view}
                onSelectFamily={selectPreviewFamily}
                internalFrameRal={state.finishes.internalRal}
                externalCladdingRal={state.finishes.externalCladdingRal}
                finishState={state.finishes}
                onFinishStateChange={patchFinishes}
                hideFamilySelector
                hideFinishControls
              />
            ) : (
              <div
                className="b92-placeholder-box b92-configurator__unsupported-preview"
              >
                <strong>No approved B92 proof preview for this combination.</strong>
                <span>No dynamic geometry is generated. Change Basic Shape or Opening Type to return to an approved proof.</span>
              </div>
            )}
          </div>
          <section className="b92-configurator__field-targets" aria-label="B92 field operation targets">
            <div className="b92-section-title">Opening operations</div>
            <div
              className="b92-configurator__field-target-grid"
              data-columns={state.structure.columns}
            >
              {state.structure.fields.map((field) => (
                <button
                  key={field.id}
                  type="button"
                  className="b92-configurator__field-target"
                  data-selected={state.structure.selectedFieldId === field.id ? "true" : "false"}
                  onContextMenu={(event) => openPreviewContextMenu(event, field.id)}
                  onClick={(event) => openPreviewContextMenu(event, field.id)}
                  aria-label={`Choose opening operation for ${field.id}`}
                >
                  <strong>{field.id}</strong>
                  <span>{field.operation.replaceAll("-", " ")}</span>
                </button>
              ))}
            </div>
            <div className="b92-body-copy">Select or right-click the exact field whose opening operation you want to change.</div>
          </section>
          <B92ConfiguratorSummaryPanel state={state} selectedEntry={selectedEntry} proofAvailable={currentPresetHasProof} />
          <B92ContextMenu
            open={state.contextMenu.open}
            x={state.contextMenu.x}
            y={state.contextMenu.y}
            target={state.contextMenu.target}
            selectedField={selectedContextField}
            fieldActionsSupported={Boolean(state.contextMenu.target?.type === "field" && currentPresetHasProof)}
            unsupportedReason="Field operation changes are only committed when the resulting structure maps to an approved B92 proof family."
            onClose={closeContextMenu}
            onSetFieldOperation={setFieldOperation}
          />
        </div>
      </div>
      <B92ConfiguratorModalHost
        activeModal={activeModal}
        state={state}
        selectedEntry={selectedEntry}
        proofAvailable={currentPresetHasProof}
        onClose={() => setActiveModal(null)}
        onSelectWindowPreset={(preset) => selectStructurePreset(preset, "fields")}
        onSelectGridPreset={(preset) => selectStructurePreset(preset, "coupled")}
        onSelectViewId={selectViewId}
        onFinishChange={patchFinishes}
        onSetFieldOperation={commitFieldOperation}
        onSetOverallDimensions={setOverallDimensions}
      />
    </div>
  );
}
