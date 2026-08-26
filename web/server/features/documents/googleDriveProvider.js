const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const q = (value) => String(value || "").replaceAll("\\", "\\\\").replaceAll("'", "\\'");

export function createGoogleDriveProvider(googleWorkspace) {
  async function json(response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body?.error?.message || "Google Drive request failed."), { status: response.status >= 500 ? 502 : response.status, providerBody: body });
    return body;
  }
  async function findFolder({ parentId, estimateId, logicalKey }) {
    const url = new URL(`${API}/files`);
    url.searchParams.set("spaces", "drive");
    url.searchParams.set("fields", "files(id,name,parents,appProperties)");
    url.searchParams.set("q", `'${q(parentId)}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and appProperties has { key='quotesuiteEstimateId' and value='${q(estimateId)}' } and appProperties has { key='quotesuiteLogicalKey' and value='${q(logicalKey)}' }`);
    return (await json(await googleWorkspace.googleFetch(url))).files?.[0] ?? null;
  }
  async function createFolder({ parentId, name, estimateId, logicalKey }) {
    return json(await googleWorkspace.googleFetch(`${API}/files?fields=id,name,parents,appProperties`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId], appProperties: { quotesuiteEstimateId: estimateId, quotesuiteLogicalKey: logicalKey } }) }));
  }
  async function ensureFolder(input) { return (await findFolder(input)) ?? createFolder(input); }
  async function uploadFile({ parentId, fileName, mediaType, bytes, appProperties }) {
    const boundary = `quotesuite_${Date.now().toString(36)}`, metadata = JSON.stringify({ name: fileName, parents: [parentId], appProperties });
    const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mediaType}\r\n\r\n`), Buffer.from(bytes), Buffer.from(`\r\n--${boundary}--`)]);
    return json(await googleWorkspace.googleFetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id,name,parents,appProperties`, { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body }));
  }
  return { findFolder, createFolder, ensureFolder, uploadFile };
}
