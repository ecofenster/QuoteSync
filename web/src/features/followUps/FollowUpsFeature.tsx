import { useEffect, useMemo, useState } from "react";
import type { Client, ClientId } from "../../models/types";
import { buildNextFollowUpRecommendation, createNextFollowUpForCompleted } from "../../services/followups/followupService";
import { apiFetch } from "../../services/api/apiClient";
import "./FollowUpsFeature.css";

type FollowUp = {
  id: string;
  clientId: ClientId;
  clientName: string;
  clientRef?: string;
  estimateId?: string;
  estimateRef?: string;
  dueDateISO: string;
  title: string;
  notes?: string;
  status?: "pending" | "done";
  type?: "call" | "email";
  createdAt: string;
  sendEmail?: boolean;
  needsCall?: boolean;
  issuedQuotationId?: string;
  communicationMessageId?: string;
};

type ApiFollowUp = {
  id?: string;
  client_id?: string;
  estimate_id?: string | null;
  title?: string;
  notes?: string;
  due_at?: string | null;
  status?: string;
  created_at?: string | null;
  updated_at?: string | null;
  issued_quotation_id?: string | null;
  communication_message_id?: string | null;
  origin_event_id?: string | null;
};

type ApiNote = {
  id?: string;
  client_id?: string;
  estimate_id?: string | null;
  followup_id?: string | null;
  category?: string;
  note_text?: string;
  created_by?: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type NoteEntry = {
  id: string;
  clientId: ClientId;
  estimateId?: string;
  followupId?: string;
  category: string;
  noteText: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function toPreviewText(value: string, maxLength = 140) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function normalizeFollowupId(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.toLowerCase() === "null" || normalized.toLowerCase() === "undefined") {
    return undefined;
  }
  return normalized;
}

function mapApiFollowUp(row: ApiFollowUp, clients: Client[]): FollowUp {
  const clientId = String(row.client_id || "") as ClientId;
  const client = clients.find((item) => item.id === clientId) || null;
  const estimate = client?.estimates.find((item) => item.id === String(row.estimate_id || "")) || null;
  const dueDateISO = String(row.due_at || "").trim() || toISODate(new Date());
  const normalizedStatus = String(row.status || "").trim().toLowerCase() === "done" ? "done" : "pending";

  return {
    id: String(row.id || ""),
    clientId,
    clientName: client ? (client.type === "Business" ? (client.businessName || client.clientName) : client.clientName) : "",
    clientRef: client?.clientRef || "",
    estimateId: row.estimate_id ? String(row.estimate_id) : undefined,
    estimateRef: estimate?.estimateRef || undefined,
    dueDateISO,
    title: String(row.title || "Follow-up"),
    notes: String(row.notes || ""),
    status: normalizedStatus,
    type: /email/i.test(String(row.notes || "")) ? "email" : "call",
    createdAt: String(row.created_at || row.updated_at || new Date().toISOString()),
    sendEmail: /follow-up email/i.test(String(row.notes || "")),
    needsCall: /telephone call/i.test(String(row.notes || "")),
    issuedQuotationId: row.issued_quotation_id ? String(row.issued_quotation_id) : undefined,
    communicationMessageId: row.communication_message_id ? String(row.communication_message_id) : undefined,
  };
}

function mapApiNote(row: ApiNote): NoteEntry {
  return {
    id: String(row.id || ""),
    clientId: String(row.client_id || "") as ClientId,
    estimateId: row.estimate_id ? String(row.estimate_id) : undefined,
    followupId: normalizeFollowupId(row.followup_id),
    category: String(row.category || "general"),
    noteText: String(row.note_text || ""),
    createdBy: String(row.created_by || "User"),
    createdAt: String(row.created_at || row.updated_at || new Date().toISOString()),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

function buildCompletionNoteText(followUp: FollowUp) {
  const lines = [
    "Follow-up completed",
    `Date: ${new Date().toLocaleString()}`,
    `Title: ${followUp.title || "Follow-up"}`,
    `Type: ${followUp.type === "email" ? "Email" : "Call"}`,
  ];

  if (followUp.estimateRef) {
    lines.push(`Estimate: ${followUp.estimateRef}`);
  }

  if ((followUp.notes || "").trim()) {
    lines.push("");
    lines.push("Follow-up details:");
    lines.push(String(followUp.notes || "").trim());
  }

  return lines.join("\n");
}

function buildUserFollowUpNoteText(followUp: FollowUp, userText: string) {
  const lines = [
    "Follow-up note",
    `Date: ${new Date().toLocaleString()}`,
    `Title: ${followUp.title || "Follow-up"}`,
  ];

  if (followUp.estimateRef) {
    lines.push(`Estimate: ${followUp.estimateRef}`);
  }

  lines.push("");
  lines.push("User note:");
  lines.push(userText.trim());

  return lines.join("\n");
}

function followUpLatestActivityAt(followUp: FollowUp, latestNote?: NoteEntry | null) {
  return String(latestNote?.updatedAt || latestNote?.createdAt || followUp.createdAt || "");
}

function isFollowUpOverdue(followUp: FollowUp, todayISO: string) {
  return followUp.status !== "done" && String(followUp.dueDateISO || "") < todayISO;
}

function compareFollowUpsByActivity(left: FollowUp, right: FollowUp, latestNoteByFollowUpId: Map<string, NoteEntry>, todayISO: string) {
  const leftOverdue = isFollowUpOverdue(left, todayISO);
  const rightOverdue = isFollowUpOverdue(right, todayISO);

  if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;
  if (left.status !== right.status) return left.status === "pending" ? -1 : 1;

  const leftActivity = followUpLatestActivityAt(left, latestNoteByFollowUpId.get(left.id) || null);
  const rightActivity = followUpLatestActivityAt(right, latestNoteByFollowUpId.get(right.id) || null);
  const activityCompare = rightActivity.localeCompare(leftActivity);
  if (activityCompare !== 0) return activityCompare;

  return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
}

export default function FollowUpsFeature({
  clients,
  onOpenClient,
}: {
  clients: Client[];
  onOpenClient: (clientId: ClientId) => void;
}) {
  const activeUserName = "User";
  const [now, setNow] = useState(() => new Date());
  const [selectedDateISO, setSelectedDateISO] = useState(() => toISODate(new Date()));
  const [selectedFollowUpId, setSelectedFollowUpId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteSavedToast, setNoteSavedToast] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [noteEntries, setNoteEntries] = useState<NoteEntry[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const [nextFollowUpProposal,setNextFollowUpProposal]=useState<{completed:FollowUp;dueAt:string}|null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const clientIds = Array.from(new Set(clients.map((client) => String(client.id)).filter(Boolean)));
        if (!clientIds.length) {
          if (!cancelled) {
            setFollowUps([]);
            setNoteEntries([]);
          }
          return;
        }

        const followUpResponses = await Promise.all(
          clientIds.map((clientId) =>
            apiFetch(`/api/followups?client_id=${encodeURIComponent(clientId)}`).catch(() => [])
          )
        );

        if (cancelled) return;

        const followUpRows = followUpResponses.flatMap((value) => (Array.isArray(value) ? value : [])) as ApiFollowUp[];

        const dedupedFollowUps = new Map<string, FollowUp>();
        followUpRows.forEach((row) => {
          const mapped = mapApiFollowUp(row, clients);
          if (!mapped.id) return;
          dedupedFollowUps.set(mapped.id, mapped);
        });

        const nextFollowUps = Array.from(dedupedFollowUps.values()).sort((a, b) => {
          const dateCompare = String(a.dueDateISO).localeCompare(String(b.dueDateISO));
          if (dateCompare !== 0) return dateCompare;
          return String(a.createdAt).localeCompare(String(b.createdAt));
        });

        const noteResponses = await Promise.all(
          nextFollowUps.map((followUp) =>
            apiFetch(
              `/api/notes?client_id=${encodeURIComponent(String(followUp.clientId))}&followup_id=${encodeURIComponent(String(followUp.id))}&limit=100`
            ).catch(() => [])
          )
        );

        if (cancelled) return;

        const noteRows = noteResponses.flatMap((value) => (Array.isArray(value) ? value : [])) as ApiNote[];

        const dedupedNotes = new Map<string, NoteEntry>();
        noteRows.forEach((row) => {
          const mapped = mapApiNote(row);
          if (!mapped.id) return;
          if (!mapped.followupId) return;
          dedupedNotes.set(mapped.id, mapped);
        });

        const nextNotes = Array.from(dedupedNotes.values()).sort((a, b) => {
          const left = String(a.updatedAt || a.createdAt || "");
          const right = String(b.updatedAt || b.createdAt || "");
          return right.localeCompare(left);
        });

        setFollowUps(nextFollowUps);
        setNoteEntries(nextNotes);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load follow-up data", error);
        setFollowUps([]);
        setNoteEntries([]);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [clients, reloadToken]);

  const notesByFollowUpId = useMemo(() => {
    const map = new Map<string, NoteEntry[]>();
    noteEntries.forEach((entry) => {
      if (!entry.followupId) return;
      const list = map.get(entry.followupId) ?? [];
      list.push(entry);
      map.set(entry.followupId, list);
    });
    map.forEach((entries, key) => {
      entries.sort((a, b) => {
        const left = String(a.updatedAt || a.createdAt || "");
        const right = String(b.updatedAt || b.createdAt || "");
        return right.localeCompare(left);
      });
      map.set(key, entries);
    });
    return map;
  }, [noteEntries]);

  const latestNoteByFollowUpId = useMemo(() => {
    const map = new Map<string, NoteEntry>();
    notesByFollowUpId.forEach((entries, key) => {
      if (entries.length) map.set(key, entries[0]);
    });
    return map;
  }, [notesByFollowUpId]);

  const followUpsByDate = useMemo(() => {
    const m = new Map<string, FollowUp[]>();
    for (const fu of followUps) {
      const k = fu.dueDateISO;
      const arr = m.get(k) ?? [];
      arr.push(fu);
      m.set(k, arr);
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      m.set(k, arr);
    }
    return m;
  }, [followUps]);

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const monthDays = useMemo(() => {
    const start = new Date(monthStart);
    const day = start.getDay();
    const mondayIndex = (day + 6) % 7;
    const gridStart = addDays(start, -mondayIndex);

    const end = new Date(monthEnd);
    const endDay = end.getDay();
    const endMondayIndex = (endDay + 6) % 7;
    const gridEnd = addDays(end, (6 - endMondayIndex));

    const out: Date[] = [];
    for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) out.push(new Date(d));
    return out;
  }, [monthStart.getTime(), monthEnd.getTime()]);

  const todayISO = toISODate(new Date());
  const selectedList = useMemo(() => {
    const items = [...(followUpsByDate.get(selectedDateISO) ?? [])];
    items.sort((left, right) => compareFollowUpsByActivity(left, right, latestNoteByFollowUpId, todayISO));
    return items;
  }, [followUpsByDate, selectedDateISO, latestNoteByFollowUpId, todayISO]);
  const selectedFollowUp = selectedList.find((x) => x.id === selectedFollowUpId) ?? null;
  const selectedFollowUpNotes = selectedFollowUp ? (notesByFollowUpId.get(selectedFollowUp.id) ?? []) : [];
  const latestSelectedFollowUpNote = selectedFollowUpNotes[0] ?? null;

  useEffect(() => {
    setSelectedFollowUpId((prev) => {
      if (!selectedList.length) return null;
      if (prev && selectedList.some((x) => x.id === prev)) return prev;
      return selectedList[0].id;
    });
  }, [selectedDateISO, selectedList]);

  useEffect(() => {
    setNoteText("");
    setNoteSavedToast(null);
  }, [selectedFollowUpId]);

  function gotoPrevMonth() {
    setNow((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function gotoNextMonth() {
    setNow((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  async function createFollowUpNote(followUp: FollowUp, noteBody: string) {
    await apiFetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: uid(),
        client_id: followUp.clientId,
        estimate_id: followUp.estimateId || null,
        followup_id: followUp.id,
        category: "follow_up",
        note_text: noteBody,
        created_by: activeUserName,
      }),
    });

  }

  async function markDone(id: string) {
    const existing = followUps.find((item) => item.id === id);
    if (!existing) return;

    try {
      await apiFetch(`/api/followups/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: existing.clientId,
          estimate_id: existing.estimateId || null,
          title: existing.title,
          notes: existing.notes || "",
          due_at: existing.dueDateISO,
          status: "done",
        }),
      });

      if (existing.status !== "done") {
        await createFollowUpNote(existing, buildCompletionNoteText(existing));
        if(existing.issuedQuotationId){const recommendation=buildNextFollowUpRecommendation(existing);setNextFollowUpProposal({completed:existing,dueAt:recommendation.dueAt})}
      }

      setFollowUps((prev) => prev.map((item) => (item.id !== id ? item : { ...item, status: "done" })));
      setNoteSavedToast(existing.issuedQuotationId ? "Marked done. Confirm the proposed next quotation follow-up." : "Marked follow-up as done.");
      setTimeout(() => setNoteSavedToast(null), 1500);
      setReloadToken((value) => value + 1);
    } catch (error) {
      console.error("Failed to update follow-up", error);
      setNoteSavedToast("Failed to update follow-up.");
      setTimeout(() => setNoteSavedToast(null), 1500);
    }
  }

  async function addFollowUpNoteFromPanel() {
    if (!selectedFollowUp) return;
    const txt = (noteText ?? "").trim();
    if (!txt) return;

    try {
      await createFollowUpNote(selectedFollowUp, buildUserFollowUpNoteText(selectedFollowUp, txt));
      setNoteText("");
      setNoteSavedToast(selectedFollowUp.estimateId ? "Saved estimate-linked follow-up note." : "Saved client follow-up note.");
      setTimeout(() => setNoteSavedToast(null), 1500);
      setReloadToken((value) => value + 1);
    } catch (error) {
      console.error("Failed to save follow-up note", error);
      setNoteSavedToast("Failed to save follow-up note.");
      setTimeout(() => setNoteSavedToast(null), 1500);
    }
  }

  return (
    <div className="follow-ups">
      <div className="follow-ups__header">
        <div className="follow-ups__heading">
          <div className="follow-ups__title">Follow Ups</div>
          <div className="follow-ups__subtitle">By date • click a follow-up to view details and linked note history.</div>
        </div>

        {noteSavedToast ? (
          <div className="follow-ups__toast">{noteSavedToast}</div>
        ) : (
          <div className="follow-ups__meta">{selectedDateISO}</div>
        )}
      </div>

      <div className="follow-ups__grid">
        <div className="follow-ups__panel">
          <div className="follow-ups__panel-header follow-ups__panel-header--split">
            <button
              className="follow-ups__nav-button ui-button ui-button--icon"
              type="button"
              onClick={gotoPrevMonth}
              aria-label="Previous month"
              title="Previous month"
            >
              ←
            </button>
            <div className="follow-ups__month-label">
              {now.toLocaleString(undefined, { month: "long", year: "numeric" })}
            </div>
            <button
              className="follow-ups__nav-button ui-button ui-button--icon"
              type="button"
              onClick={gotoNextMonth}
              aria-label="Next month"
              title="Next month"
            >
              →
            </button>
          </div>

          <div className="follow-ups__panel-body">
            <div className="follow-ups__weekday-row">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="follow-ups__weekday">
                  {d}
                </div>
              ))}
            </div>

            <div className="follow-ups__calendar-grid">
              {monthDays.map((d) => {
                const iso = toISODate(d);
                const inMonth = d.getMonth() === now.getMonth();
                const count = (followUpsByDate.get(iso) ?? []).length;
                const isSelected = iso === selectedDateISO;
                const isToday = iso === toISODate(new Date());
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelectedDateISO(iso)}
                    className={`follow-ups__calendar-day ui-interactive-row${isSelected ? " follow-ups__calendar-day--selected" : ""}`}
                    data-month={inMonth ? "current" : "adjacent"}
                    title={iso}
                  >
                    {d.getDate()}
                    {isToday && !isSelected && (
                      <span className="follow-ups__calendar-today-dot" />
                    )}
                    {count > 0 && (
                      <span
                        className={`follow-ups__calendar-count${isSelected ? " follow-ups__calendar-count--selected" : ""}`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="follow-ups__panel">
          <div className="follow-ups__panel-header">Follow-ups on {selectedDateISO}</div>
          <div className="follow-ups__panel-body follow-ups__panel-body--list follow-ups__panel-body--scroll-360">
            {selectedList.length === 0 && <div className="follow-ups__empty">No follow-ups for this date.</div>}
            {selectedList.map((fu) => {
              const active = fu.id === selectedFollowUpId;
              const latestNote = latestNoteByFollowUpId.get(fu.id) || null;
              const overdue = isFollowUpOverdue(fu, todayISO);
              const latestActivityAt = followUpLatestActivityAt(fu, latestNote);
              return (
                <div
                  key={fu.id}
                  onClick={() => setSelectedFollowUpId(fu.id)}
                  className={`follow-ups__item ui-interactive-row${active ? " follow-ups__item--active" : overdue ? " follow-ups__item--overdue" : ""}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedFollowUpId(fu.id);
                    }
                  }}
                >
                  <div className="follow-ups__item-head">
                    <div className="follow-ups__item-title">{fu.title || "Follow-up"}</div>
                    <div className="follow-ups__item-status">
                      {fu.status === "done" ? "Done" : overdue ? "Overdue" : "Pending"}
                    </div>
                  </div>
                  <div className="follow-ups__item-copy">
                    {(fu.clientRef ? `${fu.clientRef} • ` : "")}{fu.clientName}
                    {fu.estimateRef ? ` • ${fu.estimateRef}` : ""}
                  </div>
                  {fu.notes ? <div className="follow-ups__item-notes">{fu.notes}</div> : null}
                  <div className="follow-ups__item-activity">
                    Latest activity: {latestActivityAt ? new Date(latestActivityAt).toLocaleString() : "—"}
                  </div>
                  <div className="follow-ups__item-note-card">
                    <div className="follow-ups__item-note-label">
                      Latest follow-up note
                    </div>
                    <div className="follow-ups__item-note-preview">
                      {latestNote ? toPreviewText(latestNote.noteText) : "No linked note yet."}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="follow-ups__panel">
          <div className="follow-ups__panel-header">Selected follow-up</div>
          <div className="follow-ups__panel-body follow-ups__panel-body--list follow-ups__panel-body--scroll-320">
            {!selectedFollowUp && <div className="follow-ups__empty">Select a follow-up.</div>}
            {selectedFollowUp && (
              <>
                <div className="follow-ups__detail-title">{selectedFollowUp.title}</div>
                <div className="follow-ups__detail-meta">
                  Client: {(selectedFollowUp.clientRef ? `${selectedFollowUp.clientRef} • ` : "")}{selectedFollowUp.clientName}
                </div>
                <div className="follow-ups__detail-meta">
                  Due: {selectedFollowUp.dueDateISO} • Created: {new Date(selectedFollowUp.createdAt).toLocaleString()}
                </div>
                <div className="follow-ups__detail-meta">
                  Status: {selectedFollowUp.status === "done" ? "Done" : isFollowUpOverdue(selectedFollowUp, todayISO) ? "Overdue" : "Pending"} • Latest activity: {followUpLatestActivityAt(selectedFollowUp, latestSelectedFollowUpNote) ? new Date(followUpLatestActivityAt(selectedFollowUp, latestSelectedFollowUpNote)).toLocaleString() : "—"}
                </div>
                {selectedFollowUp.estimateRef ? (
                  <div className="follow-ups__detail-meta">Estimate: {selectedFollowUp.estimateRef}</div>
                ) : null}

                <div className="follow-ups__actions">
                  <button
                    className="follow-ups__secondary-button ui-button"
                    type="button"
                    onClick={() => onOpenClient(selectedFollowUp.clientId)}
                  >
                    Open client
                  </button>
                  <button
                    className="follow-ups__primary-button ui-button ui-button--primary"
                    type="button"
                    onClick={() => markDone(selectedFollowUp.id)}
                  >
                    Mark done
                  </button>
                </div>

                <div className="follow-ups__latest-note">
                  <div className="follow-ups__latest-note-label">
                    Latest linked note
                  </div>
                  <div className="follow-ups__latest-note-text">
                    {latestSelectedFollowUpNote ? latestSelectedFollowUpNote.noteText : "No linked follow-up note yet."}
                  </div>
                  {latestSelectedFollowUpNote ? (
                    <div className="follow-ups__note-meta">
                      {latestSelectedFollowUpNote.createdBy} • {new Date(latestSelectedFollowUpNote.updatedAt || latestSelectedFollowUpNote.createdAt).toLocaleString()}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="follow-ups__panel">
          <div className="follow-ups__panel-header">
            Add follow-up note
          </div>
          <div className="follow-ups__panel-body follow-ups__composer">
            <div className="follow-ups__composer-copy">
              {selectedFollowUp?.estimateId
                ? "This note will be linked to the follow-up and estimate history."
                : "This note will be linked to the follow-up and client history."}
            </div>

            <textarea
              className="follow-ups__textarea"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={selectedFollowUp ? "Type a follow-up note..." : "Select a follow-up first."}
              disabled={!selectedFollowUp}
              dir="ltr"
            />

            <button
              className="follow-ups__save-button ui-button ui-button--primary"
              type="button"
              onClick={addFollowUpNoteFromPanel}
              disabled={!selectedFollowUp || !noteText.trim()}
            >
              {selectedFollowUp?.estimateId ? "Save note to follow-up + estimate" : "Save note to follow-up + client"}
            </button>
          </div>
        </div>
      </div>
      {nextFollowUpProposal?<div className="ui-modal-backdrop" role="presentation"><section className="ui-modal follow-ups__next-proposal" role="dialog" aria-modal="true" aria-labelledby="next-follow-up-title"><header><div><h3 id="next-follow-up-title">Schedule next Follow Up</h3><p>The completed quotation Follow Up remains linked to its Client, Estimate, issued quotation and communication.</p></div></header><label className="ui-field"><span>Next Follow Up date</span><input className="ui-input" type="date" value={nextFollowUpProposal.dueAt} onChange={event=>setNextFollowUpProposal(current=>current?{...current,dueAt:event.currentTarget.value}:current)}/></label><div className="ui-action-row"><button className="ui-button" type="button" onClick={()=>{setNextFollowUpProposal(null);setNoteSavedToast("No further follow-up scheduled.")}}>No further follow-up</button><button className="ui-button ui-button--primary" type="button" disabled={!/^\d{4}-\d{2}-\d{2}$/.test(nextFollowUpProposal.dueAt)} onClick={()=>void createNextFollowUpForCompleted({apiFetchJson:apiFetch,activeUserName,completed:nextFollowUpProposal.completed,dueAt:nextFollowUpProposal.dueAt}).then(()=>{setNextFollowUpProposal(null);setNoteSavedToast("Scheduled the next linked quotation follow-up.");setReloadToken(value=>value+1)}).catch(error=>{console.error("Failed to schedule next follow-up",error);setNoteSavedToast(error instanceof Error?error.message:"Failed to schedule next follow-up.")})}>Create Follow Up</button></div></section></div>:null}
    </div>
  );
}
