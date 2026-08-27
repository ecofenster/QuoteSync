import type { CanonicalDocumentRecord, CanonicalFolderRecord, DocumentRecordsResult, FolderUploadCapabilityState } from "../../services/documents/documentRecordsApi";

export function resolveFolderUploadCapability(folder:CanonicalFolderRecord|null):{state:FolderUploadCapabilityState;enabled:boolean;label:string} {
  if(!folder)return {state:"absent",enabled:false,label:"Choose a provider folder to upload"};
  const state=folder.capabilities?.uploadState||(folder.capabilities?.upload===true?"writable":"loading");
  if(state==="writable"&&folder.capabilities?.upload===true)return {state,enabled:true,label:`Upload to ${folder.name}`};
  if(state==="loading")return {state,enabled:false,label:"Upload capability is loading"};
  if(state==="disconnected")return {state,enabled:false,label:"Provider disconnected — cached files remain available"};
  if(state==="read_only")return {state,enabled:false,label:"This provider folder is read-only"};
  return {state:"absent",enabled:false,label:"Upload is unavailable for this provider folder"};
}

export type ExplorerFolderEntry = { kind:"folder";key:string;folder:CanonicalFolderRecord;parentKey:string;itemCount:number };
export type ExplorerFileEntry = { kind:"file";key:string;document:CanonicalDocumentRecord;parentKey:string };
export type ExplorerEntry = ExplorerFolderEntry | ExplorerFileEntry;
export type ExplorerBreadcrumb = { key:string;label:string };
export type ExplorerHistory = { entries:string[];index:number };
export type FileExplorerModel = {
  virtualRootKey:string;
  rootLabel:string;
  preferredFolderKey:string;
  folders:Map<string,ExplorerFolderEntry>;
  files:Map<string,ExplorerFileEntry>;
  children:Map<string,ExplorerEntry[]>;
  parents:Map<string,string>;
};

const collator = new Intl.Collator("en-GB", { numeric:true, sensitivity:"base" });
const scopeKind = (scope:DocumentRecordsResult["scope"]) => Object.keys(scope)[0]?.replace(/Id$/, "") || "files";
const scopeId = (scope:DocumentRecordsResult["scope"]) => String(Object.values(scope)[0] || "root");

export const providerItemKey = (provider:string, accountId:string|null, providerId:string) => `${provider}:${accountId || "default"}:${providerId}`;

function preferredFolder(result:DocumentRecordsResult, roots:string[], folders:Map<string,ExplorerFolderEntry>, virtualRootKey:string) {
  const entries = [...folders.values()], scope = result.scope;
  const byLogical = (logicalKey:string, entityKind?:CanonicalFolderRecord["entityKind"], entityId?:string) => entries.find(({folder}) => folder.logicalKey === logicalKey && (!entityKind || folder.entityKind === entityKind) && (!entityId || folder.entityId === entityId))?.key;
  if (scope.estimateId) return byLogical("estimate", "estimate", scope.estimateId) || byLogical("estimates", "project") || byLogical("project", "project") || (roots.length === 1 ? roots[0] : virtualRootKey);
  if (scope.projectId) return byLogical("project", "project", scope.projectId) || (roots.length === 1 ? roots[0] : virtualRootKey);
  if (scope.enquiryId) return byLogical("enquiry_root", "enquiry", scope.enquiryId) || (roots.length === 1 ? roots[0] : virtualRootKey);
  return roots.length === 1 ? roots[0] : virtualRootKey;
}

export function buildFileExplorer(result:DocumentRecordsResult, rootLabel:string):FileExplorerModel {
  const virtualRootKey = `scope:${scopeKind(result.scope)}:${scopeId(result.scope)}`;
  const activeFolders = result.folders.filter((folder) => !folder.removedAt);
  const byProviderId = new Map(activeFolders.map((folder) => [providerItemKey(folder.provider, folder.providerAccountId, folder.providerFolderId), folder]));
  const folderKeys = new Map(activeFolders.map((folder) => [folder.id, providerItemKey(folder.provider, folder.providerAccountId, folder.providerFolderId)]));
  const folders = new Map<string,ExplorerFolderEntry>(), files = new Map<string,ExplorerFileEntry>(), parents = new Map<string,string>(), children = new Map<string,ExplorerEntry[]>();
  children.set(virtualRootKey, []);
  const parentFor = (folder:CanonicalFolderRecord) => {
    if (folder.providerParentFolderId) {
      const direct = byProviderId.get(providerItemKey(folder.provider, folder.providerAccountId, folder.providerParentFolderId));
      if (direct) return folderKeys.get(direct.id) || virtualRootKey;
    }
    if (folder.parentLogicalKey) {
      const fallback = activeFolders.find((candidate) => candidate.provider === folder.provider && candidate.providerAccountId === folder.providerAccountId && candidate.logicalKey === folder.parentLogicalKey && (candidate.entityId === folder.entityId || folder.entityKind === "estimate"));
      if (fallback) return folderKeys.get(fallback.id) || virtualRootKey;
    }
    return virtualRootKey;
  };
  for (const folder of activeFolders) {
    const key = folderKeys.get(folder.id) as string, parentKey = parentFor(folder);
    folders.set(key, { kind:"folder", key, folder, parentKey, itemCount:0 });
    parents.set(key, parentKey);
  }
  for (const entry of folders.values()) {
    const siblings = children.get(entry.parentKey) || [];
    siblings.push(entry);
    children.set(entry.parentKey, siblings);
    if (!children.has(entry.key)) children.set(entry.key, []);
  }
  for (const document of result.documents.filter((item) => !item.removedAt && item.status !== "trashed")) {
    const parentKey = document.providerFolderId ? providerItemKey(document.provider, document.providerAccountId, document.providerFolderId) : virtualRootKey;
    const resolvedParent = folders.has(parentKey) ? parentKey : virtualRootKey;
    const entry:ExplorerFileEntry = { kind:"file", key:document.id, document, parentKey:resolvedParent };
    files.set(entry.key, entry);
    const siblings = children.get(resolvedParent) || [];
    siblings.push(entry);
    children.set(resolvedParent, siblings);
  }
  for (const [key, entries] of children) {
    entries.sort((left, right) => left.kind !== right.kind ? left.kind === "folder" ? -1 : 1 : collator.compare(left.kind === "folder" ? left.folder.name : left.document.fileName, right.kind === "folder" ? right.folder.name : right.document.fileName));
    const folder = folders.get(key);
    if (folder) folder.itemCount = entries.length;
  }
  const roots = (children.get(virtualRootKey) || []).filter((entry):entry is ExplorerFolderEntry => entry.kind === "folder").map((entry) => entry.key);
  return { virtualRootKey, rootLabel, preferredFolderKey:preferredFolder(result, roots, folders, virtualRootKey), folders, files, children, parents };
}

export function explorerDirectory(model:FileExplorerModel, folderKey:string) {
  return model.children.get(folderKey) || [];
}

export function explorerBreadcrumbs(model:FileExplorerModel, folderKey:string):ExplorerBreadcrumb[] {
  const breadcrumbs:ExplorerBreadcrumb[] = [], seen = new Set<string>();
  let current:string|undefined = folderKey;
  while (current && !seen.has(current)) {
    seen.add(current);
    breadcrumbs.unshift({ key:current, label:current === model.virtualRootKey ? model.rootLabel : model.folders.get(current)?.folder.name || model.rootLabel });
    current = current === model.virtualRootKey ? undefined : model.parents.get(current);
  }
  if (breadcrumbs[0]?.key !== model.virtualRootKey) breadcrumbs.unshift({ key:model.virtualRootKey, label:model.rootLabel });
  return breadcrumbs;
}

export function searchFileExplorer(model:FileExplorerModel, term:string):ExplorerEntry[] {
  const query = term.trim().toLocaleLowerCase("en-GB");
  if (!query) return [];
  return [...model.folders.values(), ...model.files.values()].filter((entry) => {
    const values = entry.kind === "folder" ? [entry.folder.name, entry.folder.folderPath, entry.folder.provider] : [entry.document.fileName, entry.document.folder, entry.document.documentType, entry.document.supplierName, entry.document.projectName, entry.document.estimateRef, entry.document.provider];
    return values.some((value) => String(value || "").toLocaleLowerCase("en-GB").includes(query));
  }).sort((left, right) => left.kind !== right.kind ? left.kind === "folder" ? -1 : 1 : collator.compare(left.kind === "folder" ? left.folder.name : left.document.fileName, right.kind === "folder" ? right.folder.name : right.document.fileName));
}

export const createExplorerHistory = (initialKey:string):ExplorerHistory => ({ entries:[initialKey], index:0 });
export const navigateExplorerHistory = (history:ExplorerHistory, key:string):ExplorerHistory => ({ entries:[...history.entries.slice(0, history.index + 1), key], index:history.index + 1 });
export const backExplorerHistory = (history:ExplorerHistory):ExplorerHistory => ({ ...history, index:Math.max(0, history.index - 1) });
export const forwardExplorerHistory = (history:ExplorerHistory):ExplorerHistory => ({ ...history, index:Math.min(history.entries.length - 1, history.index + 1) });
