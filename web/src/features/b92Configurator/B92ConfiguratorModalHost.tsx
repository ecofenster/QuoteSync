import type {
  B92ConfiguratorFieldOperation,
  B92ConfiguratorLayoutPreset,
  B92ConfiguratorPromotedViewManifestEntry,
  B92ConfiguratorState,
} from "./b92Configurator.types";
import B92ConfiguratorFinishPanel from "./B92ConfiguratorFinishPanel";
import B92ConfiguratorInfoPanel from "./B92ConfiguratorInfoPanel";
import B92ConfiguratorViewSelector from "./B92ConfiguratorViewSelector";
import B92StructureTileLibrary from "./B92StructureTileLibrary";
import B92OpeningLayoutModal from "./B92OpeningLayoutModal";
import B92ModalFrame from "./B92ModalFrame";
import B92PlaceholderModalContent from "./B92PlaceholderModalContent";
import B92ProductSystemModal from "./B92ProductSystemModal";
import B92SizeEditorModal from "./B92SizeEditorModal";

export type B92ConfiguratorModalId =
  | "product"
  | "size"
  | "shape"
  | "opening"
  | "finish"
  | "glass"
  | "hardware"
  | "extras"
  | "coupling"
  | "notes"
  | "diagnostics";

type Props = {
  activeModal: B92ConfiguratorModalId | null;
  state: B92ConfiguratorState;
  selectedEntry: B92ConfiguratorPromotedViewManifestEntry | null;
  proofAvailable: boolean;
  onClose: () => void;
  onSelectWindowPreset: (preset: B92ConfiguratorLayoutPreset) => void;
  onSelectGridPreset: (preset: B92ConfiguratorLayoutPreset) => void;
  onSelectViewId: (viewId: string) => void;
  onFinishChange: (patch: Partial<B92ConfiguratorState["finishes"]>) => void;
  onSetFieldOperation: (fieldId: string, operation: B92ConfiguratorFieldOperation) => void;
  onSetOverallDimensions: (widthMm: number, heightMm: number) => void;
};

const TITLES: Record<B92ConfiguratorModalId, string> = {
  product: "Product / System",
  size: "Size",
  shape: "Basic Shape / Fenstertyp",
  opening: "Opening Type",
  finish: "Finish / Colour",
  glass: "Glass",
  hardware: "Handle / Hardware",
  extras: "Extras",
  coupling: "Coupling",
  notes: "Notes",
  diagnostics: "Status / Diagnostics",
};

export default function B92ConfiguratorModalHost(props: Props) {
  if (!props.activeModal) return null;
  const activeModal = props.activeModal;

  function renderContent() {
    if (activeModal === "shape") {
      return (
        <B92StructureTileLibrary
          structure={props.state.structure}
          selectedEntry={props.selectedEntry}
          onSelectWindowPreset={props.onSelectWindowPreset}
          onSelectGridPreset={props.onSelectGridPreset}
          parkGridAndCoupling
        />
      );
    }

    if (activeModal === "finish") {
      return <B92ConfiguratorFinishPanel finishes={props.state.finishes} onChange={props.onFinishChange} />;
    }

    if (activeModal === "diagnostics") {
      return (
        <div className="b92-diagnostics-modal">
          <B92ConfiguratorViewSelector selectedEntry={props.selectedEntry} onSelectViewId={props.onSelectViewId} />
          <B92ConfiguratorInfoPanel
            selectedEntry={props.selectedEntry}
            structure={props.state.structure}
            activeTarget={props.state.activeContextTarget}
            contextStatusMessage={props.state.contextStatusMessage}
            actionSupported={props.proofAvailable}
          />
        </div>
      );
    }

    if (activeModal === "product") {
      return <B92ProductSystemModal />;
    }

    if (activeModal === "size") {
      return (
        <B92SizeEditorModal
          dimensions={props.state.dimensions}
          structure={props.state.structure}
          onApply={(widthMm, heightMm) => {
            props.onSetOverallDimensions(widthMm, heightMm);
            props.onClose();
          }}
          onCancel={props.onClose}
        />
      );
    }

    if (activeModal === "opening") {
      return (
        <B92OpeningLayoutModal
          structure={props.state.structure}
          selectedEntry={props.selectedEntry}
          onSetFieldOperation={props.onSetFieldOperation}
        />
      );
    }

    if (activeModal === "coupling") {
      return (
        <B92PlaceholderModalContent>
          Coupling and grid planning are parked for a later dedicated flow. No coupling geometry is generated here.
        </B92PlaceholderModalContent>
      );
    }

    return <B92PlaceholderModalContent>{TITLES[activeModal]} options are parked for donor-data migration in a later pass.</B92PlaceholderModalContent>;
  }

  return (
    <B92ModalFrame title={TITLES[activeModal]} onClose={props.onClose}>
      {renderContent()}
    </B92ModalFrame>
  );
}
