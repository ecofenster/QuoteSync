export function normalisePostcode(postcode: string): string {
  const raw = String(postcode || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) return "";
  if (raw.length <= 3) return raw;
  return raw.slice(0, raw.length - 3) + " " + raw.slice(raw.length - 3);
}
