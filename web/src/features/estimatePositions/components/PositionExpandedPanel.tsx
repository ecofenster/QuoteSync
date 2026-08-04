import { getConfiguredPositionContract } from "../../configurator/configuredPositionContract.utils";

type Props = {
  p: any;
};

export default function PositionExpandedPanel(props: Props) {
  const { p } = props;
  const contract = getConfiguredPositionContract(p);

  return (
    <div className="ep-position-expanded-panel">
      <div className="ep-position-expanded-panel__title">
        {contract ? "B92 configured position" : "Advanced options coming soon"}
      </div>
      <div className="ep-position-expanded-panel__copy">
        Position: {p.positionRef || "—"} {p.roomName ? `• ${p.roomName}` : ""}
      </div>
      {contract ? (
        <div className="ep-position-expanded-panel__copy">
          Contract v{contract.schemaVersion} • {contract.profileProof.proofStatus.replace(/_/g, " ")} • {contract.render.proofFamilyId}
        </div>
      ) : null}
    </div>
  );
}
