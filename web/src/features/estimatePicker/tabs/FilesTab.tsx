import React from "react";
import type { ClientFile } from "../../../models/types";
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
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <H3>Files</H3>
        <Small>Links to SharePoint/Drive/OneDrive/local paths.</Small>
      </div>

      <div style={{ display: "grid", gap: 10, borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <Small>Label</Small>
          <input value={props.clientFileLabel} onChange={(e) => props.setClientFileLabel(e.currentTarget.value)} placeholder="e.g. Site photos / Survey PDF / CAD" style={{ height: 38, borderRadius: 12, border: "1px solid #e4e4e7", padding: "0 12px" }} />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <Small>URL / Path</Small>
          <input value={props.clientFileUrl} onChange={(e) => props.setClientFileUrl(e.currentTarget.value)} placeholder="https://...  or  C:\path\file.pdf" style={{ height: 38, borderRadius: 12, border: "1px solid #e4e4e7", padding: "0 12px" }} />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <Small>Attach files (optional)</Small>
          <input type="file" multiple accept=".dwg,.dxf,.xls,.xlsx,.doc,.docx,.pdf,.skp,.png,.jpg,.jpeg,.webp,.txt" onChange={(e) => {
            const names = Array.from(e.currentTarget.files ?? []).map((f) => f.name);
            props.setClientFileNames(names);
          }} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={() => {
            if (!props.clientFileUrl.trim()) return;
            window.open(props.clientFileUrl, "_blank");
          }}>Open link</Button>

          <Button variant="primary" onClick={() => {
            const url = props.clientFileUrl.trim();
            if (!url) return;
            const addedAt = new Date().toISOString();
            props.setClientFiles((prev) => [
              { id: "file_" + addedAt, label: (props.clientFileLabel || "File").trim(), url, addedAt, addedBy: props.activeUserName, fileNames: props.clientFileNames },
              ...prev,
            ]);
            props.setClientFileLabel("");
            props.setClientFileUrl("");
            props.setClientFileNames([]);
          }}>Add</Button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {props.clientFiles.map((f) => (
          <div key={f.id} style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 800 }}>{f.label}</div>
                <Small style={{ wordBreak: "break-all" }}>{f.url}</Small>
              </div>
              <div style={{ display: "grid", justifyItems: "end", gap: 4 }}>
                <Small>{new Date(f.addedAt).toLocaleString()}</Small>
                <Small>By: {f.addedBy}</Small>
              </div>
            </div>

            {!!(f.fileNames && f.fileNames.length) && (
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {f.fileNames.map((n) => <Pill key={n}>{n}</Pill>)}
              </div>
            )}

            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
              <Button variant="secondary" onClick={() => window.open(f.url, "_blank")}>Open link</Button>
            </div>
          </div>
        ))}
        {props.clientFiles.length === 0 && (
          <div style={{ borderRadius: 14, border: "1px dashed #e4e4e7", padding: 14 }}>
            <Small>No files yet.</Small>
          </div>
        )}
      </div>
    </div>
  );
}
