import React from "react";
import type { Client, EstimateId } from "../../../models/types";
import { Button, H3, Small, noteCategoryLabel, noteCategoryPillStyle } from "./shared";

type NoteCategory = "general" | "follow_up" | "service" | "installer" | "client_request";
type NoteFilter = "all" | NoteCategory;
type Note = {
  id: string;
  category: NoteCategory;
  noteText: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
};

export default function NotesTab(props: {
  pickerClient: Client;
  notesScope: "account" | "estimate";
  setNotesScope: React.Dispatch<React.SetStateAction<"account" | "estimate">>;
  accountNotes: Note[];
  accountNoteFilter: NoteFilter;
  setAccountNoteFilter: React.Dispatch<React.SetStateAction<NoteFilter>>;
  accountNoteCategory: NoteCategory;
  setAccountNoteCategory: React.Dispatch<React.SetStateAction<NoteCategory>>;
  accountNoteDraft: string;
  setAccountNoteDraft: (value: string) => void;
  accountNoteUpdatedAt: string | null;
  selectedEstimateNoteId: EstimateId | "";
  setSelectedEstimateNoteId: React.Dispatch<React.SetStateAction<EstimateId | "">>;
  estimateNotes: Note[];
  estimateNoteFilter: NoteFilter;
  setEstimateNoteFilter: React.Dispatch<React.SetStateAction<NoteFilter>>;
  estimateNoteCategory: NoteCategory;
  setEstimateNoteCategory: React.Dispatch<React.SetStateAction<NoteCategory>>;
  estimateNoteDraft: string;
  setEstimateNoteDraft: (value: string) => void;
  estimateNoteUpdatedAt: string | null;
  notesSaving: boolean;
  saveAccountNotes: () => void | Promise<void>;
  saveEstimateNotes: () => void | Promise<void>;
}) {
  const filteredAccountNotes = (props.accountNotes ?? []).filter((note) => props.accountNoteFilter === "all" || note.category === props.accountNoteFilter);
  const filteredEstimateNotes = (props.estimateNotes ?? []).filter((note) => props.estimateNoteFilter === "all" || note.category === props.estimateNoteFilter);
  const isEstimateNotesScope = props.notesScope === "estimate";
  const activeNoteCategory = isEstimateNotesScope ? props.estimateNoteCategory : props.accountNoteCategory;
  const activeNoteFilter = isEstimateNotesScope ? props.estimateNoteFilter : props.accountNoteFilter;
  const activeNoteDraft = isEstimateNotesScope ? props.estimateNoteDraft : props.accountNoteDraft;
  const activeNoteUpdatedAt = isEstimateNotesScope ? props.estimateNoteUpdatedAt : props.accountNoteUpdatedAt;
  const activeFilteredNotes = isEstimateNotesScope ? filteredEstimateNotes : filteredAccountNotes;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <H3>Client Notes</H3>
        <Small>Use one notes area and switch scope between account-only and estimate-linked notes.</Small>
      </div>

      <div style={{ display: "grid", gap: 12, borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <H3>{isEstimateNotesScope ? "Estimate Notes" : "Account Notes"}</H3>
          <Small>{activeNoteUpdatedAt ? `Latest entry: ${new Date(activeNoteUpdatedAt).toLocaleString()}` : "No notes yet."}</Small>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr))", gap: 10 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <Small>Notes: Choose client account specific note, or estimate specific note</Small>
            <select value={props.notesScope} onChange={(e) => props.setNotesScope(e.currentTarget.value as "account" | "estimate")} style={{ height: 38, borderRadius: 12, border: "1px solid #e4e4e7", padding: "0 12px", background: "#fff" }}>
              <option value="account">Account only</option>
              <option value="estimate">Selected estimate</option>
            </select>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <Small>Category: Choose the correct option for the note type</Small>
            <select
              value={activeNoteCategory}
              onChange={(e) => {
                const value = e.currentTarget.value as NoteCategory;
                if (isEstimateNotesScope) props.setEstimateNoteCategory(value);
                else props.setAccountNoteCategory(value);
              }}
              style={{ height: 38, borderRadius: 12, border: "1px solid #e4e4e7", padding: "0 12px", background: "#fff" }}
            >
              <option value="general">General</option>
              <option value="follow_up">Follow Up</option>
              <option value="service">Service</option>
              <option value="installer">Installer</option>
              <option value="client_request">Client Request</option>
            </select>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <Small>Filter notes: Remember to choose account or estimate &amp; estimate number</Small>
            <select
              value={activeNoteFilter}
              onChange={(e) => {
                const value = e.currentTarget.value as NoteFilter;
                if (isEstimateNotesScope) props.setEstimateNoteFilter(value);
                else props.setAccountNoteFilter(value);
              }}
              style={{ height: 38, borderRadius: 12, border: "1px solid #e4e4e7", padding: "0 12px", background: "#fff" }}
            >
              <option value="all">All</option>
              <option value="general">General</option>
              <option value="follow_up">Follow Ups</option>
              <option value="service">Service</option>
              <option value="installer">Installer</option>
              <option value="client_request">Client Request</option>
            </select>
          </div>
        </div>

        {isEstimateNotesScope && (
          <div style={{ display: "grid", gap: 6 }}>
            <Small>Select estimate to add note</Small>
            <select value={props.selectedEstimateNoteId} onChange={(e) => props.setSelectedEstimateNoteId(e.currentTarget.value as EstimateId)} style={{ height: 38, borderRadius: 12, border: "1px solid #e4e4e7", padding: "0 12px", background: "#fff" }}>
              {(props.pickerClient.estimates ?? []).map((estimate) => (
                <option key={estimate.id} value={estimate.id}>{estimate.estimateRef || estimate.id}</option>
              ))}
            </select>
          </div>
        )}

        {isEstimateNotesScope && props.pickerClient.estimates.length === 0 ? (
          <div style={{ borderRadius: 14, border: "1px dashed #e4e4e7", padding: 14 }}>
            <Small>No estimates yet, so no estimate notes can be added.</Small>
          </div>
        ) : (
          <>
            <textarea
              value={activeNoteDraft}
              onChange={(e) => {
                if (isEstimateNotesScope) props.setEstimateNoteDraft(e.currentTarget.value);
                else props.setAccountNoteDraft(e.currentTarget.value);
              }}
              placeholder={isEstimateNotesScope ? "Write a new estimate note..." : "Write a new account note..."}
              dir="ltr"
              style={{ minHeight: 160, borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fff", outline: "none", direction: "ltr", unicodeBidi: "plaintext", width: "100%", boxSizing: "border-box", resize: "vertical", font: "inherit" }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="primary"
                disabled={props.notesSaving || !activeNoteDraft.trim() || (isEstimateNotesScope && !props.selectedEstimateNoteId)}
                onClick={() => void (isEstimateNotesScope ? props.saveEstimateNotes() : props.saveAccountNotes())}
              >
                {props.notesSaving ? "Saving..." : isEstimateNotesScope ? "Add Estimate Note" : "Add Account Note"}
              </Button>
            </div>

            <div style={{ display: "grid", gap: 10, minHeight: 520, maxHeight: 520, overflow: "auto" }}>
              {activeFilteredNotes.length === 0 ? (
                <div style={{ borderRadius: 14, border: "1px dashed #e4e4e7", padding: 14 }}>
                  <Small>{isEstimateNotesScope ? "No estimate notes match this filter." : "No account notes match this filter."}</Small>
                </div>
              ) : (
                activeFilteredNotes.map((note) => (
                  <div key={note.id} style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa", display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 800, ...noteCategoryPillStyle(note.category) }}>
                        {noteCategoryLabel(note.category)}
                      </span>
                      <Small>{new Date(note.updatedAt || note.createdAt).toLocaleString()}</Small>
                    </div>
                    <div style={{ fontSize: 14, color: "#18181b", whiteSpace: "pre-wrap" }}>{note.noteText}</div>
                    <Small>By {note.createdBy}</Small>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
