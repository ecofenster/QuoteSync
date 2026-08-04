import { useMemo } from "react";
import { B92_PROFILE_SECTION_PROOF_FAMILIES } from "../admin/windowTypes/b92ProfileSectionProofRegistry";
import type { B92ProfileSectionProofView } from "../admin/windowTypes/b92ProfileSectionProofGeometry";
import { B92_PRODUCTION_CONFIGURATOR_VIEW_IDS, B92_PROMOTED_VIEW_MANIFEST } from "./b92PromotedViewManifest";
import type { B92ConfiguratorPromotedViewManifestEntry } from "./b92Configurator.types";

type Props = {
  selectedEntry: B92ConfiguratorPromotedViewManifestEntry | null;
  onSelectViewId: (viewId: string) => void;
};

function familyLabel(familyId: string) {
  const family = B92_PROFILE_SECTION_PROOF_FAMILIES.find((candidate) => candidate.id === familyId);
  return family ? `${family.group} - ${family.label}` : familyId;
}

function statusLabel(status: B92ConfiguratorPromotedViewManifestEntry["status"]) {
  return status === "accepted-reference" ? "accepted-reference" : status;
}

export default function B92ConfiguratorViewSelector(props: Props) {
  const productionEntries = useMemo(
    () => B92_PROMOTED_VIEW_MANIFEST.filter((entry) => B92_PRODUCTION_CONFIGURATOR_VIEW_IDS.includes(entry.viewId)),
    []
  );
  const familyEntries = useMemo(() => {
    const grouped = new Map<string, B92ConfiguratorPromotedViewManifestEntry[]>();
    for (const entry of productionEntries) {
      grouped.set(entry.familyId, [...(grouped.get(entry.familyId) ?? []), entry]);
    }
    return [...grouped.entries()].map(([familyId, entries]) => ({
      familyId,
      label: familyLabel(familyId),
      entries,
    }));
  }, [productionEntries]);

  const selectedFamilyId = props.selectedEntry?.familyId ?? familyEntries[0]?.familyId ?? "";
  const selectedFamily = familyEntries.find((family) => family.familyId === selectedFamilyId) ?? familyEntries[0] ?? null;
  const selectedStatus = props.selectedEntry?.status ?? selectedFamily?.entries[0]?.status ?? "promoted";

  function selectFamily(familyId: string) {
    const nextFamily = familyEntries.find((family) => family.familyId === familyId);
    const sameSide = nextFamily?.entries.find((entry) => entry.view === props.selectedEntry?.view);
    const nextEntry = sameSide ?? nextFamily?.entries[0] ?? null;
    if (nextEntry) props.onSelectViewId(nextEntry.viewId);
  }

  function selectView(view: B92ProfileSectionProofView) {
    const nextEntry = selectedFamily?.entries.find((entry) => entry.view === view);
    if (nextEntry) props.onSelectViewId(nextEntry.viewId);
  }

  return (
    <section className="b92-view-selector">
      <div className="b92-view-selector__header">
        <div className="b92-view-selector__heading">
          <div className="b92-section-title">Production B92 proof view</div>
          <div className="b92-body-copy">{productionEntries.length} manifest-driven internal/external views available.</div>
        </div>
        <span className="b92-status-badge b92-status-badge--supported">
          {statusLabel(selectedStatus)}
        </span>
      </div>

      <label className="b92-view-selector__field">
        <span className="b92-setting-label">Family</span>
        <select className="b92-input" value={selectedFamilyId} onChange={(event) => selectFamily(event.currentTarget.value)}>
          {familyEntries.map((family) => (
            <option key={family.familyId} value={family.familyId}>
              {family.label}
            </option>
          ))}
        </select>
      </label>

      <div className="b92-view-selector__toggle-grid">
        {(["internal", "external"] as const).map((view) => {
          const available = Boolean(selectedFamily?.entries.some((entry) => entry.view === view));
          const selected = props.selectedEntry?.view === view;
          return (
            <button
              key={view}
              type="button"
              className={`b92-secondary-button b92-view-selector__button${selected ? " b92-view-selector__button--selected" : ""}`}
              disabled={!available}
              onClick={() => selectView(view)}
            >
              {view === "internal" ? "Internal" : "External"}
            </button>
          );
        })}
      </div>
    </section>
  );
}
