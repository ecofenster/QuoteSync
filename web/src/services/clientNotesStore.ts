import type { ClientId, ClientNote } from "../models/types";

/**
 * Client Notes Store (Phase 1)
 * - Client-specific notes (NOT estimate/project specific)
 * - Stored in localStorage per client
 * - Simple pub/sub so FollowUps + EstimatePicker stay consistent
 */

const KEY_PREFIX = "qs_client_notes_v1_";

function keyForClient(clientId: ClientId) {
  return `${KEY_PREFIX}${clientId}`;
}

function safeParse(raw: string | null): ClientNote[] {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ClientNote[];
  } catch {
    return [];
  }
}

function safeStringify(v: unknown) {
  try {
    return JSON.stringify(v);
  } catch {
    return "[]";
  }
}

type Listener = (notes: ClientNote[]) => void;
const listenersByClient = new Map<string, Set<Listener>>();

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

export function loadClientNotes(clientId: ClientId): ClientNote[] {
  try {
    return safeParse(localStorage.getItem(keyForClient(clientId)));
  } catch {
    return [];
  }
}

export function saveClientNotes(clientId: ClientId, notes: ClientNote[]) {
  try {
    localStorage.setItem(keyForClient(clientId), safeStringify(notes ?? []));
  } catch {
    // ignore storage errors
  }
  emit(clientId, notes ?? []);
}

export function appendClientNote(clientId: ClientId, note: ClientNote) {
  const list = loadClientNotes(clientId);
  const next = [note, ...list];
  saveClientNotes(clientId, next);
  return next;
}

export function subscribeClientNotes(clientId: ClientId, listener: Listener) {
  const k = String(clientId);
  const set = listenersByClient.get(k) ?? new Set<Listener>();
  set.add(listener);
  listenersByClient.set(k, set);

  // fire immediately with current value
  try {
    listener(loadClientNotes(clientId));
  } catch {
    // ignore
  }

  return () => {
    const s = listenersByClient.get(k);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) listenersByClient.delete(k);
  };
}

