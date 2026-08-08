import React from "react";
import { asFileId, type ClientFile } from "../../../models/types";
import { Button, H3, Pill, Small } from "./shared";

export default function FilesTab(props: {
  clientFileLabel: string;
  setClientFileLabel: (v: string) => void;
  clientFileUrl: string;
  setClientFileUrl: (v: string) => void;
  clientFileNames: string[];
  setClientFileNames: (v: string[]) => void;
  clientFiles: ClientFile[];
  setClientFiles: React.Dispatch<React.SetStateAction<ClientFile[]>>;
  activeUserName: string;
}) {
  return (
    <div className="ep-section-shell">
      <div className="ep-section-header">
        <H3>Files</H3>
        <Small>Links to SharePoint/Drive/OneDrive/local paths.</Small>
      </div>

      <div className="ep-pane-card ep-files-form">
        <div className="ep-files-field">
          <Small>Label</Small>
          <input className="ep-files-input" value={props.clientFileLabel} onChange={(e) => props.setClientFileLabel(e.currentTarget.value)} placeholder="e.g. Site photos / Survey PDF / CAD" />
        </div>

        <div className="ep-files-field">
          <Small>URL / Path</Small>
          <input className="ep-files-input" value={props.clientFileUrl} onChange={(e) => props.setClientFileUrl(e.currentTarget.value)} placeholder="https://...  or  C:\path\file.pdf" />
        </div>

        <div className="ep-files-field">
          <Small>Attach files (optional)</Small>
          <input type="file" multiple accept=".dwg,.dxf,.xls,.xlsx,.doc,.docx,.pdf,.skp,.png,.jpg,.jpeg,.webp,.txt" onChange={(e) => {
            const names = Array.from(e.currentTarget.files ?? []).map((f) => f.name);
            props.setClientFileNames(names);
          }} />
        </div>

        <div className="ep-files-actions">
          <Button variant="secondary" onClick={() => {
            if (!props.clientFileUrl.trim()) return;
            window.open(props.clientFileUrl, "_blank");
          }}>Open link</Button>

          <Button variant="primary" onClick={() => {
            const url = props.clientFileUrl.trim();
            if (!url) return;
            const addedAt = new Date().toISOString();
            props.setClientFiles((prev) => [
              { id: asFileId("file_" + addedAt), label: (props.clientFileLabel || "File").trim(), url, addedAt, addedBy: props.activeUserName, fileNames: props.clientFileNames },
              ...prev,
            ]);
            props.setClientFileLabel("");
            props.setClientFileUrl("");
            props.setClientFileNames([]);
          }}>Add</Button>
        </div>
      </div>

      <div className="ep-files-list">
        {props.clientFiles.map((f) => (
          <div key={f.id} className="ep-files-card">
            <div className="ep-files-card-header">
              <div className="ep-files-card-main">
                <div className="ep-files-card-title">{f.label}</div>
                <Small className="qs-migrated-257">{f.url}</Small>
              </div>
              <div className="ep-files-card-meta">
                <Small>{new Date(f.addedAt).toLocaleString()}</Small>
                <Small>By: {f.addedBy}</Small>
              </div>
            </div>

            {!!(f.fileNames && f.fileNames.length) && (
              <div className="ep-files-pill-row">
                {f.fileNames.map((n) => <Pill key={n}>{n}</Pill>)}
              </div>
            )}

            <div className="ep-files-link-row">
              <Button variant="secondary" onClick={() => window.open(f.url, "_blank")}>Open link</Button>
            </div>
          </div>
        ))}
        {props.clientFiles.length === 0 && (
          <div className="ep-empty-state">
            <Small>No files yet.</Small>
          </div>
        )}
      </div>
    </div>
  );
}
