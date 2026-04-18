import type { Address } from "../models/types";

export function emptyAddress(): Address {
  return {
    line1: "",
    line2: "",
    line3: "",
    town: "",
    city: "",
    county: "",
    postcode: "",
  };
}

export function parseAddressString(value: string): Address {
  const parts = (value || "").split(/\r?\n/).map((s) => (s || "").trim());
  while (parts.length < 7) parts.push("");
  return {
    line1: parts[0] || "",
    line2: parts[1] || "",
    line3: parts[2] || "",
    town: parts[3] || "",
    city: parts[4] || "",
    county: parts[5] || "",
    postcode: parts[6] || "",
  };
}

export function buildAddressString(address: Address | undefined) {
  const safe = address ?? emptyAddress();
  return [
    safe.line1,
    safe.line2,
    safe.line3,
    safe.town,
    safe.city,
    safe.county,
    safe.postcode,
  ]
    .map((s) => (s || "").trim())
    .join("\n");
}

export function resolveStructuredAddress(address: Address | undefined, fallbackString: string) {
  return address ? { ...emptyAddress(), ...address } : parseAddressString(fallbackString || "");
}

export function addressTuple(address: Address): [string, string, string, string, string, string, string] {
  return [
    address.line1 || "",
    address.line2 || "",
    address.line3 || "",
    address.town || "",
    address.city || "",
    address.county || "",
    address.postcode || "",
  ];
}
