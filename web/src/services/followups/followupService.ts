export function isoDatePlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export async function createLinkedNoteEntry(args: {
  apiFetchJson: (path: string, options?: RequestInit) => Promise<any>;
  activeUserName: string;
  payload: {
    clientId: string;
    estimateId?: string | null;
    followupId?: string | null;
    category: "follow_up" | "general" | "service" | "installer" | "client_request";
    noteText: string;
  };
}) {
  const noteText = String(args.payload.noteText || "").trim();
  if (!noteText) return;

  await args.apiFetchJson("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: uid(),
      client_id: args.payload.clientId,
      estimate_id: args.payload.estimateId || null,
      followup_id: args.payload.followupId || null,
      category: args.payload.category,
      note_text: noteText,
      created_by: args.activeUserName,
    }),
  });
}

export async function addFollowUpForEstimate(args: {
  pickerClient: any;
  estimateId: string;
  opts?: { days?: number; sendEmail?: boolean; needsCall?: boolean };
  apiFetchJson: (path: string, options?: RequestInit) => Promise<any>;
  activeUserName: string;
  alertFn?: (message: string) => void;
  logError?: (...values: any[]) => void;
}) {
  const e = args.pickerClient?.estimates?.find((x: any) => x.id === args.estimateId);
  if (!e) return;

  const dueDateISO = isoDatePlusDays(args.opts?.days ?? 3);
  const followupId = uid();
  const noteSummary = [
    (args.opts?.needsCall ?? true) ? "Telephone call" : null,
    (args.opts?.sendEmail ?? true) ? "Follow-up email" : null,
  ].filter(Boolean).join(" • ");

  try {
    await args.apiFetchJson("/api/followups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: followupId,
        client_id: args.pickerClient.id,
        estimate_id: e.id,
        title: `Follow up: ${args.pickerClient.clientName} • ${(e as any).estimateRef ?? ""}`.trim(),
        notes: noteSummary,
        due_at: dueDateISO,
        status: "pending",
      }),
    });

    await createLinkedNoteEntry({
      apiFetchJson: args.apiFetchJson,
      activeUserName: args.activeUserName,
      payload: {
        clientId: args.pickerClient.id,
        estimateId: e.id,
        followupId,
        category: "follow_up",
        noteText: [
          "Follow-up created",
          `Due: ${dueDateISO}`,
          `Estimate: ${(e as any).estimateRef ?? e.id}`,
          noteSummary ? `Actions: ${noteSummary}` : "",
        ].filter(Boolean).join("\n"),
      },
    });

    (args.alertFn ?? ((message: string) => window.alert(message)))(`Follow-up added for ${dueDateISO}.`);
  } catch (error) {
    (args.logError ?? console.error)("Failed to add follow-up", error);
    (args.alertFn ?? ((message: string) => window.alert(message)))("Failed to add follow-up.");
  }
}
