import type { ClientId, ClientNote } from "../models/types";

const API_BASE_URL = "http://localhost:3001";

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function htmlToPlainText(value: string) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>\s*<div[^>]*>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function notesToPlainText(notes: ClientNote[]) {
  return (notes ?? [])
    .map((note) => {
      const body = htmlToPlainText((note as any)?.html || "").trim();
      if (!body) return "";
      const by = String((note as any)?.createdBy || "").trim();
      return by ? `${body}\n— ${by}` : body;
    })
    .filter(Boolean)
    .join("\n\n");
}

function dbTextToClientNotes(clientId: ClientId, noteText: string, updatedAt?: string | null): ClientNote[] {
  const normalized = String(noteText ?? "").trim();
  if (!normalized) return [];
  return [
    {
      id: (`client-note-${clientId}` as any),
      html: escapeHtml(normalized).replace(/\r?\n/g, "<br/>"),
      createdAt: String(updatedAt || new Date().toISOString()),
      createdBy: "User",
    } as ClientNote,
  ];
}

type Listener = (notes: ClientNote[]) => void;
const listenersByClient = new Map<string, Set<Listener>>();

async function requestJson(path: string, options?: RequestInit) {
  const res = await fetch(apiUrl(path), options);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `API request failed: ${res.status}`);
  }
  return res.json();
}

function emit(clientId: ClientId, notes: ClientNote[]) {
  const set = listenersByClient.get(String(clientId));
  if (!set || set.size === 0) return;
  for (const fn of set) {
    try {
      fn(notes);
    } catch {
      // ignore listener errors
    }
  }
}

export async function loadClientNotes(clientId: ClientId): Promise<ClientNote[]> {
  try {
    const data = await requestJson(`/api/client-notes?client_id=${encodeURIComponent(String(clientId))}`);
    return dbTextToClientNotes(clientId, String(data?.note_text || ""), data?.updated_at ?? null);
  } catch {
    return [];
  }
}

export async function saveClientNotes(clientId: ClientId, notes: ClientNote[]) {
  const noteText = notesToPlainText(notes);
  const saved = await requestJson(`/api/client-notes/${encodeURIComponent(String(clientId))}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note_text: noteText }),
  });
  const next = dbTextToClientNotes(clientId, String(saved?.note_text || ""), saved?.updated_at ?? null);
  emit(clientId, next);
  return next;
}

export async function appendClientNote(clientId: ClientId, note: ClientNote) {
  const current = await loadClientNotes(clientId);
  const currentText = notesToPlainText(current);
  const nextBody = htmlToPlainText((note as any)?.html || "").trim();
  const createdBy = String((note as any)?.createdBy || "").trim();
  const appendedText = [currentText, createdBy && nextBody ? `${nextBody}\n— ${createdBy}` : nextBody]
    .filter(Boolean)
    .join("\n\n");

  const saved = await requestJson(`/api/client-notes/${encodeURIComponent(String(clientId))}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note_text: appendedText }),
  });

  const next = dbTextToClientNotes(clientId, String(saved?.note_text || ""), saved?.updated_at ?? null);
  emit(clientId, next);
  return next;
}

export function subscribeClientNotes(clientId: ClientId, listener: Listener) {
  const k = String(clientId);
  const set = listenersByClient.get(k) ?? new Set<Listener>();
  set.add(listener);
  listenersByClient.set(k, set);

  loadClientNotes(clientId)
    .then((notes) => {
      try {
        listener(notes);
      } catch {
        // ignore
      }
    })
    .catch(() => {
      try {
        listener([]);
      } catch {
        // ignore
      }
    });

  return () => {
    const s = listenersByClient.get(k);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) listenersByClient.delete(k);
  };
}
