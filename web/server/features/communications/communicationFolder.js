export const CANONICAL_COMMUNICATION_FOLDERS = Object.freeze(["inbox", "sent", "drafts", "trash", "spam", "other"]);
export const COMMUNICATION_FOLDER_CHECK_SQL = CANONICAL_COMMUNICATION_FOLDERS.map((value) => `'${value}'`).join(",");

const canonicalFolders = new Set(CANONICAL_COMMUNICATION_FOLDERS);

export function normalizeCommunicationFolder(value, { strict = false } = {}) {
  const candidate = String(value ?? "other").trim().toLowerCase();
  const normalized = candidate === "bin" ? "trash" : candidate;
  if (canonicalFolders.has(normalized)) return normalized;
  if (!strict) return "other";
  throw Object.assign(new Error("Unsupported canonical communication folder."), { status: 400, code: "invalid_communication_folder" });
}
