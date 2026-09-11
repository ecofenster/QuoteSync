import { useState } from "react";
import { createRoot } from "react-dom/client";
import EmailWorkspace from "../../src/features/communications/EmailWorkspace";
import "../../src/index.css";

localStorage.setItem("quotesuite.email.layout.v1", JSON.stringify("right"));
localStorage.setItem("quotesuite.email.reading-mode.v1", JSON.stringify("message"));

function Acceptance() {
  const [handoff, setHandoff] = useState("");
  return (
    <main data-testid="email-feedback-acceptance">
      <EmailWorkspace
        onOpenIntegrations={() => {}}
        onOpenEstimateFiles={() => {}}
        onImportManufacturerEstimate={(clientId, estimateId, documentId) =>
          setHandoff(`${clientId}|${estimateId}|${documentId}`)
        }
      />
      <output data-testid="import-handoff">{handoff}</output>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Acceptance />);
