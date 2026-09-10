import { apiFetch } from "../../services/api/apiClient";

export const DOCUMENT_COVER_PHOTO_SETTING_KEY = "customer-document-cover-photograph";
export const DOCUMENT_COVER_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

export type DocumentCoverPhoto = {
  dataUrl: string;
  fileName: string;
  mimeType: "image/jpeg" | "image/png";
  sizeBytes: number;
  updatedAt: string;
};

export function normaliseDocumentCoverPhoto(value: unknown): DocumentCoverPhoto | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<DocumentCoverPhoto>;
  const mimeType = String(source.mimeType || "");
  const dataUrl = String(source.dataUrl || "");
  const sizeBytes = Number(source.sizeBytes);
  if (!ALLOWED_MIME_TYPES.has(mimeType) || !dataUrl.startsWith(`data:${mimeType};base64,`) || !Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > DOCUMENT_COVER_PHOTO_MAX_BYTES) return null;
  return {
    dataUrl,
    fileName: String(source.fileName || "cover-photograph").slice(0, 240),
    mimeType: mimeType as DocumentCoverPhoto["mimeType"],
    sizeBytes,
    updatedAt: String(source.updatedAt || ""),
  };
}

export async function loadDocumentCoverPhoto() {
  const rows = await apiFetch("/api/settings/branding") as Array<{ key?: string; value?: unknown }>;
  return normaliseDocumentCoverPhoto(rows.find((row) => row.key === DOCUMENT_COVER_PHOTO_SETTING_KEY)?.value);
}

export async function saveDocumentCoverPhoto(photo: DocumentCoverPhoto | null) {
  const row = await apiFetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: DOCUMENT_COVER_PHOTO_SETTING_KEY, group_name: "branding", value: photo }),
  }) as { value?: unknown };
  return normaliseDocumentCoverPhoto(row.value);
}

export function fileAsDocumentCoverPhoto(file: File): Promise<DocumentCoverPhoto> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) return Promise.reject(new Error("Choose an original JPEG or PNG photograph."));
  if (file.size <= 0 || file.size > DOCUMENT_COVER_PHOTO_MAX_BYTES) return Promise.reject(new Error("The cover photograph must be no larger than 15 MB."));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The cover photograph could not be read."));
    reader.onload = () => resolve({
      dataUrl: String(reader.result || ""),
      fileName: file.name,
      mimeType: file.type as DocumentCoverPhoto["mimeType"],
      sizeBytes: file.size,
      updatedAt: new Date().toISOString(),
    });
    reader.readAsDataURL(file);
  });
}
