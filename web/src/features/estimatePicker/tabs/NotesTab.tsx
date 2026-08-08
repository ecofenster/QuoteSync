import React from "react";
import type { Client, EstimateId } from "../../../models/types";
import { Button, H3, Small, noteCategoryLabel, noteCategoryPillClassName } from "./shared";

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
    <div className="ep-shell">
      <div className="ep-pane-header">
        <H3>Client Notes</H3>
        <Small>Use one notes area and switch scope between account-only and estimate-linked notes.</Small>
      </div>

      <div className="ep-pane-card">
        <div className="ep-pane-header">
          <H3>{isEstimateNotesScope ? "Estimate Notes" : "Account Notes"}</H3>
          <Small>{activeNoteUpdatedAt ? `Latest entry: ${new Date(activeNoteUpdatedAt).toLocaleString()}` : "No notes yet."}</Small>
        </div>

        <div className="ep-note-controls-grid">
          <div className="ep-note-control">
            <Small>Notes: Choose client account specific note, or estimate specific note</Small>
            <select className="ep-select" value={props.notesScope} onChange={(e) => props.setNotesScope(e.currentTarget.value as "account" | "estimate")}>
              <option value="account">Account only</option>
              <option value="estimate">Selected estimate</option>
            </select>
          </div>

          <div className="ep-note-control">
            <Small>Category: Choose the correct option for the note type</Small>
            <select
              className="ep-select"
              value={activeNoteCategory}
              onChange={(e) => {
                const value = e.currentTarget.value as NoteCategory;
                if (isEstimateNotesScope) props.setEstimateNoteCategory(value);
                else props.setAccountNoteCategory(value);
              }}
            >
              <option value="general">General</option>
              <option value="follow_up">Follow Up</option>
              <option value="service">Service</option>
              <option value="installer">Installer</option>
              <option value="client_request">Client Request</option>
            </select>
          </div>

          <div className="ep-note-control">
            <Small>Filter notes: Remember to choose account or estimate &amp; estimate number</Small>
            <select
              className="ep-select"
              value={activeNoteFilter}
              onChange={(e) => {
                const value = e.currentTarget.value as NoteFilter;
                if (isEstimateNotesScope) props.setEstimateNoteFilter(value);
                else props.setAccountNoteFilter(value);
              }}
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
          <div className="ep-note-control">
            <Small>Select estimate to add note</Small>
            <select className="ep-select" value={props.selectedEstimateNoteId} onChange={(e) => props.setSelectedEstimateNoteId(e.currentTarget.value as EstimateId)}>
              {(props.pickerClient.estimates ?? []).map((estimate) => (
                <option key={estimate.id} value={estimate.id}>{estimate.estimateRef || estimate.id}</option>
              ))}
            </select>
          </div>
        )}

        {isEstimateNotesScope && props.pickerClient.estimates.length === 0 ? (
          <div className="ep-empty-state">
            <Small>No estimates yet, so no estimate notes can be added.</Small>
          </div>
        ) : (
          <>
            <textarea
              className="ep-textarea qs-migrated-258"
              value={activeNoteDraft}
              onChange={(e) => {
                if (isEstimateNotesScope) props.setEstimateNoteDraft(e.currentTarget.value);
                else props.setAccountNoteDraft(e.currentTarget.value);
              }}
              placeholder={isEstimateNotesScope ? "Write a new estimate note..." : "Write a new account note..."}
              dir="ltr"
            />

            <div className="ep-note-save-row">
              <Button
                variant="primary"
                disabled={props.notesSaving || !activeNoteDraft.trim() || (isEstimateNotesScope && !props.selectedEstimateNoteId)}
                onClick={() => void (isEstimateNotesScope ? props.saveEstimateNotes() : props.saveAccountNotes())}
              >
                {props.notesSaving ? "Saving..." : isEstimateNotesScope ? "Add Estimate Note" : "Add Account Note"}
              </Button>
            </div>

            <div className="ep-scroll-list ep-note-list">
              {activeFilteredNotes.length === 0 ? (
                <div className="ep-empty-state">
                  <Small>{isEstimateNotesScope ? "No estimate notes match this filter." : "No account notes match this filter."}</Small>
                </div>
              ) : (
                activeFilteredNotes.map((note) => (
                  <div key={note.id} className="ep-note-card">
                    <div className="ep-note-card-header">
                      <span className={`ep-note-pill ${noteCategoryPillClassName(note.category)}`.trim()}>
                        {noteCategoryLabel(note.category)}
                      </span>
                      <Small>{new Date(note.updatedAt || note.createdAt).toLocaleString()}</Small>
                    </div>
                    <div className="ep-note-body">{note.noteText}</div>
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
