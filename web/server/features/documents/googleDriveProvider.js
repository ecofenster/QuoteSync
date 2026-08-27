const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
export const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const LIST_FIELDS = "nextPageToken,incompleteSearch,files(id,name,mimeType,parents,size,createdTime,modifiedTime,version,md5Checksum,trashed,appProperties,webViewLink,driveId,shortcutDetails)";
const q = (value) => String(value || "").replaceAll("\\", "\\\\").replaceAll("'", "\\'");

export function createGoogleDriveProvider(googleWorkspace) {
  async function json(response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body?.error?.message || "Google Drive request failed."), { status: response.status >= 500 ? 502 : response.status, providerBody: body });
    return body;
  }
  async function listChildrenPage({ parentId, pageToken = null, includeTrashed = false }) {
    const url = new URL(`${API}/files`);
    url.searchParams.set("spaces", "drive");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("orderBy", "folder,name_natural");
    url.searchParams.set("fields", LIST_FIELDS);
    url.searchParams.set("q", `'${q(parentId)}' in parents${includeTrashed ? "" : " and trashed=false"}`);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    return json(await googleWorkspace.googleFetch(url));
  }
  async function listChildren(input) {
    const files = [];
    let pageToken = null;
    do {
      const page = await listChildrenPage({ ...input, pageToken });
      files.push(...(page.files ?? []));
      pageToken = page.nextPageToken ?? null;
    } while (pageToken);
    return files;
  }
  async function findFolder({ parentId, estimateId, logicalKey }) {
    const url = new URL(`${API}/files`);
    url.searchParams.set("spaces", "drive");
    url.searchParams.set("fields", "files(id,name,parents,appProperties)");
    url.searchParams.set("q", `'${q(parentId)}' in parents and mimeType='${GOOGLE_DRIVE_FOLDER_MIME_TYPE}' and trashed=false and appProperties has { key='quotesuiteEstimateId' and value='${q(estimateId)}' } and appProperties has { key='quotesuiteLogicalKey' and value='${q(logicalKey)}' }`);
    return (await json(await googleWorkspace.googleFetch(url))).files?.[0] ?? null;
  }
  async function findFolderByName({ parentId, name }) {
    const url = new URL(`${API}/files`);
    url.searchParams.set("spaces", "drive");
    url.searchParams.set("fields", "files(id,name,parents,appProperties)");
    url.searchParams.set("q", `'${q(parentId)}' in parents and mimeType='${GOOGLE_DRIVE_FOLDER_MIME_TYPE}' and trashed=false and name='${q(name)}'`);
    return (await json(await googleWorkspace.googleFetch(url))).files?.find((file) => file.name === name) ?? null;
  }
  async function findProjectFolderByEstimateReference({ parentId, estimateReference }) {
    const url = new URL(`${API}/files`);
    url.searchParams.set("spaces", "drive");
    url.searchParams.set("fields", "files(id,name,parents,appProperties)");
    url.searchParams.set("q", `'${q(parentId)}' in parents and mimeType='${GOOGLE_DRIVE_FOLDER_MIME_TYPE}' and trashed=false and name contains '${q(estimateReference)}'`);
    const files = (await json(await googleWorkspace.googleFetch(url))).files ?? [];
    const reference = String(estimateReference).trim().toLowerCase();
    return files.find((file) => {
      const name = String(file.name || "").trim().toLowerCase();
      return name === reference || new RegExp(`^${reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|[-–—_(])`).test(name);
    }) ?? null;
  }
  async function createFolder({ parentId, name, estimateId, logicalKey, appProperties = {} }) {
    const properties = { ...appProperties };
    if (estimateId) properties.quotesuiteEstimateId = estimateId;
    if (logicalKey) properties.quotesuiteLogicalKey = logicalKey;
    return json(await googleWorkspace.googleFetch(`${API}/files?fields=id,name,parents,appProperties`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId], appProperties: properties }) }));
  }
  async function ensureFolder(input) {
    const canonical = await findFolder(input);
    if (canonical) return canonical;
    if (input.discovery === "exact_name") {
      const existing = await findFolderByName(input);
      if (existing) return existing;
    }
    if (input.discovery === "estimate_reference") {
      const existing = await findProjectFolderByEstimateReference(input);
      if (existing) return existing;
    }
    return createFolder(input);
  }
  async function uploadFile({ parentId, fileName, mediaType, bytes, appProperties }) {
    const boundary = `quotesuite_${Date.now().toString(36)}`, metadata = JSON.stringify({ name: fileName, parents: [parentId], appProperties });
    const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mediaType}\r\n\r\n`), Buffer.from(bytes), Buffer.from(`\r\n--${boundary}--`)]);
    return json(await googleWorkspace.googleFetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id,name,parents,appProperties`, { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body }));
  }
  return { listChildrenPage, listChildren, findFolder, findFolderByName, findProjectFolderByEstimateReference, createFolder, ensureFolder, uploadFile };
}
