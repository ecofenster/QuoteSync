import React, { useEffect, useMemo, useState } from "react";
import type { Client, ClientId } from "../../models/types";
import { appendClientNote } from "../../services/clientNotesStore";
import * as Models from "../../models/types";

type FollowUp = {
  id: string;
  clientId: ClientId;
  clientName: string;
  clientRef?: string;
  estimateId?: string;
  estimateRef?: string;
  dueDateISO: string; // YYYY-MM-DD
  title: string;
  notes?: string;
  status?: "pending" | "done";
  type?: "call" | "email";
  createdAt: string;
  sendEmail?: boolean;
  needsCall?: boolean;
};

const STORAGE_KEY = "qs_followups_v1";

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

function loadFollowUpsSafe(): FollowUp[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as FollowUp[];
  } catch {
    return [];
  }
}

function saveFollowUpsSafe(list: FollowUp[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list ?? []));
  } catch {
    // ignore
  }
}

function escapeHtml(s: string) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function FollowUpsFeature({
  clients,
  onOpenClient,
}: {
  clients: Client[];
  onOpenClient: (clientId: ClientId) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const [selectedDateISO, setSelectedDateISO] = useState(() => toISODate(new Date()));
  const [selectedFollowUpId, setSelectedFollowUpId] = useState<string | null>(null);

  const [noteText, setNoteText] = useState("");
  const [noteSavedToast, setNoteSavedToast] = useState<string | null>(null);

  // Keep clock fresh for "today" highlight (not critical)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const followUps = useMemo(() => loadFollowUpsSafe(), [noteSavedToast]); // re-load after save note toast
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
    // Build a simple 7-column grid, starting Monday
    const start = new Date(monthStart);
    const day = start.getDay(); // 0 Sun..6 Sat
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

  const selectedList = followUpsByDate.get(selectedDateISO) ?? [];
  const selectedFollowUp = selectedList.find((x) => x.id === selectedFollowUpId) ?? null;

  useEffect(() => {
    // If date changes, select first item
    setSelectedFollowUpId((prev) => {
      if (!selectedList.length) return null;
      if (prev && selectedList.some((x) => x.id === prev)) return prev;
      return selectedList[0].id;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateISO]);

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

  function markDone(id: string) {
    const list = loadFollowUpsSafe();
    const next = list.map((x) => (x.id !== id ? x : { ...x, status: "done" as const }));
    saveFollowUpsSafe(next);
    setNoteSavedToast("Updated follow-up.");
    setTimeout(() => setNoteSavedToast(null), 1500);
  }

  function addClientNoteFromFollowUp() {
    if (!selectedFollowUp) return;
    const txt = (noteText ?? "").trim();
    if (!txt) return;

    const html = `<div dir="ltr">${escapeHtml(txt).replace(/\r?\n/g, "<br/>")}</div>`;
    appendClientNote(selectedFollowUp.clientId, {
      id: Models.asNoteId(uid()),
      html,
      createdAt: new Date().toISOString(),
      createdBy: "User",
    });

    setNoteText("");
    setNoteSavedToast("Saved client note.");
    setTimeout(() => setNoteSavedToast(null), 1500);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 2 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>Follow Ups</div>
          <div style={{ fontSize: 12, color: "#71717a" }}>By date • click a follow-up to view details.</div>
        </div>

        {noteSavedToast ? (
          <div style={{ fontSize: 12, fontWeight: 900, color: "#16a34a" }}>{noteSavedToast}</div>
        ) : (
          <div style={{ fontSize: 12, color: "#71717a" }}>{selectedDateISO}</div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "360px 260px",
          gap: 12,
        }}
      >
        {/* Top-left: Calendar */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottom: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={gotoPrevMonth}
              style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fff", padding: "8px 10px", cursor: "pointer", fontWeight: 900 }}
            >
              ←
            </button>
            <div style={{ fontWeight: 900 }}>
              {now.toLocaleString(undefined, { month: "long", year: "numeric" })}
            </div>
            <button
              type="button"
              onClick={gotoNextMonth}
              style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fff", padding: "8px 10px", cursor: "pointer", fontWeight: 900 }}
            >
              →
            </button>
          </div>

          <div style={{ padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 8 }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", textAlign: "center" }}>
                  {d}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
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
                    style={{
                      borderRadius: 12,
                      border: isSelected ? "2px solid #18181b" : "1px solid #e4e4e7",
                      background: isSelected ? "#18181b" : "#fff",
                      color: isSelected ? "#fff" : "#111827",
                      padding: "10px 0",
                      cursor: "pointer",
                      opacity: inMonth ? 1 : 0.4,
                      position: "relative",
                      fontWeight: 900,
                    }}
                    title={iso}
                  >
                    {d.getDate()}
                    {isToday && !isSelected && (
                      <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 999, background: "#16a34a" }} />
                    )}
                    {count > 0 && (
                      <span
                        style={{
                          position: "absolute",
                          bottom: 6,
                          left: "50%",
                          transform: "translateX(-50%)",
                          fontSize: 10,
                          fontWeight: 900,
                          padding: "2px 6px",
                          borderRadius: 999,
                          border: isSelected ? "1px solid rgba(255,255,255,0.35)" : "1px solid #e4e4e7",
                          background: isSelected ? "rgba(255,255,255,0.18)" : "#f4f4f5",
                          color: isSelected ? "#fff" : "#111827",
                        }}
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

        {/* Top-right: List */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>Follow-ups on {selectedDateISO}</div>
          <div style={{ padding: 12, display: "grid", gap: 10, maxHeight: 360, overflow: "auto" }}>
            {selectedList.length === 0 && <div style={{ fontSize: 12, color: "#71717a" }}>No follow-ups for this date.</div>}
            {selectedList.map((fu) => {
              const active = fu.id === selectedFollowUpId;
              return (
                <div
                  key={fu.id}
                  onClick={() => setSelectedFollowUpId(fu.id)}
                  style={{
                    borderRadius: 14,
                    border: active ? "2px solid #18181b" : "1px solid #e4e4e7",
                    background: active ? "#18181b" : "#fff",
                    color: active ? "#fff" : "#111827",
                    padding: 10,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900, fontSize: 13 }}>{fu.title || "Follow-up"}</div>
                    <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.9 }}>
                      {fu.status === "done" ? "Done" : "Pending"}
                    </div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
                    {(fu.clientRef ? `${fu.clientRef} • ` : "")}{fu.clientName}
                    {fu.estimateRef ? ` • ${fu.estimateRef}` : ""}
                  </div>
                  {fu.notes ? <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>{fu.notes}</div> : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom-left: Details */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>Selected follow-up</div>
          <div style={{ padding: 12, display: "grid", gap: 10 }}>
            {!selectedFollowUp && <div style={{ fontSize: 12, color: "#71717a" }}>Select a follow-up.</div>}
            {selectedFollowUp && (
              <>
                <div style={{ fontWeight: 900, fontSize: 14 }}>{selectedFollowUp.title}</div>
                <div style={{ fontSize: 12, color: "#71717a" }}>
                  Client: {(selectedFollowUp.clientRef ? `${selectedFollowUp.clientRef} • ` : "")}{selectedFollowUp.clientName}
                </div>
                <div style={{ fontSize: 12, color: "#71717a" }}>
                  Due: {selectedFollowUp.dueDateISO} • Created: {new Date(selectedFollowUp.createdAt).toLocaleString()}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => onOpenClient(selectedFollowUp.clientId)}
                    style={{
                      borderRadius: 16,
                      border: "1px solid #e4e4e7",
                      background: "#fff",
                      padding: "10px 14px",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    Open client
                  </button>
                  <button
                    type="button"
                    onClick={() => markDone(selectedFollowUp.id)}
                    style={{
                      borderRadius: 16,
                      border: "none",
                      background: "#18181b",
                      color: "#fff",
                      padding: "10px 14px",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    Mark done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bottom-right: Add Note (client notes) */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>Add client note</div>
          <div style={{ padding: 12, display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, color: "#71717a" }}>
              This note is saved against the client (not project/estimate specific).
            </div>

            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={selectedFollowUp ? "Type a client note..." : "Select a follow-up first."}
              disabled={!selectedFollowUp}
              dir="ltr"
              style={{
                width: "100%",
                minHeight: 120,
                resize: "vertical",
                borderRadius: 14,
                border: "1px solid #e4e4e7",
                padding: 12,
                fontSize: 14,
                outline: "none",
                direction: "ltr",
                unicodeBidi: "plaintext",
              }}
            />

            <button
              type="button"
              onClick={addClientNoteFromFollowUp}
              disabled={!selectedFollowUp || !noteText.trim()}
              style={{
                borderRadius: 16,
                border: "none",
                background: "#18181b",
                color: "#fff",
                padding: "10px 14px",
                cursor: (!selectedFollowUp || !noteText.trim()) ? "not-allowed" : "pointer",
                fontWeight: 900,
                opacity: (!selectedFollowUp || !noteText.trim()) ? 0.55 : 1,
                justifySelf: "end",
              }}
            >
              Save note to client
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

