import { H3, Small } from "./shared";
import CanonicalDocumentsPanel from "../../documents/CanonicalDocumentsPanel";

export default function FilesTab(props: {
  clientId: string;
}) {
  return (
    <div className="ep-section-shell">
      <div className="ep-section-header">
        <H3>Files</H3>
        <Small>Complete client, project, Estimate and future Order document context.</Small>
      </div>
      <div className="ep-pane-card"><CanonicalDocumentsPanel clientId={props.clientId}/></div>
    </div>
  );
}
