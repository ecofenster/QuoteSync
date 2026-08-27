import { useEffect, useMemo, useRef, useState } from "react";
import { documentRecordsApi, type CanonicalDocumentRecord, type CanonicalFolderRecord, type DocumentRecordsResult } from "../../services/documents/documentRecordsApi";
import { backExplorerHistory, buildFileExplorer, createExplorerHistory, explorerBreadcrumbs, explorerDirectory, forwardExplorerHistory, navigateExplorerHistory, resolveFolderUploadCapability, searchFileExplorer, type ExplorerEntry } from "./fileExplorerModel";

const providerLabel = (value:string) => ({ google_drive:"Google Drive", microsoft_onedrive:"OneDrive", microsoft_sharepoint:"SharePoint", quotesuite_managed:"QuoteSuite managed" }[value] || value.replaceAll("_", " "));
const formatSize = (bytes:number) => bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(bytes >= 10_485_760 ? 0 : 1)} MB` : bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes || 0} B`;
const formatDate = (value:string) => value ? new Date(value).toLocaleDateString("en-GB") : "—";
type UploadState="queued"|"uploading"|"uploaded"|"failed";
type UploadItem={id:string;file:File;folder:CanonicalFolderRecord;state:UploadState;error?:string;duplicateName?:boolean};

function FileDetails({document}:{document:CanonicalDocumentRecord}) {
  const localUrl = document.downloadUrl ? documentRecordsApi.downloadUrl(document.downloadUrl) : null;
  const previewImage = Boolean(localUrl && document.mediaType.startsWith("image/"));
  const previewPdf = Boolean(localUrl && document.mediaType === "application/pdf");
  return <aside className="file-explorer__details" aria-label="Selected file details">
    <header><span className="file-explorer__file-icon" aria-hidden="true">▤</span><div><strong>{document.fileName}</strong><small>{providerLabel(document.provider)}</small></div></header>
    {previewImage ? <img className="file-explorer__preview-image" src={localUrl || undefined} alt={`Preview of ${document.fileName}`}/> : null}
    {previewPdf ? <iframe className="file-explorer__preview-frame" src={localUrl || undefined} title={`Preview of ${document.fileName}`} sandbox="" referrerPolicy="no-referrer"/> : null}
    {!previewImage && !previewPdf ? <div className="file-explorer__preview-unavailable"><strong>Preview unavailable</strong><span>Open the file using its existing safe document or provider action.</span></div> : null}
    <dl><div><dt>Type</dt><dd>{document.mediaType || "Unknown"}</dd></div><div><dt>Size</dt><dd>{formatSize(document.sizeBytes)}</dd></div><div><dt>Modified</dt><dd>{formatDate(document.modifiedAt)}</dd></div><div><dt>Classification</dt><dd>{document.documentType.replaceAll("_", " ")}</dd></div>{document.supplierName ? <div><dt>Supplier</dt><dd>{document.supplierName}</dd></div> : null}{document.projectName || document.estimateRef ? <div><dt>Relationship</dt><dd>{[document.projectName, document.estimateRef].filter(Boolean).join(" · ")}</dd></div> : null}</dl>
    <div className="ui-action-row">{localUrl ? <a className="ui-button ui-button--ghost" href={localUrl}>Open</a> : null}{localUrl ? <a className="ui-button ui-button--ghost" href={localUrl} download>Download</a> : null}{document.openUrl ? <a className="ui-button ui-button--ghost" href={document.openUrl} target="_blank" rel="noreferrer">Open in Drive</a> : null}</div>
  </aside>;
}

function ExplorerRow({entry, selected, searching, onFolder, onFile}:{entry:ExplorerEntry;selected:boolean;searching:boolean;onFolder:(key:string)=>void;onFile:(document:CanonicalDocumentRecord)=>void}) {
  if (entry.kind === "folder") return <button type="button" className="file-explorer__row file-explorer__row--folder" onClick={() => onFolder(entry.key)} aria-label={`Open folder ${entry.folder.name}`}>
    <span className="file-explorer__kind-icon" aria-hidden="true">▸</span><span className="file-explorer__primary"><strong>{entry.folder.name}</strong><small>{searching ? entry.folder.folderPath : providerLabel(entry.folder.provider)}</small></span><span>{entry.itemCount} item{entry.itemCount === 1 ? "" : "s"}</span><span>{formatDate(entry.folder.modifiedAt)}</span><span>{providerLabel(entry.folder.provider)}</span>
  </button>;
  const openUrl = entry.document.downloadUrl ? documentRecordsApi.downloadUrl(entry.document.downloadUrl) : entry.document.openUrl;
  return <button type="button" className={`file-explorer__row file-explorer__row--file${selected ? " is-selected" : ""}`} aria-pressed={selected} onClick={() => onFile(entry.document)} onKeyDown={(event) => { if (event.key === "Enter" && selected && openUrl) { event.preventDefault(); window.open(openUrl, "_blank", "noopener,noreferrer"); } }}>
    <span className="file-explorer__kind-icon" aria-hidden="true">▤</span><span className="file-explorer__primary"><strong>{entry.document.fileName}</strong><small>{searching ? entry.document.folder : entry.document.documentType.replaceAll("_", " ")}</small></span><span>{formatSize(entry.document.sizeBytes)}</span><span>{formatDate(entry.document.modifiedAt)}</span><span>{providerLabel(entry.document.provider)}</span>
  </button>;
}

export default function HierarchicalFileExplorer({result, rootLabel, search, onSearchChange, onRecordsUpdated}:{result:DocumentRecordsResult;rootLabel:string;search:string;onSearchChange:(value:string)=>void;onRecordsUpdated:(result:DocumentRecordsResult)=>void}) {
  const model = useMemo(() => buildFileExplorer(result, rootLabel), [result, rootLabel]);
  const [history, setHistory] = useState(() => createExplorerHistory(model.preferredFolderKey)), [selectedId, setSelectedId] = useState<string|null>(null), [uploads,setUploads]=useState<UploadItem[]>([]), [dragging,setDragging]=useState(false);
  const filePicker=useRef<HTMLInputElement>(null),dragDepth=useRef(0);
  const requestedKey = history.entries[history.index], currentKey = requestedKey && (requestedKey === model.virtualRootKey || model.folders.has(requestedKey)) ? requestedKey : model.preferredFolderKey;
  useEffect(() => { if (requestedKey && requestedKey !== model.virtualRootKey && !model.folders.has(requestedKey)) setHistory(createExplorerHistory(model.preferredFolderKey)); }, [model, requestedKey]);
  useEffect(() => { if (selectedId && !model.files.has(selectedId)) setSelectedId(null); }, [model, selectedId]);
  const navigate = (key:string) => { setHistory((current) => navigateExplorerHistory(current, key)); setSelectedId(null); onSearchChange(""); };
  const back = () => { if (history.index > 0) { setHistory((current) => backExplorerHistory(current)); setSelectedId(null); onSearchChange(""); } };
  const forward = () => { if (history.index < history.entries.length - 1) { setHistory((current) => forwardExplorerHistory(current)); setSelectedId(null); onSearchChange(""); } };
  const parentKey = currentKey === model.virtualRootKey ? null : model.parents.get(currentKey) || model.virtualRootKey;
  const searching = Boolean(search.trim()), entries = searching ? searchFileExplorer(model, search) : explorerDirectory(model, currentKey);
  const breadcrumbs = explorerBreadcrumbs(model, currentKey), selected = selectedId ? model.files.get(selectedId)?.document || null : null, currentFolder=currentKey===model.virtualRootKey?null:model.folders.get(currentKey)?.folder||null, uploadCapability=resolveFolderUploadCapability(currentFolder), canUpload=uploadCapability.enabled;
  const uploadOne=async(item:UploadItem)=>{setUploads(current=>current.map(value=>value.id===item.id?{...value,state:"uploading",error:undefined}:value));try{const uploaded=await documentRecordsApi.upload(item.file,item.folder,result.scope);setUploads(current=>current.map(value=>value.id===item.id?{...value,state:"uploaded",duplicateName:uploaded.duplicateName}:value));onRecordsUpdated(uploaded.records);if(uploaded.document)setSelectedId(uploaded.document.id)}catch(reason){setUploads(current=>current.map(value=>value.id===item.id?{...value,state:"failed",error:reason instanceof Error?reason.message:"Upload failed."}:value))}};
  const queueFiles=(files:File[])=>{if(!canUpload||!currentFolder||!files.length)return;const queued=files.map(file=>({id:`${Date.now()}-${crypto.randomUUID()}`,file,folder:currentFolder,state:"queued" as const}));setUploads(current=>[...queued,...current]);void(async()=>{for(const item of queued)await uploadOne(item)})()};
  const retry=(id:string)=>{const item=uploads.find(value=>value.id===id);if(item?.state==="failed")void uploadOne(item)};
  return <div className={`file-explorer${selected ? " file-explorer--details-open" : ""}${dragging&&canUpload?" is-dragging":""}`} data-upload-capability={uploadCapability.state} onDragEnter={event=>{if(!canUpload)return;event.preventDefault();dragDepth.current+=1;setDragging(true)}} onDragOver={event=>{if(canUpload)event.preventDefault()}} onDragLeave={()=>{dragDepth.current=Math.max(0,dragDepth.current-1);if(!dragDepth.current)setDragging(false)}} onDrop={event=>{if(!canUpload)return;event.preventDefault();dragDepth.current=0;setDragging(false);queueFiles([...(event.dataTransfer.files||[])])}}>
    <div className="file-explorer__toolbar">
      <div className="file-explorer__navigation" aria-label="Folder navigation"><button type="button" className="ui-button ui-button--ghost" onClick={back} disabled={history.index === 0} aria-label="Back">←</button><button type="button" className="ui-button ui-button--ghost" onClick={forward} disabled={history.index >= history.entries.length - 1} aria-label="Forward">→</button><button type="button" className="ui-button ui-button--ghost" onClick={() => parentKey && navigate(parentKey)} disabled={!parentKey} aria-label="Up one folder">↑ Up</button></div>
      <div className="file-explorer__toolbar-end"><label className="file-explorer__search"><span className="sr-only">Search files and folders</span><input className="ui-input" type="search" value={search} onChange={(event) => onSearchChange(event.currentTarget.value)} placeholder="Search files and folders"/>{searching ? <button type="button" className="ui-button ui-button--ghost" onClick={() => onSearchChange("")}>Back to folder</button> : null}</label><input ref={filePicker} className="sr-only" type="file" multiple onChange={event=>{queueFiles([...(event.currentTarget.files||[])]);event.currentTarget.value=""}}/><button type="button" className="ui-button ui-button--primary file-explorer__upload-button" disabled={!canUpload} aria-describedby="file-explorer-upload-status" title={uploadCapability.label} onClick={()=>filePicker.current?.click()}>↑ Upload</button><span id="file-explorer-upload-status" className="sr-only" role="status">{uploadCapability.label}</span></div>
    </div>
    <nav className="file-explorer__breadcrumbs" aria-label="File location">{breadcrumbs.map((crumb, index) => <span key={crumb.key}>{index ? <span aria-hidden="true">›</span> : null}<button type="button" onClick={() => navigate(crumb.key)} aria-current={crumb.key === currentKey ? "location" : undefined}>{crumb.label}</button></span>)}</nav>
    {searching ? <p className="file-explorer__search-summary" role="status">{entries.length} matching item{entries.length === 1 ? "" : "s"} across this Files workspace</p> : null}
    {uploads.length?<section className="file-explorer__uploads" aria-label="File uploads" aria-live="polite">{uploads.map(item=><div key={item.id} data-upload-state={item.state}><span><strong>{item.file.name}</strong><small>{item.state==="queued"?"Queued":item.state==="uploading"?"Uploading…":item.state==="uploaded"?item.duplicateName?"Uploaded as a separate provider file — existing file preserved":"Uploaded":item.error||"Failed"}</small></span>{item.state==="failed"?<button type="button" className="ui-button ui-button--ghost" onClick={()=>retry(item.id)}>Retry</button>:null}</div>)}</section>:null}
    <div className="file-explorer__content">
      <div className="file-explorer__directory" role="list" aria-label={searching ? "Search results" : "Current folder contents"}>
        <div className="file-explorer__columns" aria-hidden="true"><span></span><span>Name</span><span>Size / items</span><span>Modified</span><span>Provider</span></div>
        {entries.map((entry) => <ExplorerRow key={entry.key} entry={entry} selected={entry.kind === "file" && entry.key === selectedId} searching={searching} onFolder={navigate} onFile={(document) => setSelectedId(document.id)}/>) }
        {!entries.length ? <div className="ui-empty-state">{searching ? "No matching files or folders." : "This folder has no cached items."}</div> : null}
      </div>
      {selected ? <FileDetails document={selected}/> : null}
    </div>
    {dragging&&canUpload?<div className="file-explorer__drop-target" aria-hidden="true"><strong>Upload to {currentFolder?.name}</strong><span>Drop files in this provider folder</span></div>:null}
  </div>;
}
