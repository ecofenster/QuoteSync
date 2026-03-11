import React, { useEffect, useMemo, useState } from "react";
import type { Client } from "../../models/types";

/**
 * Phase 1 Follow Ups
 * - Left: lightweight calendar (month view)
 * - Right: follow-up list filtered by selected day
 * - Export .ics per follow-up so Outlook/Google/Apple can handle reminders + notifications.
 *
 * NOTE: Browser apps cannot trigger Outlook pop-up reminders directly.
 * Reminders must come from the user's actual calendar app (Outlook/Google), which is why we export .ics in Phase 1.
 */

type FollowUp = {
  id: string;
  clientId: string;
  clientName: string;
  clientRef?: string;
  estimateId?: string;
  estimateRef?: string;
  dueDateISO: string; // YYYY-MM-DD
  title: string;
  notes?: string;
  // For future: status, createdAt, updatedAt, owner, etc.
};

type Props = {
  clients: Client[];
  onOpenClient?: (clientId: string) => void;
};

const STORAGE_KEY = "qs_followups_v1";

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

function startOfWeekMon(d: Date) {
  // Monday = 0
  const day = (d.getDay() + 6) % 7;
  return addDays(d, -day);
}

function buildMonthGrid(month: Date) {
  const start = startOfWeekMon(startOfMonth(month));
  const end = endOfMonth(month);
  const endGrid = addDays(startOfWeekMon(addDays(end, 6)), 6); // ensure full weeks

  const days: Date[] = [];
  let cur = start;
  while (cur <= endGrid) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function icsEscape(s: string) {
  return (s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/**
 * Create an all-day calendar event for a follow-up date.
 * Many clients treat DTSTART;VALUE=DATE and DTEND;VALUE=DATE as all-day.
 * We include VALARM as a best-effort reminder; clients can adjust reminders after import.
 */
function buildICS(fu: FollowUp) {
  const dtStart = fu.dueDateISO.replaceAll("-", "");
  const due = new Date(fu.dueDateISO + "T00:00:00");
  const dtEnd = toISODate(addDays(due, 1)).replaceAll("-", "");

  const uid = `${fu.id}@quotesync.local`;
  const now = new Date();
  const dtStamp =
    `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}` +
    `T${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}${pad2(now.getUTCSeconds())}Z`;

  const summary = fu.title || `Follow up: ${fu.clientName}`;
  const descLines = [
    fu.clientRef ? `Client Ref: ${fu.clientRef}` : "",
    fu.estimateRef ? `Estimate: ${fu.estimateRef}` : "",
    fu.notes ? `Notes: ${fu.notes}` : "",
  ].filter(Boolean);

  const description = descLines.join("\n");

  // Default reminder: 30 minutes before (many clients will interpret for all-day as morning reminder)
  const ics =
    "BEGIN:VCALENDAR\r\n" +
    "VERSION:2.0\r\n" +
    "PRODID:-//QuoteSync//FollowUps//EN\r\n" +
    "CALSCALE:GREGORIAN\r\n" +
    "METHOD:PUBLISH\r\n" +
    "BEGIN:VEVENT\r\n" +
    `UID:${icsEscape(uid)}\r\n` +
    `DTSTAMP:${dtStamp}\r\n` +
    `DTSTART;VALUE=DATE:${dtStart}\r\n` +
    `DTEND;VALUE=DATE:${dtEnd}\r\n` +
    `SUMMARY:${icsEscape(summary)}\r\n` +
    `DESCRIPTION:${icsEscape(description)}\r\n` +
    "BEGIN:VALARM\r\n" +
    "ACTION:DISPLAY\r\n" +
    "DESCRIPTION:Reminder\r\n" +
    "TRIGGER:-PT30M\r\n" +
    "END:VALARM\r\n" +
    "END:VEVENT\r\n" +
    "END:VCALENDAR\r\n";

  return ics;
}

function loadFollowUps(): FollowUp[] {
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

function saveFollowUps(list: FollowUp[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export default function FollowUpsFeature({ clients, onOpenClient }: Props) {
  const todayISO = toISODate(new Date());

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedISO, setSelectedISO] = useState<string>(todayISO);
  const [items, setItems] = useState<FollowUp[]>(() => loadFollowUps());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    saveFollowUps(items);
  }, [items]);

  // Future: follow-ups will be created from an estimate action. For Phase 1 we provide a tiny "demo add" for testing.
  const canDemoAdd = items.length === 0;

  const monthDays = useMemo(() => buildMonthGrid(month), [month]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, FollowUp[]>();
    for (const fu of items) {
      const key = fu.dueDateISO;
      const arr = map.get(key) ?? [];
      arr.push(fu);
      map.set(key, arr);
    }
    // keep stable ordering: newest first
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => b.id.localeCompare(a.id));
      map.set(k, arr);
    }
    return map;
  }, [items]);

  const dayItems = itemsByDay.get(selectedISO) ?? [];

  const selectedFollowUp = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId]);

  const previousForClient = useMemo(() => {
    if (!selectedFollowUp) return [] as FollowUp[];
    return items
      .filter((x) => x.clientId === selectedFollowUp.clientId)
      .slice()
      .sort((a, b) => (a.dueDateISO < b.dueDateISO ? 1 : -1));
  }, [items, selectedFollowUp]);


  function prevMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }
  function nextMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  function demoAdd() {
    const c = clients[0];
    if (!c) return;

    const due = toISODate(addDays(new Date(), 7));
    const estimate = (c.estimates ?? [])[0] as any;

    const fu: FollowUp = {
      id: uid(),
      clientId: c.id,
      clientName: c.clientName ?? "Client",
      clientRef: (c as any).clientRef,
      estimateId: estimate?.id,
      estimateRef: estimate?.estimateRef,
      dueDateISO: due,
      title: `Follow up: ${c.clientName ?? "Client"}`,
      notes: "Demo follow-up (Phase 1).",
    };

    setItems((prev) => [fu, ...prev]);
    setSelectedISO(due);
    setMonth(startOfMonth(new Date(due + "T00:00:00")));
  }

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto auto", gap: 12, minHeight: 520 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {/* Left: Calendar */}
      <div style={{ border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>
            {month.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={prevMonth}
              style={{
                height: 32,
                padding: "0 10px",
                borderRadius: 12,
                border: "1px solid #e4e4e7",
                background: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ‹
            </button>
            <button
              onClick={nextMonth}
              style={{
                height: 32,
                padding: "0 10px",
                borderRadius: 12,
                border: "1px solid #e4e4e7",
                background: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ›
            </button>
          </div>
        </div>

        <div style={{ padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 8 }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} style={{ fontSize: 12, fontWeight: 900, color: "#6b7280", textAlign: "center" }}>
                {d}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {monthDays.map((d) => {
              const iso = toISODate(d);
              const inMonth = d.getMonth() === month.getMonth();
              const isSelected = iso === selectedISO;
              const hasItems = (itemsByDay.get(iso)?.length ?? 0) > 0;
              const isToday = iso === todayISO;

              return (
                <button
                  key={iso}
                  onClick={() => setSelectedISO(iso)}
                  style={{
                    height: 40,
                    borderRadius: 12,
                    border: isSelected ? "2px solid #16a34a" : "1px solid #e4e4e7",
                    background: "#fff",
                    color: inMonth ? "#111827" : "#9ca3af",
                    fontWeight: 900,
                    cursor: "pointer",
                    position: "relative",
                    outline: "none",
                    boxShadow: "none",
                    opacity: inMonth ? 1 : 0.7,
                  }}
                  title={iso}
                >
                  {d.getDate()}
                  {hasItems && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 6,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: "#16a34a",
                      }}
                    />
                  )}
                  {isToday && (
                    <span
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: "#111827",
                        opacity: 0.25,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
            Phase 1 uses <b>.ics export</b> so Outlook/Google can create reminders & pop-up notifications.
          </div>

          {canDemoAdd && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={demoAdd}
                style={{
                  height: 36,
                  padding: "0 12px",
                  borderRadius: 12,
                  border: "1px solid #e4e4e7",
                  background: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Add demo follow-up (Phase 1)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: List */}
      <div style={{ border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>Follow Ups</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {selectedISO} • {dayItems.length} item{dayItems.length === 1 ? "" : "s"}
          </div>
        </div>

        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          {dayItems.length === 0 && (
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.4 }}>
              No follow-ups for this day yet. <br />
              In the next step we’ll add an “Add follow-up” button inside Estimates that schedules these automatically.
            </div>
          )}

          {dayItems.map((fu) => (
            <div key={fu.id} onClick={() => setSelectedId(fu.id)} style={{ border: selectedId === fu.id ? "2px solid #16a34a" : "1px solid #e4e4e7", borderRadius: 14, padding: 12, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{fu.title}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    {fu.clientRef ? <b>{fu.clientRef}</b> : null} {fu.clientRef ? "• " : ""}
                    {fu.clientName}
                    {fu.estimateRef ? ` • ${fu.estimateRef}` : ""}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {onOpenClient && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenClient(fu.clientId); }}
                      style={{
                        height: 32,
                        padding: "0 10px",
                        borderRadius: 12,
                        border: "1px solid #e4e4e7",
                        background: "#fff",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Open
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const ics = buildICS(fu);
                      downloadTextFile(`FollowUp_${fu.clientRef ?? fu.clientName}_${fu.dueDateISO}.ics`, ics, "text/calendar");
                    }}
                    style={{
                      height: 32,
                      padding: "0 10px",
                      borderRadius: 12,
                      border: "1px solid #e4e4e7",
                      background: "#fff",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Export .ics
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); setItems((prev) => prev.filter((x) => x.id !== fu.id)); }}
                    style={{
                      height: 32,
                      padding: "0 10px",
                      borderRadius: 12,
                      border: "1px solid #e4e4e7",
                      background: "#fff",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>

              {fu.notes && <div style={{ marginTop: 8, fontSize: 13, color: "#374151" }}>{fu.notes}</div>}
            </div>
          ))}
        </div>
      </div>
      </div>

      {/* Bottom: details (only when a follow-up is selected) */}
      <div style={{ border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>Follow Up Details</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {selectedFollowUp ? `${selectedFollowUp.clientName} • ${selectedFollowUp.dueDateISO}` : "Select a follow-up (green) to see details."}
          </div>
        </div>

        <div style={{ padding: 12 }}>
          {!selectedFollowUp && (
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.4 }}>
              No follow-up selected.
              <br />
              Click an item in the list on the right (green highlight) to populate this panel.
            </div>
          )}

          {selectedFollowUp && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 13, color: "#374151" }}>
                <b>Client:</b> {selectedFollowUp.clientName} {selectedFollowUp.clientRef ? `• ${selectedFollowUp.clientRef}` : ""}
                <br />
                <b>Estimate:</b> {selectedFollowUp.estimateRef ?? "(linked)"} <br />
                <b>Due:</b> {selectedFollowUp.dueDateISO}
              </div>

              {selectedFollowUp.notes && (
                <div style={{ fontSize: 13, color: "#374151" }}>
                  <b>Follow up:</b> {selectedFollowUp.notes}
                </div>
              )}

              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Previous follow-ups, last client note, estimate link, and cost overview will be expanded here next.
              </div>

              {previousForClient.length > 0 && (
                <div style={{ fontSize: 13, color: "#374151" }}>
                  <b>Previous follow ups:</b>
                  <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                    {previousForClient.slice(0, 8).map((x) => (
                      <div key={x.id} style={{ fontSize: 12, color: "#6b7280" }}>
                        {x.dueDateISO} • {x.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {onOpenClient && (
                  <button
                    onClick={() => onOpenClient(selectedFollowUp.clientId)}
                    style={{
                      height: 32,
                      padding: "0 10px",
                      borderRadius: 12,
                      border: "1px solid #e4e4e7",
                      background: "#fff",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Open client
                  </button>
                )}

                <button
                  onClick={() => {
                    const ics = buildICS(selectedFollowUp);
                    downloadTextFile(
                      `FollowUp_${selectedFollowUp.clientRef ?? selectedFollowUp.clientName}_${selectedFollowUp.dueDateISO}.ics`,
                      ics,
                      "text/calendar"
                    );
                  }}
                  style={{
                    height: 32,
                    padding: "0 10px",
                    borderRadius: 12,
                    border: "1px solid #e4e4e7",
                    background: "#fff",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Export .ics
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}




