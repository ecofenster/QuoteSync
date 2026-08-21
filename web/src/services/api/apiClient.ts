export const API_BASE_URL = String(import.meta.env?.VITE_API_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export class ApiRequestError extends Error {
  status: number;
  path: string;
  body: string;
  isConflict: boolean;

  constructor(path: string, status: number, body: string, message?: string) {
    super(message || `API request failed: ${status}`);
    this.name = "ApiRequestError";
    this.status = status;
    this.path = path;
    this.body = body;
    this.isConflict = status === 409;
  }
}

export function extractApiErrorMessage(status: number, body: string) {
  const looksLikeHtml = /^\s*<!doctype html|^\s*<html|<body[\s>]/i.test(body);
  if (looksLikeHtml) {
    if (status === 404) return "Not found";
    if (status === 400) return "Bad request";
    return `API request failed: ${status}`;
  }
  if (body) {
    try {
      const parsed = JSON.parse(body);
      const message =
        typeof parsed?.error === "string"
          ? parsed.error
          : typeof parsed?.message === "string"
            ? parsed.message
            : typeof parsed?.detail === "string"
              ? parsed.detail
              : "";
      if (message) return message;
    } catch {
      // ignore non-JSON response bodies
    }

    const trimmed = body.trim();
    if (trimmed) return trimmed;
  }

  if (status === 409) return "Conflict";
  if (status === 404) return "Not found";
  if (status === 400) return "Bad request";
  return `API request failed: ${status}`;
}

export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(apiUrl(path), options);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const message = extractApiErrorMessage(res.status, body);

    console.error("API error", {
      path,
      status: res.status,
      body,
      message,
    });

    throw new ApiRequestError(path, res.status, body, message);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return null;
}
