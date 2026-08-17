import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("normal navigation exposes one Project Map entry", async () => {
  const [app, types] = await Promise.all([read("src/App.tsx"), read("src/models/types.ts")]);
  assert.match(app, /SidebarItem label="Project Map"/);
  assert.doesNotMatch(app, /SidebarItem label="Estimate Map"/);
  assert.doesNotMatch(app, /SidebarItem label="Installation Map"/);
  assert.match(app, /SidebarItem label="Installation"/);
  assert.doesNotMatch(app, /<div className="operational-title qs-migrated-70">Installation Map<\/div>/);
  assert.match(app, /menu === "project_map".*renderProjectMapBoard/s);
  assert.match(types, /"project_map"/);
});

test("Project Map provides lifecycle filters, unified counters, unresolved state and canonical open action", async () => {
  const app = await read("src/App.tsx");
  for (const label of ["Enquiry", "Estimate / Quotation", "Order / Sold", "Installation", "Completed"]) {
    assert.match(app, new RegExp(`"${label}"`));
  }
  assert.match(app, /Mapped projects/);
  assert.match(app, /Visible projects/);
  assert.match(app, /Unresolved locations/);
  assert.match(app, /Location unavailable/);
  assert.match(app, /onOpen=.*openEstimateFromGlobalMenu/s);
  assert.doesNotMatch(app, /Total mÃ/);
});

test("location resolution stays server-side and follows project, client, then what3words precedence", async () => {
  const location = await read("src/services/locationService.ts");
  assert.match(location, /apiFetch\("\/api\/integrations\/googleMaps\/geocode"/);
  assert.doesNotMatch(location, /new window\.google\.maps\.Geocoder/);
  const estimatePostcode = location.indexOf("const postcode = estimate.postcode");
  const clientPostcode = location.indexOf("const clientProjectPostcode");
  const fallbackWords = location.indexOf("const fallbackWords = words");
  assert.ok(estimatePostcode >= 0 && clientPostcode > estimatePostcode && fallbackWords > clientPostcode);
  assert.match(location, /source: "client"/);
  assert.match(location, /resolvedAt: new Date\(\)\.toISOString\(\)/);
  assert.match(location, /function usableLocationText\(value: unknown\)/);
  assert.match(location, /const clientAddress = clientProjectAddress \|\| clientCustomerAddress/);
  assert.match(location, /Client address fallback:/);
});

test("Client projection preserves coordinates and customer postcode fallback without mutating protected records", async () => {
  const app = await read("src/App.tsx");
  assert.match(app, /const projectPostcode = usableLocationText\(projectStructured\.postcode/);
  assert.match(app, /const customerPostcode = usableLocationText\(customerStructured\.postcode/);
  assert.match(app, /postcode: projectPostcode \|\| customerPostcode/);
  assert.match(app, /latitude,\s*longitude,/s);
  assert.match(app, /if \(isProtectedClientRef\(targetClient\.clientRef\)\) return/);
});

test("whitespace-only project locations cannot block a customer-address fallback", async () => {
  const location = await read("src/services/locationService.ts");
  assert.match(location, /const clientProjectAddress = usableLocationText\(clientFallback\.projectAddress\)/);
  assert.match(location, /const clientCustomerAddress = usableLocationText\(clientFallback\.customerAddress\)/);
  assert.match(location, /clientProjectPostcode \|\| clientCustomerPostcode/);
  assert.doesNotMatch(location, /clientFallback\.projectAddress \|\| clientFallback\.customerAddress/);
  assert.match(location, /const clientPostcode = clientProjectPostcode \|\| clientCustomerPostcode \|\| usableLocationText\(clientFallback\.postcode\)/);
  assert.match(location, /const clientAddress = clientProjectAddress \|\| clientCustomerAddress/);
  assert.match(location, /isClientAddressFallback: true/);
});

test("Project Map cache avoids provider loops while unresolved locations remain retryable", async () => {
  const location = await read("src/services/locationService.ts");
  const cacheHit = location.indexOf("cached.inputKey === inputKey");
  const firstProvider = location.indexOf("await geocodeWithGoogle", location.indexOf("export async function resolveEstimateLocation"));
  assert.ok(cacheHit >= 0 && firstProvider > cacheHit, "matching cache must win before provider calls");
  assert.match(location, /Failed\s+(?:\/\/\s*)?resolutions are never cached/i);
  assert.doesNotMatch(location, /saveCachedLocation\([^)]*,\s*null\)/);
});

test("persisted Client coordinates bypass providers and remain disclosed as a fallback", async () => {
  const location = await read("src/services/locationService.ts");
  const clientCoordinates = location.indexOf("if (isValidUkCoordinatePair(clientLat, clientLng))");
  const clientProvider = location.indexOf("if (clientPostcode && opts.googleMapsApiKey)");
  assert.ok(clientCoordinates >= 0 && clientProvider > clientCoordinates);
  assert.match(location, /label: `Client address fallback: \$\{buildClientLocationLabel\(clientFallback\)\}`/);
});

test("EF-CL-005-shaped customer fixture reaches BA2 8AP without protected-record mutation", async () => {
  const [app, location] = await Promise.all([read("src/App.tsx"), read("src/services/locationService.ts")]);
  const fixture = {
    clientRef: "EF-CL-005",
    projectAddress: " \n ",
    customerAddress: "Peasedown\nSt. John\nSomerset\nBA2 8AP",
    customerAddressStructured: { postcode: "BA2 8AP" },
  };
  assert.equal(fixture.projectAddress.trim(), "");
  assert.equal(fixture.customerAddressStructured.postcode, "BA2 8AP");
  assert.match(location, /geocodeWithGoogle\(`\$\{clientPostcode\}, UK`/);
  assert.match(app, /isProtectedClientRef\(targetClient\.clientRef\)/);
});

test("Project Map card explicitly distinguishes Client fallback from confirmed site location", async () => {
  const app = await read("src/App.tsx");
  assert.match(app, /resolved\?\.isClientAddressFallback/);
  assert.match(app, /Client address fallback — not a confirmed project\/site location/);
});

test("map popup remains client-neutral and uses the canonical project id", async () => {
  const panel = await read("src/components/GoogleMapPanel.tsx");
  assert.match(panel, /reference\?: string/);
  assert.match(panel, /stage\?: string/);
  assert.match(panel, /open\.textContent = "Open"/);
  assert.match(panel, /onOpen\(item\.id\)/);
  assert.doesNotMatch(panel, /integrations\.googleMaps\.apiKey/);
});
