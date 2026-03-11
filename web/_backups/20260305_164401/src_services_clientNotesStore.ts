import type { ClientNote } from "../models/types";

const PREFIX = "qs_client_notes_v1_";
const EVT = "qs_client_notes_changed";

export function loadClientNotes(clientId: string): ClientNote[] {
  try {
    const raw = localStorage.getItem(PREFIX + clientId);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? (p as ClientNote[]) : [];
  } catch {
    return [];
  }
}

export function saveClientNotes(clientId: string, notes: ClientNote[]) {
  try {
    localStorage.setItem(PREFIX + clientId, JSON.stringify(notes ?? []));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(EVT, { detail: { clientId } }));
  } catch {
    // ignore
  }
}

export function appendClientNote(clientId: string, note: ClientNote) {
  const list = loadClientNotes(clientId);
  const next = [note, ...list];
  saveClientNotes(clientId, next);
  return next;
}

export function subscribeClientNotes(cb: (clientId: string) => void) {
  const fn = (e: any) => {
    if (e?.detail?.clientId) cb(e.detail.clientId);
  };
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
}
