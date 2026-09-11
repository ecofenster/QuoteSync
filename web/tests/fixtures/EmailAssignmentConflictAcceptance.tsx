import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AssignmentDialog } from "../../src/features/communications/EmailWorkspace";
import { communicationsApi, type CommunicationAssignmentOptions, type CommunicationAssignmentResult, type CommunicationFileDecision } from "../../src/services/communications/communicationsApi";

function Acceptance() {
  const [options, setOptions] = useState<CommunicationAssignmentOptions | null>(null);
  const [result, setResult] = useState<CommunicationAssignmentResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ state:"saving"|"failed"|"partial";message:string } | null>(null);
  const [nextAction, setNextAction] = useState("");
  const submitting = useRef(false);
  useEffect(() => { void communicationsApi.assignmentOptions("disposable-message").then(setOptions); }, []);
  const submit = async (value: {clientId:string;projectId:string;estimateId:string;supplierId:string;attachmentId:string;conflictsReviewed:boolean;fileDecision:CommunicationFileDecision}) => {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setFeedback({ state:"saving", message:"Saving document…" });
    try {
      setResult(await communicationsApi.assignDocument("disposable-message", value));
      setFeedback(null);
    } catch (reason) {
      setFeedback({ state:"failed", message:reason instanceof Error ? reason.message : "The supplier document could not be filed." });
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };
  if (!options) return <p role="status">Loading picker…</p>;
  return <main data-testid="email-assignment-acceptance">
    {nextAction ? <p role="status">{nextAction}</p> : null}
    <AssignmentDialog options={options} result={result} saving={saving} feedback={feedback} onClose={() => setNextAction("Closed")} onSubmit={(value) => void submit(value)} onOpenFiles={() => setNextAction("Open Files selected")} onImport={() => setNextAction("Import Manufacturer Estimate selected")} />
  </main>;
}

createRoot(document.getElementById("root")!).render(<Acceptance />);
