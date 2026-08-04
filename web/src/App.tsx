import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, ApiRequestError } from "./services/api/apiClient";

//
// ===== ESTIMATE API HELPERS =====
//
async function loadClientsAPI(options?: { includeDeleted?: boolean; onlyDeleted?: boolean }) {
  const params = new URLSearchParams();
  if (options?.includeDeleted) params.set("include_deleted", "1");
  if (options?.onlyDeleted) params.set("only_deleted", "1");
  const query = params.toString();
  return apiFetch(`/api/clients${query ? `?${query}` : ""}`);
}

async function loadEstimates(clientId: string, options?: { includeDeleted?: boolean; onlyDeleted?: boolean }) {
  const params = new URLSearchParams({ client_id: clientId });
  if (options?.includeDeleted) params.set("include_deleted", "1");
  if (options?.onlyDeleted) params.set("only_deleted", "1");
  return apiFetch(`/api/estimates?${params.toString()}`);
}

async function createEstimateAPI(payload: any) {
  return apiFetch(`/api/estimates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function updateEstimateAPI(id: string, payload: any) {
  return apiFetch(`/api/estimates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function deleteClientAPI(id: string) {
  return apiFetch(`/api/clients/${id}`, {
    method: "DELETE",
  });
}

async function restoreClientAPI(id: string) {
  return apiFetch(`/api/clients/${id}/restore`, {
    method: "POST",
  });
}

async function purgeClientAPI(id: string) {
  return apiFetch(`/api/clients/${id}/purge`, {
    method: "DELETE",
  });
}

async function deleteEstimateAPI(id: string) {
  return apiFetch(`/api/estimates/${id}`, {
    method: "DELETE",
  });
}

async function restoreEstimateAPI(id: string) {
  return apiFetch(`/api/estimates/${id}/restore`, {
    method: "POST",
  });
}

async function purgeEstimateAPI(id: string) {
  return apiFetch(`/api/estimates/${id}/purge`, {
    method: "DELETE",
  });
}
import EstimatePickerFeature, { type EstimatePickerFeatureHandle } from "./features/estimatePicker/EstimatePickerFeature";
import { DEFAULT_CUSTOMER_ADDRESS, makeDefaultClients } from "./features/clients/defaultClients";
import "./features/clients/ClientsView.css";
import "./App.css";
import * as Models from "./models/types";
import type { Address, Client, Estimate, Position, EstimateDefaults, ClientType } from "./models/types";
import { emptyAddress, parseAddressString, buildAddressString, resolveStructuredAddress, addressTuple } from "./domain/address";
import {
  PRODUCT_TYPES,
  SUPPLIERS,
  WOOD_TYPES,
  FINISHES_BY_TYPE,
  getSupplier,
  allProductsForSupplier,
  firstProductForSupplier,
  isTimberProductType,
} from "./features/catalog/defaultCatalog";
import {
  HINGE_TYPES,
  UG_DOUBLE,
  UG_TRIPLE,
  HANDLE_TYPES,
  SUN_PROTECTION,
  CILL_DEPTHS,
  FRAME_EXTS,
  makeDefaultEstimateDefaults,
  makeBlankEstimateDefaults,
} from "./features/estimateDefaults/defaultEstimateDefaults";
import FollowUpsFeature from "./features/followUps/FollowUpsFeature";
import MainDashboard from "./dashboard/main/MainDashboard";
import Toggle from "./components/Toggle";
import { ControlToolbar, ControlToolbarGroup } from "./components/ControlToolbar";
import GoogleMapPanel, { type GoogleMapMarkerItem } from "./components/GoogleMapPanel";
import AppShell from "./layout/AppShell";
import AdminPlaceholderPage from "./features/admin/AdminPlaceholderPage";
import ClientPortalPlaceholderPage from "./features/clientPortal/ClientPortalPlaceholderPage";
import { buildClientLocationLabel, convertCoordinatesToWhat3Words, resolveClientLocation, resolveEstimateLocation, type ResolvedClientLocation } from "./services/locationService";
import { rankInstallersByDistance } from "./services/distance";
import { getInstallers } from "./data/installers";
import { addFollowUpForEstimate as addFollowUpForEstimateService } from "./services/followups/followupService";
import { buildSendEmailText as buildSendEmailTextService, openMailClient as openMailClientService } from "./services/email/emailService";
import { printEstimatePdf as printEstimatePdfService, downloadEstimateWordDoc as downloadEstimateWordDocService } from "./services/documents/estimateDocumentService";
import { getConfiguredPositionContract } from "./features/configurator/configuredPositionContract.utils";
import { positionDescriptionForDisplay } from "./domain/positions/positionPresentation";
import { loadSettings, saveSettings } from "./system/settings";
import { CURRENT_APP_USER } from "./system/currentUser";
import { getPreference, setPreference } from "./utils/userPreferences";
import type { DeletedClientRecord, DeletedEstimateRecord } from "./features/recycle/recycleTypes";
import BSENStandardsTool from "./features/tools/bsen/BSENStandardsTool";
import GlassWeightCalculatorTool from "./features/tools/glass/GlassWeightCalculatorTool";
import EstimateCollectionView from "./features/estimateCollection/EstimateCollectionView";
import type { EstimateCollectionViewMode } from "./features/estimateCollection/EstimateCollectionView";
import mapGlobalEstimateToCollectionItem from "./features/estimateCollection/adapters/mapGlobalEstimateToCollectionItem";

/* =========================
   Helpers
========================= */

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function pad3(n: number) {
  const s = String(n);
  return s.length >= 3 ? s : "0".repeat(3 - s.length) + s;
}

function keyForCell(col: number, row: number) {
  return `${col},${row}`;
}

function normalizeCellInsertions(fieldsX: number, fieldsY: number, existing: Record<string, string> | undefined, fallback: string) {
  const out: Record<string, string> = {};
  for (let r = 0; r < fieldsY; r++) {
    for (let c = 0; c < fieldsX; c++) {
      const k = keyForCell(c, r);
      out[k] = existing?.[k] ?? fallback;
    }
  }
  return out;
}

function clampNum(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function nextClientRef(n: number) {
  return `EF-CL-${pad3(n)}`;
}

const DEFAULT_ESTIMATE_REF_PREFIX = "EF-EST";

/**
 * Estimate reference prefix.
 * Default aligns to EF-EST-YYYY-###.
 * Future: expose as an Admin setting.
 */
function getEstimateRefPrefix() {
  return DEFAULT_ESTIMATE_REF_PREFIX;
}

function nextEstimateBaseRef(year: number, n: number) {
  return `${getEstimateRefPrefix()}-${year}-${pad3(n)}`;
}

function estimateRefWithRevision(base: string, revisionNo: number) {
  if (revisionNo <= 0) return base;
  return `${base}-${String(revisionNo).padStart(2, "0")}`;
}

const ORDER_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const GLOBAL_ESTIMATE_PREF_KEYS = {
  viewMode: {
    estimates: "quotesync:viewMode:estimates",
    orders: "quotesync:viewMode:orders",
    lost: "quotesync:viewMode:lost",
  },
  sortDirection: {
    estimates: "quotesync:sortDirection:estimates",
    orders: "quotesync:sortDirection:orders",
    lost: "quotesync:sortDirection:lost",
  },
  creatorFilter: {
    estimates: "quotesync:filter:estimates",
    orders: "quotesync:filter:orders",
    lost: "quotesync:filter:lost",
  },
} as const;

const CLIENT_DB_PREF_KEYS = {
  viewMode: "quotesync:viewMode:clients",
  sortDirection: "quotesync:sortDirection:clients",
  filter: "quotesync:filter:clients",
  sortField: "quotesync:sortField:clients",
} as const;

const PROTECTED_CLIENT_REFS = new Set([
  "EF-CL-001",
  "EF-CL-002",
  "EF-CL-003",
  "EF-CL-004",
  "EF-CL-005",
  "EF-CL-006",
  "EF-CL-007",
  "EF-CL-008",
]);

function isEstimateCollectionViewMode(value: unknown): value is EstimateCollectionViewMode {
  return value === "list" || value === "grid";
}

function isProtectedClientRef(value: unknown) {
  return PROTECTED_CLIENT_REFS.has(String(value || "").trim().toUpperCase());
}

function isCreatorFilter(value: unknown): value is "mine" | "all" {
  return value === "mine" || value === "all";
}

function isSortDirection(value: unknown): value is "asc" | "desc" {
  return value === "asc" || value === "desc";
}

function isClientDbFilter(value: unknown): value is "All" | "Open" | "Orders" | "Lost" {
  return value === "All" || value === "Open" || value === "Orders" || value === "Lost";
}

function isClientDbSortField(value: unknown): value is "client_name" | "client_number" | "project_name" {
  return value === "client_name" || value === "client_number" || value === "project_name";
}

function estimatePotentialValue(est: Estimate) {
  return (est.positions ?? []).reduce((sum, pos) => {
    const qty = Number.isFinite(pos.qty) ? Number(pos.qty) : 0;
    const itemPrice = typeof pos.itemPrice === "number" && Number.isFinite(pos.itemPrice) ? pos.itemPrice : 0;
    return sum + qty * itemPrice;
  }, 0);
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function monthYearLabel(month: string, year: number) {
  return month && year ? `${month} ${year}` : "Not set";
}

function next12ForecastBuckets(fromDate = new Date()) {
  const out: { key: string; month: string; year: number }[] = [];
  const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const month = ORDER_MONTHS[d.getMonth()];
    const year = d.getFullYear();
    out.push({ key: `${month}-${year}`, month, year });
  }
  return out;
}

function extractPostcodeFromAddress(projectAddress: string) {
  const match = (projectAddress || "").match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
  return match ? match[0].toUpperCase().replace(/\s+/, " ") : "";
}

function maxClientRefNumber(rows: Array<{ client_ref?: string | null }>) {
  return rows.reduce((max, row) => {
    const value = String(row?.client_ref || "");
    const digits = value.match(/\d+/g);
    const n = digits ? Number(digits.join("")) : 0;
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
}

function estimateRefNumber(value: string) {
  const match = String(value || "").trim().match(/-(\d+)$/);
  const n = match ? Number(match[1]) : 0;
  return Number.isFinite(n) ? n : 0;
}

function maxEstimateRefNumberFromClients(clients: Client[]) {
  return clients.reduce((max, client) => {
    return (client.estimates ?? []).reduce((clientMax, estimate) => {
      const n = estimateRefNumber(estimate?.estimateRef || "");
      return n > clientMax ? n : clientMax;
    }, max);
  }, 0);
}

function maxEstimateRefNumberForState(
  clients: Client[],
  deletedEstimatesByClientId: Record<string, DeletedEstimateRecord[]>,
  deletedClientsById: Record<string, DeletedClientRecord>
) {
  let max = maxEstimateRefNumberFromClients(clients);

  Object.values(deletedEstimatesByClientId).forEach((records) => {
    (records ?? []).forEach((record) => {
      const n = estimateRefNumber(record?.estimate?.estimateRef || "");
      if (n > max) max = n;
    });
  });

  Object.values(deletedClientsById).forEach((record) => {
    (record?.client?.estimates ?? []).forEach((estimate) => {
      const n = estimateRefNumber(estimate?.estimateRef || "");
      if (n > max) max = n;
    });

    (record?.deletedEstimates ?? []).forEach((deletedRecord) => {
      const n = estimateRefNumber(deletedRecord?.estimate?.estimateRef || "");
      if (n > max) max = n;
    });
  });

  return max;
}

function mapDbClientToClient(row: any): Client {
  const type: ClientType = row?.client_type === "Business" ? "Business" : "Individual";

  const customerStructured = resolveStructuredAddress(row?.customer_address_json, String(row?.customer_address || ""));
  const projectStructured = resolveStructuredAddress(row?.project_address_json, String(row?.project_address || ""));
  const invoiceStructured = resolveStructuredAddress(
    row?.invoice_address_json,
    String(row?.invoice_address || row?.project_address || "")
  );

  const customerAddress = buildAddressString(customerStructured);
  const projectAddress = buildAddressString(projectStructured);
  const invoiceAddress = buildAddressString(invoiceStructured);

  return {
    id: Models.asClientId(String(row?.id || uid())),
    type,
    clientRef: String(row?.client_ref || ""),
    clientName: String(row?.name || row?.company_name || "Client"),
    email: String(row?.email || ""),
    mobile: String(row?.mobile || row?.phone || ""),
    home: String(row?.home || ""),
    projectName: String(row?.project_name || ""),
    customerAddress,
    projectAddress,
    invoiceAddress,
    customerAddressStructured: customerStructured,
    projectAddressStructured: projectStructured,
    invoiceAddressStructured: invoiceStructured,
    postcode: extractPostcodeFromAddress(projectAddress),
    what3words: String(row?.what3words || ""),
    businessName: type === "Business" ? String(row?.company_name || "") : undefined,
    contactPerson: type === "Business" ? String(row?.contact_name || "") : undefined,
    estimates: [],
  };
}

function buildDbClientPayload(client: Client) {
  const customerStructured = resolveStructuredAddress(
    (client as any).customerAddressStructured,
    String((client as any).customerAddress || "")
  );
  const projectStructured = resolveStructuredAddress(client.projectAddressStructured, String(client.projectAddress || ""));
  const invoiceStructured = resolveStructuredAddress(client.invoiceAddressStructured, String(client.invoiceAddress || ""));

  const customerAddress = buildAddressString(customerStructured);
  const projectAddress = buildAddressString(projectStructured);
  const invoiceAddress = buildAddressString(invoiceStructured);

  return {
    id: client.id,
    name: client.clientName || "",
    email: client.email || "",
    phone: client.mobile || "",
    mobile: client.mobile || "",
    home: client.home || "",
    project_name: client.projectName || "",
    created_at: new Date().toISOString(),
    client_ref: client.clientRef || "",
    client_type: client.type || "Individual",
    contact_name: client.contactPerson || "",
    company_name: client.businessName || "",
    customer_address: customerAddress,
    project_address: projectAddress,
    invoice_address: invoiceAddress,
    invoice_same_as_customer: invoiceAddress.trim() === customerAddress.trim(),
    invoice_same_as_project: invoiceAddress.trim() === projectAddress.trim(),
    customer_address_json: customerStructured,
    project_address_json: projectStructured,
    invoice_address_json: invoiceStructured,
    what3words: client.what3words || "",
  };
}

function mergeEstimateLocationState(estimate: Estimate): Estimate {
  const location = estimate.location;
  const projectStructured = resolveStructuredAddress(
    estimate.projectAddressStructured ?? location?.projectAddressStructured,
    String(estimate.projectAddress ?? location?.projectAddress ?? "")
  );
  const projectAddress = buildAddressString(projectStructured);
  const postcode = String(estimate.postcode ?? location?.postcode ?? extractPostcodeFromAddress(projectAddress) ?? "");
  const what3words = String(estimate.what3words ?? location?.what3words ?? "");
  const latitudeValue = estimate.latitude ?? location?.latitude ?? null;
  const longitudeValue = estimate.longitude ?? location?.longitude ?? null;
  const latitude = latitudeValue == null || !Number.isFinite(Number(latitudeValue)) ? null : Number(latitudeValue);
  const longitude = longitudeValue == null || !Number.isFinite(Number(longitudeValue)) ? null : Number(longitudeValue);

  return {
    ...estimate,
    projectAddress,
    projectAddressStructured: projectStructured,
    postcode,
    what3words,
    latitude,
    longitude,
    location: {
      projectAddress,
      projectAddressStructured: projectStructured,
      postcode,
      what3words,
      latitude,
      longitude,
    },
  };
}

function buildDbEstimatePayload(clientId: string, estimate: Estimate) {
  const normalizedEstimate = mergeEstimateLocationState(estimate);

  return {
    id: normalizedEstimate.id,
    client_id: clientId,
    estimate_ref: normalizedEstimate.estimateRef || "",
    base_estimate_ref: normalizedEstimate.baseEstimateRef || normalizedEstimate.estimateRef || "",
    revision_no: Number.isFinite(Number(normalizedEstimate.revisionNo)) ? Number(normalizedEstimate.revisionNo) : 0,
    status: normalizedEstimate.status || "Draft",
    estimated_order_month: normalizedEstimate.estimatedOrderMonth || "",
    estimated_order_year: Number.isFinite(Number(normalizedEstimate.estimatedOrderYear)) ? Number(normalizedEstimate.estimatedOrderYear) : null,
    defaults_json: normalizedEstimate.defaults ?? {},
    positions_json: normalizedEstimate.positions ?? [],
    order_meta_json: normalizedEstimate.orderMeta ?? {},
    outcome: (normalizedEstimate as any).outcome ?? "Open",
    project_address: normalizedEstimate.projectAddress || "",
    project_address_json: normalizedEstimate.projectAddressStructured ?? emptyAddress(),
    postcode: normalizedEstimate.postcode || "",
    what3words: normalizedEstimate.what3words || "",
    latitude: normalizedEstimate.latitude ?? null,
    longitude: normalizedEstimate.longitude ?? null,
    createdByUserId: normalizedEstimate.createdByUserId || CURRENT_APP_USER.id,
    createdByName: normalizedEstimate.createdByName || CURRENT_APP_USER.name,
    createdByRole: normalizedEstimate.createdByRole || CURRENT_APP_USER.role,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
function mapDbEstimateToEstimate(row: any): Estimate {
  const projectStructured = resolveStructuredAddress(row?.project_address_json, String(row?.project_address || ""));
  const projectAddress = buildAddressString(projectStructured);
  const postcode = String(row?.postcode || extractPostcodeFromAddress(projectAddress) || "");
  const what3words = String(row?.what3words || "");
  const latitude = row?.latitude == null || row?.latitude === "" || !Number.isFinite(Number(row?.latitude)) ? null : Number(row.latitude);
  const longitude = row?.longitude == null || row?.longitude === "" || !Number.isFinite(Number(row?.longitude)) ? null : Number(row.longitude);

  return {
    id: Models.asEstimateId(String(row?.id || uid())),
    estimateRef: String(row?.estimate_ref || ""),
    baseEstimateRef: String(row?.base_estimate_ref || row?.estimate_ref || ""),
    revisionNo: Number.isFinite(Number(row?.revision_no)) ? Number(row.revision_no) : 0,
    status: String(row?.status || "Draft"),
    estimatedOrderMonth: String(row?.estimated_order_month || ORDER_MONTHS[new Date().getMonth()]),
    estimatedOrderYear: Number.isFinite(Number(row?.estimated_order_year)) ? Number(row.estimated_order_year) : new Date().getFullYear(),
    defaults: (row?.defaults_json && typeof row.defaults_json === "object" ? row.defaults_json : makeBlankEstimateDefaults()) as EstimateDefaults,
    positions: Array.isArray(row?.positions_json) ? row.positions_json : [],
    orderMeta: row?.order_meta_json && typeof row.order_meta_json === "object" ? row.order_meta_json : undefined,
    projectAddress,
    projectAddressStructured: projectStructured,
    postcode,
    what3words,
    latitude,
    longitude,
    createdByUserId: String(row?.created_by_user_id || CURRENT_APP_USER.id),
    createdByName: String(row?.created_by_name || CURRENT_APP_USER.name),
    createdByRole: (String(row?.created_by_role || CURRENT_APP_USER.role).trim().toLowerCase() || CURRENT_APP_USER.role) as Models.UserRole,
    location: {
      projectAddress,
      projectAddressStructured: projectStructured,
      postcode,
      what3words,
      latitude,
      longitude,
    },
    outcome: String(row?.outcome || "Open"),
  } as Estimate;
}

async function loadClientEstimatesFromApi(clientId: string) {
  const data = await loadEstimates(clientId);
  return Array.isArray(data) ? data.map((row) => mapDbEstimateToEstimate(row)) : [];
}
const DEMO_FOLLOW_UP_COUNT = 10;
const DEMO_ORDER_COUNT = 15;
const DEMO_LOST_COUNT = 10;
const DEMO_INSTALLATION_COUNT = 17;

function normalizeLoadedEstimate(raw: any): Estimate {
  const estimate = mergeEstimateLocationState(raw as Estimate);
  return {
    ...estimate,
    defaults:
      estimate.defaults && typeof estimate.defaults === "object"
        ? (estimate.defaults as EstimateDefaults)
        : makeBlankEstimateDefaults(),
    positions: Array.isArray(estimate.positions) ? estimate.positions : [],
    orderMeta: estimate.orderMeta && typeof estimate.orderMeta === "object" ? estimate.orderMeta : undefined,
    outcome: String((raw as any)?.outcome || estimate.outcome || "Open") as Models.EstimateOutcome,
  };
}

function normalizeLoadedClient(raw: any): Client {
  const customerStructured = resolveStructuredAddress(
    raw?.customerAddressStructured,
    String(raw?.customerAddress || "")
  );
  const projectStructured = resolveStructuredAddress(
    raw?.projectAddressStructured,
    String(raw?.projectAddress || "")
  );
  const invoiceStructured = resolveStructuredAddress(
    raw?.invoiceAddressStructured,
    String(raw?.invoiceAddress || "")
  );

  const customerAddress = buildAddressString(customerStructured);
  const projectAddress = buildAddressString(projectStructured);
  const invoiceAddress = buildAddressString(invoiceStructured);

  return {
    ...(raw as Client),
    id: Models.asClientId(String(raw?.id || uid())),
    type: raw?.type === "Business" ? "Business" : "Individual",
    clientRef: String(raw?.clientRef || ""),
    clientName: String(raw?.clientName || "Client"),
    email: String(raw?.email || ""),
    mobile: String(raw?.mobile || ""),
    home: String(raw?.home || ""),
    projectName: String(raw?.projectName || ""),
    customerAddress,
    projectAddress,
    invoiceAddress,
    customerAddressStructured: customerStructured,
    projectAddressStructured: projectStructured,
    invoiceAddressStructured: invoiceStructured,
    postcode: String(raw?.postcode || extractPostcodeFromAddress(projectAddress) || ""),
    what3words: String(raw?.what3words || ""),
    businessName: raw?.type === "Business" ? String(raw?.businessName || "") : undefined,
    contactPerson: raw?.type === "Business" ? String(raw?.contactPerson || "") : undefined,
    estimates: Array.isArray(raw?.estimates) ? raw.estimates.map((estimate: any) => normalizeLoadedEstimate(estimate)) : [],
  };
}

function loadPersistedClients(): Client[] | null {
  return null;
}

function demoScenarioForIndex(index: number) {
  if (index < DEMO_FOLLOW_UP_COUNT) return "follow_up";
  if (index < DEMO_FOLLOW_UP_COUNT + DEMO_ORDER_COUNT) return "order";
  if (index < DEMO_FOLLOW_UP_COUNT + DEMO_ORDER_COUNT + DEMO_LOST_COUNT) return "lost";
  if (index < DEMO_FOLLOW_UP_COUNT + DEMO_ORDER_COUNT + DEMO_LOST_COUNT + DEMO_INSTALLATION_COUNT) return "installation";
  return "open";
}

function randomIsoDateFromToday(minDays: number, maxDays: number) {
  const d = new Date();
  const daysToAdd = Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays;
  d.setDate(d.getDate() + daysToAdd);
  return d.toISOString().slice(0, 10);
}


function seedDemoEstimateOutcomesAndFollowUps(clients: Client[], enabled: boolean) {
  if (!enabled) return;

  let globalEstimateIndex = 0;

  clients.forEach((client) => {
    (client.estimates ?? []).forEach((estimate) => {
      const scenario = demoScenarioForIndex(globalEstimateIndex);

      if (scenario === "lost") {
        (estimate as any).outcome = "Lost";
      } else if (scenario === "order" || scenario === "installation") {
        (estimate as any).outcome = "Order";
      } else {
        (estimate as any).outcome = "Open";
      }

      globalEstimateIndex += 1;
    });
  });
}

/* =========================
   UI primitives (inline only)
========================= */

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid var(--color-border)",
        background: "var(--ui-card-background, var(--color-surface))",
        padding: 16,
        boxShadow: "var(--shadow-sm)",
        color: "var(--color-text-primary)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 16, margin: 0, fontWeight: 800, color: "var(--color-text-primary)" }}>{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: "var(--color-text-primary)" }}>{children}</h3>;
}

function Small({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 12, color: "var(--color-text-muted)", ...(style || {}) }}>{children}</div>;
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      type="button"
      disabled={!!disabled}
      onClick={onClick}
      style={{
        borderRadius: 18,
        border: isPrimary ? "none" : "1px solid var(--color-border)",
        background: isPrimary ? "var(--color-brand-primary)" : "var(--ui-control-background, var(--color-surface))",
        color: isPrimary ? "var(--color-brand-on-primary)" : "var(--color-text-secondary)",
        padding: "10px 14px",
        fontSize: 14,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  list,
  disabled,
  readOnly,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  list?: string;
  disabled?: boolean;
  readOnly?: boolean;
  autoComplete?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      list={list}
      disabled={disabled}
      readOnly={readOnly}
      autoComplete={autoComplete}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        borderRadius: 12,
        border: "1px solid var(--color-border)",
        padding: "10px 12px",
        fontSize: 14,
        background: "var(--ui-control-background, var(--color-surface))",
        color: "var(--color-text-primary)",
        outline: "none",
      }}
    />
  );
}

function ModalOverlay({
  children,
  width = "min(1100px, 96vw)",
  onClose,
}: {
  children: React.ReactNode;
  width?: string;
  onClose?: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(24,24,27,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={() => onClose?.()}
    >
      <div
        style={{
          width,
          maxHeight: "92vh",
          overflow: "auto",
          borderRadius: 18,
          border: "1px solid var(--color-border)",
          background: "var(--ui-card-background, var(--color-surface))",
          color: "var(--color-text-primary)",
          padding: 16,
          boxShadow: "var(--shadow-lg)",
          display: "grid",
          gap: 12,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 800,
        background: "var(--color-surface-muted)",
        color: "var(--color-text-primary)",
        border: "1px solid var(--color-border)",
      }}
    >
      {children}
    </span>
  );
}

function SidebarItem({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 14,
        padding: "10px 12px",
        marginBottom: 6,
        cursor: "pointer",
        background: active ? "var(--color-brand-primary)" : "transparent",
        color: active ? "var(--color-brand-on-primary)" : "var(--color-text-secondary)",
        fontSize: 14,
        fontWeight: active ? 800 : 600,
      }}
    >
      {label}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 700, marginBottom: 6 };

type TopShellPage =
  | "app"
  | "tools"
  | "admin"
  | "window_types_render_preview"
  | "configurator_render"
  | "b92_configurator"
  | "client_portal"
  | "settings"
  | "help";

function TopShellPlaceholder({
  title,
  summary,
}: {
  title: string;
  summary: string;
}) {
  return (
    <Card style={{ minHeight: 520 }}>
      <div style={{ display: "grid", gap: 12, maxWidth: 920 }}>
        <div>
          <H2>{title}</H2>
          <Small>{summary}</Small>
        </div>
        <div
          style={{
            borderRadius: 16,
            border: "1px solid var(--color-border)",
            background: "var(--ui-card-background, var(--color-surface))",
            padding: 16,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 900, color: "var(--color-text-primary)" }}>Placeholder</div>
          <Small>This section is now wired into the live shell and ready for the next implementation phase.</Small>
        </div>
      </div>
    </Card>
  );
}

function ToolsHubPage() {
  const [activeTool, setActiveTool] = React.useState("phpp");

  const tabs = [
    { key: "phpp", label: "PHPP Calculator" },
    { key: "enbs", label: "EN BS Numbers" },
    { key: "wind", label: "UK Wind Zone" },
    { key: "glass", label: "Glass weight calculator" },
    { key: "parto", label: "Part O Modelling" },
    { key: "partm", label: "Part M" },
    { key: "partk", label: "Part K" },
    { key: "static", label: "Static calculation" },
    { key: "loading", label: "Window/Glass Loading Calculator" },
  ];

  function renderToolContent() {
    if (activeTool === "enbs") {
      return <BSENStandardsTool />;
    }

    if (activeTool === "glass") {
      return <GlassWeightCalculatorTool />;
    }

    const active = tabs.find((tab) => tab.key === activeTool);

    return (
      <div className="tools-hub__placeholder">
        <div className="tools-hub__placeholder-title">{active?.label}</div>
        <div className="tools-hub__placeholder-copy">
          Tool placeholder — integration coming next.
        </div>
      </div>
    );
  }

  return (
    <Card style={{ minHeight: 520 }}>
      <div className="tools-hub">
        <div className="tools-hub__tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTool(tab.key)}
              className={`tools-hub__tab${activeTool === tab.key ? " tools-hub__tab--active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {renderToolContent()}
      </div>
    </Card>
  );
}

/* =========================
   Main App
========================= */

function scaleSplitsToTotal(splits: number[] | undefined, total: number, parts: number, minEach = 1): number[] {
  const safeParts = Math.max(1, Math.floor(parts || 1));
  const safeTotal = Math.max(minEach * safeParts, Math.floor(total || 0));

  // Start from provided splits or equal distribution
  let arr: number[] = Array.isArray(splits) ? splits.slice(0, safeParts) : [];
  while (arr.length < safeParts) arr.push(Math.floor(safeTotal / safeParts));

  // Sanitise numbers + enforce minimums
  arr = arr.map((v) => Math.max(minEach, Math.floor(Number.isFinite(v) ? v : minEach)));

  const sum = arr.reduce((a, b) => a + b, 0);

  // If sum is zero (shouldn''t happen), fall back
  if (sum <= 0) {
    const base = Math.floor(safeTotal / safeParts);
    arr = Array.from({ length: safeParts }, () => Math.max(minEach, base));
  }

  // Scale to total
  const sum2 = arr.reduce((a, b) => a + b, 0);
  let scaled = arr.map((v) => Math.max(minEach, Math.round((v / sum2) * safeTotal)));

  // Fix rounding drift by adjusting the largest element
  let drift = safeTotal - scaled.reduce((a, b) => a + b, 0);
  if (drift !== 0) {
    let idx = 0;
    for (let i = 1; i < scaled.length; i++) if (scaled[i] > scaled[idx]) idx = i;
    scaled[idx] = Math.max(minEach, scaled[idx] + drift);
  }

  // Final ensure exact total (still possible if minEach clamps)
  let finalSum = scaled.reduce((a, b) => a + b, 0);
  if (finalSum !== safeTotal) {
    // distribute remaining drift across entries that can take it
    let d = safeTotal - finalSum;
    const step = d > 0 ? 1 : -1;
    d = Math.abs(d);

    let guard = 0;
    while (d > 0 && guard < 100000) {
      for (let i = 0; i < scaled.length && d > 0; i++) {
        const next = scaled[i] + step;
        if (next >= minEach) {
          scaled[i] = next;
          d--;
        }
      }
      guard++;
      if (guard > 1000) break;
    }
  }

  return scaled;
}

function ClientDetailsReadonly({ c, onEdit }: { c: Client; onEdit: () => void }) {
  const [customerAddressOpen, setCustomerAddressOpen] = useState(false);

  const [invoiceAddressOpen, setInvoiceAddressOpen] = useState(false);


  const customerStructured = resolveStructuredAddress((c as any).customerAddressStructured, (c as any).customerAddress || "");
  const [ca1, ca2, ca3, ct, cc, cco, cp] = addressTuple(customerStructured);

  const invoiceStructured = resolveStructuredAddress(c.invoiceAddressStructured, c.invoiceAddress || "");
  const [i1, i2, i3, it, ic, ico, ip] = addressTuple(invoiceStructured);

  return (
    <div className="legacy-surface-card" style={{ padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <H3>Client contact information</H3>
        <Button variant="secondary" onClick={onEdit}>Edit</Button>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={c.type === "Business"} disabled />
            <span className="legacy-checkbox-label" style={{ fontSize: 12, fontWeight: 800 }}>Business customer</span>
          </label>
          <Small>Type: {c.type}</Small>
        </div>

        {c.type === "Business" ? (
          <>
            <div>
              <div style={labelStyle}>Business name</div>
              <Input value={c.businessName || c.clientName || ""} onChange={() => {}} disabled />
            </div>
            <div>
              <div style={labelStyle}>Contact name</div>
              <Input value={c.contactPerson || ""} onChange={() => {}} disabled />
            </div>
          </>
        ) : (
          <div>
            <div style={labelStyle}>Client name</div>
            <Input value={c.clientName || ""} onChange={() => {}} disabled />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={labelStyle}>Email</div>
            <Input value={c.email || ""} onChange={() => {}} disabled />
          </div>
          <div>
            <div style={labelStyle}>Mobile</div>
            <Input value={c.mobile || ""} onChange={() => {}} disabled />
          </div>
        </div>

        <div>
          <div style={labelStyle}>Home</div>
          <Input value={c.home || ""} onChange={() => {}} disabled />
        </div>

        <div className="legacy-section-divider" style={{ marginTop: 10, paddingTop: 10 }}>
          <button
            type="button"
            onClick={() => setCustomerAddressOpen((prev) => !prev)}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              margin: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              font: "inherit",
            }}
            className="legacy-section-toggle"
          >
            <H3>{customerAddressOpen ? "▼" : "▶"} Customer address</H3>
          </button>

          {customerAddressOpen && (
            <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={labelStyle}>Address line 1</div>
                  <Input value={ca1} onChange={() => {}} disabled />
                </div>
                <div>
                  <div style={labelStyle}>Address line 2</div>
                  <Input value={ca2} onChange={() => {}} disabled />
                </div>
              </div>

              <div>
                <div style={labelStyle}>Address line 3</div>
                <Input value={ca3} onChange={() => {}} disabled />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={labelStyle}>Town</div>
                  <Input value={ct} onChange={() => {}} disabled />
                </div>
                <div>
                  <div style={labelStyle}>City</div>
                  <Input value={cc} onChange={() => {}} disabled />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={labelStyle}>County/District</div>
                  <Input value={cco} onChange={() => {}} disabled />
                </div>
                <div>
                  <div style={labelStyle}>Postcode</div>
                  <Input value={cp} onChange={() => {}} disabled />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="legacy-section-divider" style={{ marginTop: 10, paddingTop: 10 }}>
          <button
            type="button"
            onClick={() => setInvoiceAddressOpen((prev) => !prev)}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              margin: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              font: "inherit",
            }}
            className="legacy-section-toggle"
          >
            <H3>{invoiceAddressOpen ? "▼" : "▶"} Invoice address</H3>
          </button>

          {invoiceAddressOpen && (
            <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={labelStyle}>Address line 1</div>
                  <Input value={i1} onChange={() => {}} disabled />
                </div>
                <div>
                  <div style={labelStyle}>Address line 2</div>
                  <Input value={i2} onChange={() => {}} disabled />
                </div>
              </div>

              <div>
                <div style={labelStyle}>Address line 3</div>
                <Input value={i3} onChange={() => {}} disabled />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={labelStyle}>Town</div>
                  <Input value={it} onChange={() => {}} disabled />
                </div>
                <div>
                  <div style={labelStyle}>City</div>
                  <Input value={ic} onChange={() => {}} disabled />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={labelStyle}>County/District</div>
                  <Input value={ico} onChange={() => {}} disabled />
                </div>
                <div>
                  <div style={labelStyle}>Postcode</div>
                  <Input value={ip} onChange={() => {}} disabled />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type ClientCollectionViewMode = "list" | "grid";

type ClientCollectionItem = {
  client: Client;
  displayName: string;
  projectName: string;
  contactName: string;
  email: string;
  primaryPhone: string;
  secondaryPhone: string;
  locationSummary: string;
  estimateCount: number;
  openEstimateCount: number;
  orderEstimateCount: number;
  lostEstimateCount: number;
};

function getClientCollectionDisplayName(client: Client) {
  return client.type === "Business" ? (client.businessName || client.clientName || "Business") : (client.clientName || "Client");
}

function buildClientCollectionItem(client: Client): ClientCollectionItem {
  const estimates = client.estimates ?? [];
  const orderEstimateCount = estimates.filter((estimate) => (((estimate as any).outcome ?? "Open") as Models.EstimateOutcome) === "Order").length;
  const lostEstimateCount = estimates.filter((estimate) => (((estimate as any).outcome ?? "Open") as Models.EstimateOutcome) === "Lost").length;
  const openEstimateCount = Math.max(0, estimates.length - orderEstimateCount - lostEstimateCount);
  const locationSummary =
    buildClientLocationLabel(client) ||
    client.projectAddress ||
    client.customerAddress ||
    client.invoiceAddress ||
    "No address set";

  return {
    client,
    displayName: getClientCollectionDisplayName(client),
    projectName: client.projectName || "No project name",
    contactName:
      client.type === "Business"
        ? (client.contactPerson || client.clientName || "No contact name")
        : (client.clientName || "Client"),
    email: client.email || "No email",
    primaryPhone: client.mobile || client.home || "No phone",
    secondaryPhone: client.mobile && client.home ? client.home : "",
    locationSummary,
    estimateCount: estimates.length,
    openEstimateCount,
    orderEstimateCount,
    lostEstimateCount,
  };
}

function ClientCollectionViewToggle({
  viewMode,
  onChange,
}: {
  viewMode: ClientCollectionViewMode;
  onChange: (next: ClientCollectionViewMode) => void;
}) {
  return (
    <div className="clients-view-toggle" role="tablist" aria-label="Client view mode">
      <Button variant={viewMode === "list" ? "primary" : "secondary"} onClick={() => onChange("list")}>
        List
      </Button>
      <Button variant={viewMode === "grid" ? "primary" : "secondary"} onClick={() => onChange("grid")}>
        Grid
      </Button>
    </div>
  );
}

function ClientCollectionStats({ item, compact = false }: { item: ClientCollectionItem; compact?: boolean }) {
  return (
    <div className={`clients-collection-stats${compact ? " clients-collection-stats--compact" : ""}`}>
      <span>{item.estimateCount} total</span>
      <span>{item.openEstimateCount} open</span>
      <span>{item.orderEstimateCount} orders</span>
      <span>{item.lostEstimateCount} lost</span>
    </div>
  );
}

function ClientsListView({
  items,
  onOpenClient,
  onCreateEstimate,
}: {
  items: ClientCollectionItem[];
  onOpenClient: (client: Client) => void;
  onCreateEstimate: (client: Client) => void;
}) {
  return (
    <div className="clients-surface-list" role="list">
      {items.map((item) => (
        <article
          key={item.client.id}
          className="clients-surface-row"
          role="listitem"
          data-testid="client-database-row"
          data-client-ref={item.client.clientRef}
        >
          <div className="clients-surface-row__primary">
            <div className="clients-surface-row__headline">
              <div className="clients-surface-row__title">
                <H3>{item.displayName}</H3>
                <Pill>{item.client.clientRef}</Pill>
                <span className="clients-surface-row__type">{item.client.type}</span>
              </div>
              <Small>{item.projectName}</Small>
            </div>
            <ClientCollectionStats item={item} />
          </div>

          <div className="clients-surface-row__details">
            <div className="clients-surface-detail">
              <span className="clients-surface-detail__label">Contact</span>
              <span className="clients-surface-detail__value">{item.contactName}</span>
            </div>
            <div className="clients-surface-detail">
              <span className="clients-surface-detail__label">Email</span>
              <span className="clients-surface-detail__value">{item.email}</span>
            </div>
            <div className="clients-surface-detail">
              <span className="clients-surface-detail__label">Phone</span>
              <span className="clients-surface-detail__value">
                {item.primaryPhone}
                {item.secondaryPhone ? ` • ${item.secondaryPhone}` : ""}
              </span>
            </div>
            <div className="clients-surface-detail">
              <span className="clients-surface-detail__label">Location</span>
              <span className="clients-surface-detail__value">{item.locationSummary}</span>
            </div>
          </div>

          <div className="clients-surface-row__actions">
            <Button variant="primary" onClick={() => onOpenClient(item.client)}>
              Open
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ClientsGridView({
  items,
  onOpenClient,
  onCreateEstimate,
}: {
  items: ClientCollectionItem[];
  onOpenClient: (client: Client) => void;
  onCreateEstimate: (client: Client) => void;
}) {
  return (
    <div className="clients-surface-grid">
      {items.map((item) => (
        <article
          key={item.client.id}
          className="clients-surface-card"
          data-testid="client-database-row"
          data-client-ref={item.client.clientRef}
        >
          <div className="clients-surface-card__header">
            <div className="clients-surface-card__title">
              <H3>{item.displayName}</H3>
              <Pill>{item.client.clientRef}</Pill>
            </div>
            <span className="clients-surface-row__type">{item.client.type}</span>
          </div>

          <div className="clients-surface-card__project">{item.projectName}</div>
          <ClientCollectionStats item={item} compact />

          <div className="clients-surface-card__summary">
            <div>{item.contactName}</div>
            <div>{item.primaryPhone}</div>
            <div>{item.locationSummary}</div>
          </div>

          <div className="clients-surface-card__actions">
            <Button variant="primary" onClick={() => onOpenClient(item.client)}>
              Open
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ClientSummary({ c }: { c: Client }) {
  const headline = c.type === "Business" ? (c.businessName || c.clientName) : c.clientName;
  const sub = c.type === "Business" ? (c.contactPerson ? `Contact: ${c.contactPerson}` : "Contact: ") : "Individual";

  return (
    <div className="legacy-surface-card" style={{ padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <H3>{headline}</H3>
            <Pill>{c.clientRef}</Pill>
            <Small>{c.type}</Small>
          </div>
          <Small>{sub}</Small>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {c.email ? <Pill>{c.email}</Pill> : <Pill>Email: </Pill>}
          {c.mobile ? <Pill>Mob: {c.mobile}</Pill> : <Pill>Mob: </Pill>}
          {c.home ? <Pill>Home: {c.home}</Pill> : null}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const ENV = ((import.meta as any)?.env ?? {}) as Record<string, unknown>;


  const [menu, setMenu] = useState<Models.MenuKey>("dashboard");

  const [view, setView] = useState<Models.View>("customers");


  const estimatePickerRef = useRef<EstimatePickerFeatureHandle>(null);

  const [systemSettings, setSystemSettings] = useState(() => loadSettings());
  const [topShellPage, setTopShellPage] = useState<TopShellPage>("app");


  useEffect(() => {
    saveSettings(systemSettings);
  }, [systemSettings]);


  

  const [estimatePickerClientId, setEstimatePickerClientId] = useState<Models.ClientId | null>(null);

  const [estimateCounter, setEstimateCounter] = useState(1);


  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [demoClientsLoaded, setDemoClientsLoaded] = useState(false);
  const [demoModeWarning, setDemoModeWarning] = useState("");


  const [clientCounter, setClientCounter] = useState(1);

  async function refreshClientsFromApi() {
    const activeClientRows = await loadClientsAPI();
    const deletedClientRows = await loadClientsAPI({ onlyDeleted: true });

    const activeRows = Array.isArray(activeClientRows) ? activeClientRows : [];
    const deletedRows = Array.isArray(deletedClientRows) ? deletedClientRows : [];

    const baseClients = activeRows.map((row) => mapDbClientToClient(row));

    const hydratedClients = await Promise.all(
      baseClients.map(async (client) => {
        const [activeEstimatesRaw, deletedEstimatesRaw] = await Promise.all([
          loadEstimates(client.id).catch(() => []),
          loadEstimates(client.id, { onlyDeleted: true }).catch(() => []),
        ]);

        const activeEstimates = Array.isArray(activeEstimatesRaw)
          ? activeEstimatesRaw.map((row) => mapDbEstimateToEstimate(row))
          : [];
        const deletedEstimates = Array.isArray(deletedEstimatesRaw)
          ? deletedEstimatesRaw.map((row) => mapDbEstimateToEstimate(row))
          : [];

        return {
          client: { ...client, estimates: activeEstimates },
          deletedEstimateRecords: deletedEstimates.map((estimate) => ({
            estimate,
            deletedAt: String((estimate as any).deleted_at || new Date().toISOString()),
          })),
        };
      })
    );

    const nextClients = hydratedClients.map((entry) => entry.client);
    const nextDeletedEstimatesByClientId = hydratedClients.reduce((acc, entry) => {
      if (entry.deletedEstimateRecords.length) {
        acc[entry.client.id] = entry.deletedEstimateRecords;
      }
      return acc;
    }, {} as Record<string, DeletedEstimateRecord[]>);

    const nextDeletedClientsById = deletedRows.reduce((acc, row) => {
      const deletedClient = mapDbClientToClient(row);
      acc[deletedClient.id] = {
        client: { ...deletedClient, estimates: [] },
        deletedAt: String(row?.deleted_at || new Date().toISOString()),
        deletedEstimates: [],
      };
      return acc;
    }, {} as Record<string, DeletedClientRecord>);

    setClients(nextClients);
    setDeletedEstimatesByClientId(nextDeletedEstimatesByClientId);
    setDeletedClientsById(nextDeletedClientsById);
    setDemoClientsLoaded(false);

    const maxRef = maxClientRefNumber(activeRows);
    setClientCounter(Math.max(1, maxRef + 1));
    setClientsLoaded(true);

    return {
      clientCount: nextClients.length,
      protectedClientCount: nextClients.filter((client) => isProtectedClientRef(client.clientRef)).length,
    };
  }


  const [deletedEstimatesByClientId, setDeletedEstimatesByClientId] =
    useState<Record<string, DeletedEstimateRecord[]>>({});

  const [deletedClientsById, setDeletedClientsById] =
    useState<Record<string, DeletedClientRecord>>({});

  useEffect(() => {
    const nextEstimateCounter = Math.max(
      1,
      maxEstimateRefNumberForState(clients, deletedEstimatesByClientId, deletedClientsById) + 1
    );
    setEstimateCounter((prev) => Math.max(prev, nextEstimateCounter));
  }, [clients, deletedEstimatesByClientId, deletedClientsById]);

  useEffect(() => {
    async function syncClientsForSettings() {
      setClientsLoaded(false);
      setDemoModeWarning("");

      try {
        const apiResult = await refreshClientsFromApi();
        if (apiResult.clientCount > 0) {
          if (systemSettings.loadDemoClients || systemSettings.loadDemoEstimates) {
            setDemoModeWarning(
              "Demo data is enabled in local settings, but live database clients were found. Demo clients were not loaded."
            );
          }
        } else if (systemSettings.loadDemoClients) {
          const freshClients = makeDefaultClients({
            uid,
            nextClientRef,
            loadDemoClients: true,
            loadDemoEstimates: systemSettings.loadDemoEstimates,
          });

          seedDemoEstimateOutcomesAndFollowUps(
            freshClients,
            systemSettings.loadDemoEstimates
          );

          console.warn("Demo mode active: displaying generated demo clients because no live database clients were returned.");
          setDemoModeWarning("Demo mode active: generated demo clients are displayed because no live database clients were returned.");
          setClients(freshClients);
          setDeletedEstimatesByClientId({});
          setDeletedClientsById({});
          setClientCounter(33);
          setDemoClientsLoaded(true);
          setClientsLoaded(true);
        } else {
          if (systemSettings.loadDemoEstimates) {
            setDemoModeWarning("Load Demo Estimates is enabled, but Load Demo Clients is off. Live client loading remains active.");
          }
          setDemoClientsLoaded(false);
          setClientsLoaded(true);
        }
      } catch (error) {
        console.error("Failed to load clients from API", error);
        setClients([]);
        setDeletedEstimatesByClientId({});
        setDeletedClientsById({});
        setClientCounter(1);
        setDemoClientsLoaded(false);
        setClientsLoaded(true);
      }

      setSelectedClientId(null);
      setSelectedEstimateId(null);
      setEstimatePickerClientId(null);
    }

    syncClientsForSettings();
  }, [systemSettings.loadDemoClients, systemSettings.loadDemoEstimates]);

  const [selectedClientId, setSelectedClientId] = useState<Models.ClientId | null>(null);

  const selectedClient = useMemo(() => clients.find((c) => c.id === selectedClientId) ?? null, [clients, selectedClientId]);

  const [selectedEstimateId, setSelectedEstimateId] = useState<Models.EstimateId | null>(null);

  const selectedEstimate = useMemo(() => {
    if (!selectedClient) return null;
    return selectedClient.estimates.find((e) => e.id === selectedEstimateId) ?? null;
  }, [selectedClient, selectedEstimateId]);
  // Add client UI
  const [showAddClient, setShowAddClient] = useState(false);
  const [clientSaving, setClientSaving] = useState(false);
  const [showAddEstimateModal, setShowAddEstimateModal] = useState(false);
  const [createEstimateClientId, setCreateEstimateClientId] = useState<string>("");
  const [createEstimateSubmitting, setCreateEstimateSubmitting] = useState(false);
  const [resumeEstimateCreationAfterClientCreate, setResumeEstimateCreationAfterClientCreate] = useState(false);

  // client edit mode
  const [editingClientId, setEditingClientId] = useState<Models.ClientId | null>(null);


  function splitAddress7(addr: string): [string, string, string, string, string, string, string] {
    return addressTuple(parseAddressString(addr || ""));
  }

 function openEditClientPanel(c: Client) {

  setView("customers");
  setEditingClientId(c.id);

  setDraftClientType(c.type === "Business" ? "Business" : "Individual");
  setDraftClientName(c.clientName || "");
  setDraftBusinessName(c.businessName || "");
  setDraftContactName(c.contactPerson || "");

  setDraftProjectName(c.projectName || "");

  setDraftEmail(c.email || "");
  setDraftMobile(c.mobile || "");
  setDraftHome(c.home || "");

  const [ca1, ca2, ca3, ct, cc, cco, cp] = splitAddress7((c as any).customerAddress || "");
  setDraftCustAddress1(ca1);
  setDraftCustAddress2(ca2);
  setDraftCustAddress3(ca3);
  setDraftCustTown(ct);
  setDraftCustCity(cc);
  setDraftCustCounty(cco);
  setDraftCustPostcode(cp);

  const [ia1, ia2, ia3, it, ic, ico, ip] = splitAddress7(c.invoiceAddress || "");
  setDraftInvAddress1(ia1);
  setDraftInvAddress2(ia2);
  setDraftInvAddress3(ia3);
  setDraftInvTown(it);
  setDraftInvCity(ic);
  setDraftInvCounty(ico);
  setDraftInvPostcode(ip);

  const invoiceText = (c.invoiceAddress || "").trim();
  const customerText = ((c as any).customerAddress || "").trim();

  if (invoiceText === customerText || invoiceText === "") setInvoiceAddressMode("customer");
  else setInvoiceAddressMode("custom");

  setCustomerAddressSectionOpen(false);
  setInvoiceAddressSectionOpen(false);
  setShowAddClient(true);
}


  function updateClient(type: ClientType) {
    if (!editingClientId) return;

    const customerAddressStructured: Address = {
      line1: (draftCustAddress1 || "").trim(),
      line2: (draftCustAddress2 || "").trim(),
      line3: (draftCustAddress3 || "").trim(),
      town: (draftCustTown || "").trim(),
      city: (draftCustCity || "").trim(),
      county: (draftCustCounty || "").trim(),
      postcode: (draftCustPostcode || "").trim(),
    };

    const customInvoiceAddressStructured: Address = {
      line1: (draftInvAddress1 || "").trim(),
      line2: (draftInvAddress2 || "").trim(),
      line3: (draftInvAddress3 || "").trim(),
      town: (draftInvTown || "").trim(),
      city: (draftInvCity || "").trim(),
      county: (draftInvCounty || "").trim(),
      postcode: (draftInvPostcode || "").trim(),
    };

    const customerAddress = buildAddressString(customerAddressStructured) || DEFAULT_CUSTOMER_ADDRESS;

    const invoiceAddressStructured =
      invoiceAddressMode === "customer"
        ? { ...customerAddressStructured }
        : { ...customInvoiceAddressStructured };

    const invoiceAddress = buildAddressString(invoiceAddressStructured) || customerAddress;

    const businessName = (draftBusinessName || "").trim();
    const contactPerson = (draftContactName || "").trim();
    const clientName = type === "Business" ? (businessName || "Business") : ((draftClientName || "").trim() || "Client");

    const updatedClient = {
      ...(clients.find((c) => c.id === editingClientId) as Client),
      id: editingClientId,
      type,
      clientName,
      businessName: type === "Business" ? businessName : undefined,
      contactPerson: type === "Business" ? contactPerson : undefined,
      email: (draftEmail || "").trim(),
      mobile: (draftMobile || "").trim(),
      home: (draftHome || "").trim(),
      projectName: (draftProjectName || "").trim(),
      customerAddress,
      projectAddress: clients.find((c) => c.id === editingClientId)?.projectAddress || "",
      invoiceAddress,
      customerAddressStructured: resolveStructuredAddress(customerAddressStructured, customerAddress),
      projectAddressStructured: clients.find((c) => c.id === editingClientId)?.projectAddressStructured,
      invoiceAddressStructured: resolveStructuredAddress(invoiceAddressStructured, invoiceAddress),
      postcode: clients.find((c) => c.id === editingClientId)?.postcode || "",
      what3words: clients.find((c) => c.id === editingClientId)?.what3words || "",
      latitude: clients.find((c) => c.id === editingClientId)?.latitude ?? null,
      longitude: clients.find((c) => c.id === editingClientId)?.longitude ?? null,
      estimates: clients.find((c) => c.id === editingClientId)?.estimates ?? [],
      clientRef: clients.find((c) => c.id === editingClientId)?.clientRef || nextClientRef(clientCounter),
    } as Client;

    apiFetch(`/api/clients/${editingClientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildDbClientPayload(updatedClient)),
    }).catch((error) => {
      if (error instanceof ApiRequestError) {
        console.error("Failed to update client", {
          status: error.status,
          path: error.path,
          body: error.body,
          message: error.message,
        });
        return;
      }

      console.error("Failed to update client", error);
    });

    setClients((prev) => prev.map((c) => (c.id !== editingClientId ? c : updatedClient)));

    setShowAddClient(false);
    setEditingClientId(null);
  }


  const [draftClientType, setDraftClientType] = useState<ClientType>("Individual");

  const [draftClientName, setDraftClientName] = useState("");

  const [draftBusinessName, setDraftBusinessName] = useState("");

  const [draftContactName, setDraftContactName] = useState("");

  const [draftProjectName, setDraftProjectName] = useState("");
  const [draftWhat3Words, setDraftWhat3Words] = useState("");

  const [draftEmail, setDraftEmail] = useState("");

  const [draftMobile, setDraftMobile] = useState("");

  const [draftHome, setDraftHome] = useState("");


  const [draftCustAddress1, setDraftCustAddress1] = useState("");

  const [draftCustAddress2, setDraftCustAddress2] = useState("");

  const [draftCustAddress3, setDraftCustAddress3] = useState("");

  const [draftCustTown, setDraftCustTown] = useState("");

  const [draftCustCity, setDraftCustCity] = useState("");

  const [draftCustCounty, setDraftCustCounty] = useState("");

  const [draftCustPostcode, setDraftCustPostcode] = useState("");


  // Add client: Project + Invoice addresses
  const [draftProjAddress1, setDraftProjAddress1] = useState("");

  const [draftProjAddress2, setDraftProjAddress2] = useState("");

  const [draftProjAddress3, setDraftProjAddress3] = useState("");

  const [draftProjTown, setDraftProjTown] = useState("");

  const [draftProjCity, setDraftProjCity] = useState("");

  const [draftProjCounty, setDraftProjCounty] = useState("");

  const [draftProjPostcode, setDraftProjPostcode] = useState("");


  const [invoiceAddressMode, setInvoiceAddressMode] = useState<"customer" | "custom">("customer");

  const [draftInvAddress1, setDraftInvAddress1] = useState("");

  const [draftInvAddress2, setDraftInvAddress2] = useState("");

  const [draftInvAddress3, setDraftInvAddress3] = useState("");

  const [draftInvTown, setDraftInvTown] = useState("");

  const [draftInvCity, setDraftInvCity] = useState("");

  const [draftInvCounty, setDraftInvCounty] = useState("");

  const [draftInvPostcode, setDraftInvPostcode] = useState("");

  const [customerAddressSectionOpen, setCustomerAddressSectionOpen] = useState(false);

  const [invoiceAddressSectionOpen, setInvoiceAddressSectionOpen] = useState(false);


  const [clientDbSearch, setClientDbSearch] = useState("");

  const [clientDbFilter, setClientDbFilter] = useState<"All" | "Open" | "Orders" | "Lost">(() =>
    getPreference(CLIENT_DB_PREF_KEYS.filter, "All", isClientDbFilter)
  );

  const [clientDbSort, setClientDbSort] = useState<"asc" | "desc">(() =>
    getPreference(CLIENT_DB_PREF_KEYS.sortDirection, "asc", isSortDirection)
  );

  const [clientDbSortField, setClientDbSortField] = useState<"client_name" | "client_number" | "project_name">(() =>
    getPreference(CLIENT_DB_PREF_KEYS.sortField, "client_number", isClientDbSortField)
  );
  const [clientCollectionViewMode, setClientCollectionViewMode] = useState<ClientCollectionViewMode>(() =>
    getPreference(CLIENT_DB_PREF_KEYS.viewMode, "list", isEstimateCollectionViewMode)
  );


  const currentMonthName = ORDER_MONTHS[new Date().getMonth()];
  const monthFilterOptions = ["All", ...ORDER_MONTHS] as const;
  type GlobalMonthFilter = (typeof monthFilterOptions)[number];
  type GlobalSortField = "client_name" | "client_number" | "project_name" | "total_cost";
  type GlobalEstimateMenuKey = "estimates" | "orders" | "lost" | "installation";

  const [globalSearch, setGlobalSearch] = useState("");

  const [globalSort, setGlobalSort] = useState<"asc" | "desc">("asc");

  const [globalSortField, setGlobalSortField] = useState<GlobalSortField>("client_number");

  const [globalMonthFilter, setGlobalMonthFilter] = useState<GlobalMonthFilter>("All");


  const [globalSelectModeByMenu, setGlobalSelectModeByMenu] = useState<Record<string, boolean>>({});

  const [globalSelectedEstimateIdsByMenu, setGlobalSelectedEstimateIdsByMenu] = useState<Record<string, Record<string, boolean>>>({});
  const [globalExpandedEstimateId, setGlobalExpandedEstimateId] = useState<Models.EstimateId | null>(null);
  const [globalStatusMenuForEstimateId, setGlobalStatusMenuForEstimateId] = useState<string | null>(null);
  const [globalSelectedOrderForInstallations, setGlobalSelectedOrderForInstallations] = useState<string | null>(null);
  const [globalRankedInstallers, setGlobalRankedInstallers] = useState<any[]>([]);
  const [globalSelectedInstallerByEstimateId, setGlobalSelectedInstallerByEstimateId] = useState<Record<string, string>>({});
  const [globalSupplierEstimateFilesByEstimateId, setGlobalSupplierEstimateFilesByEstimateId] = useState<Record<string, string[]>>({});
  const [globalItemPriceByPositionId, setGlobalItemPriceByPositionId] = useState<Record<string, string>>({});
  const [globalSendModalOpen, setGlobalSendModalOpen] = useState(false);
  const [globalSendModalEstimateId, setGlobalSendModalEstimateId] = useState<string | null>(null);
  const [globalSendModalAddFollowUp, setGlobalSendModalAddFollowUp] = useState(true);
  const [globalSendModalFollowUpDays, setGlobalSendModalFollowUpDays] = useState(3);
  const [globalSendModalPhoneCall, setGlobalSendModalPhoneCall] = useState(true);
  const [globalEstimateViewModeByMenu, setGlobalEstimateViewModeByMenu] = useState<Record<"estimates" | "orders" | "lost", EstimateCollectionViewMode>>(() => ({
    estimates: getPreference(GLOBAL_ESTIMATE_PREF_KEYS.viewMode.estimates, "list", isEstimateCollectionViewMode),
    orders: getPreference(GLOBAL_ESTIMATE_PREF_KEYS.viewMode.orders, "list", isEstimateCollectionViewMode),
    lost: getPreference(GLOBAL_ESTIMATE_PREF_KEYS.viewMode.lost, "list", isEstimateCollectionViewMode),
  }));
  const [globalSortDirectionByMenu, setGlobalSortDirectionByMenu] = useState<Record<"estimates" | "orders" | "lost", "asc" | "desc">>(() => ({
    estimates: getPreference(GLOBAL_ESTIMATE_PREF_KEYS.sortDirection.estimates, "asc", isSortDirection),
    orders: getPreference(GLOBAL_ESTIMATE_PREF_KEYS.sortDirection.orders, "asc", isSortDirection),
    lost: getPreference(GLOBAL_ESTIMATE_PREF_KEYS.sortDirection.lost, "asc", isSortDirection),
  }));
  const [globalCreatorFilterByMenu, setGlobalCreatorFilterByMenu] = useState<Record<"estimates" | "orders" | "lost", "mine" | "all">>(() => ({
    estimates: getPreference(GLOBAL_ESTIMATE_PREF_KEYS.creatorFilter.estimates, "mine", isCreatorFilter),
    orders: getPreference(GLOBAL_ESTIMATE_PREF_KEYS.creatorFilter.orders, "mine", isCreatorFilter),
    lost: getPreference(GLOBAL_ESTIMATE_PREF_KEYS.creatorFilter.lost, "mine", isCreatorFilter),
  }));

  useEffect(() => {
    if (!showAddEstimateModal) return;

    if (!clientsLoaded) return;

    if (clients.length === 0) {
      if (createEstimateClientId !== "") setCreateEstimateClientId("");
      return;
    }

    if (!clients.some((client) => client.id === createEstimateClientId)) {
      setCreateEstimateClientId(clients[0].id);
    }
  }, [clients, clientsLoaded, createEstimateClientId, showAddEstimateModal]);

  useEffect(() => {
    setPreference(GLOBAL_ESTIMATE_PREF_KEYS.viewMode.estimates, globalEstimateViewModeByMenu.estimates);
    setPreference(GLOBAL_ESTIMATE_PREF_KEYS.viewMode.orders, globalEstimateViewModeByMenu.orders);
    setPreference(GLOBAL_ESTIMATE_PREF_KEYS.viewMode.lost, globalEstimateViewModeByMenu.lost);
  }, [globalEstimateViewModeByMenu]);

  useEffect(() => {
    setPreference(GLOBAL_ESTIMATE_PREF_KEYS.sortDirection.estimates, globalSortDirectionByMenu.estimates);
    setPreference(GLOBAL_ESTIMATE_PREF_KEYS.sortDirection.orders, globalSortDirectionByMenu.orders);
    setPreference(GLOBAL_ESTIMATE_PREF_KEYS.sortDirection.lost, globalSortDirectionByMenu.lost);
  }, [globalSortDirectionByMenu]);

  useEffect(() => {
    setPreference(GLOBAL_ESTIMATE_PREF_KEYS.creatorFilter.estimates, globalCreatorFilterByMenu.estimates);
    setPreference(GLOBAL_ESTIMATE_PREF_KEYS.creatorFilter.orders, globalCreatorFilterByMenu.orders);
    setPreference(GLOBAL_ESTIMATE_PREF_KEYS.creatorFilter.lost, globalCreatorFilterByMenu.lost);
  }, [globalCreatorFilterByMenu]);

  useEffect(() => {
    setPreference(CLIENT_DB_PREF_KEYS.viewMode, clientCollectionViewMode);
  }, [clientCollectionViewMode]);

  useEffect(() => {
    setPreference(CLIENT_DB_PREF_KEYS.sortDirection, clientDbSort);
  }, [clientDbSort]);

  useEffect(() => {
    setPreference(CLIENT_DB_PREF_KEYS.filter, clientDbFilter);
  }, [clientDbFilter]);

  useEffect(() => {
    setPreference(CLIENT_DB_PREF_KEYS.sortField, clientDbSortField);
  }, [clientDbSortField]);

  const [recycleBinFilter, setRecycleBinFilter] = useState<"all" | "clients" | "estimates">("all");
  const [recycleBinView, setRecycleBinView] = useState<"grid" | "list">("grid");
  const [selectedRecycleClientIds, setSelectedRecycleClientIds] = useState<Record<string, boolean>>({});
  const [selectedRecycleEstimateKeys, setSelectedRecycleEstimateKeys] = useState<Record<string, boolean>>({});

  const [installationExpandedEstimateId, setInstallationExpandedEstimateId] = useState<Models.EstimateId | null>(null);

  const [installationTabByEstimateId, setInstallationTabByEstimateId] = useState<Record<string, "key_dates" | "order_copy">>({});

  const [selectedMapEstimateId, setSelectedMapEstimateId] = useState<Models.EstimateId | null>(null);

  const pendingResolvedCoordinatePersistsRef = useRef<Record<string, boolean>>({});

  const [resolvedLocationsByClientId, setResolvedLocationsByClientId] = useState<Record<string, ResolvedClientLocation | null | undefined>>({});

  const [mapsApiReady, setMapsApiReady] = useState(false);
  
  const [what3WordsPickerOpen, setWhat3WordsPickerOpen] = useState(false);
  const [what3WordsPickerLoading, setWhat3WordsPickerLoading] = useState(false);
  const [what3WordsPickerError, setWhat3WordsPickerError] = useState("");


  const googleMapsApiKey = String((ENV.VITE_GOOGLE_MAPS_API_KEY ?? "")).trim();
  const what3wordsApiKey = String((ENV.VITE_WHAT3WORDS_API_KEY ?? "")).trim();

async function handleWhat3WordsMapPick(lat: number, lng: number) {
  if (!selectedClient || !selectedEstimate) return;

  setWhat3WordsPickerLoading(true);
  setWhat3WordsPickerError("");

  let resolvedWords = "";

  try {
    if (what3wordsApiKey) {
      const words = await convertCoordinatesToWhat3Words(lat, lng, what3wordsApiKey);
      if (words === "__W3W_PAID_REQUIRED__") {
        setWhat3WordsPickerError("Auto-fill requires a paid what3words API plan. Please go to what3words and select the location, then copy the what3words address and paste it into the field manually. Coordinates were still captured and saved from this map click.");
      } else if (!words) {
        setWhat3WordsPickerError("No what3words address could be resolved for that map point. Coordinates were still captured and saved from this map click.");
      } else {
        resolvedWords = words;
      }
    } else {
      setWhat3WordsPickerError("what3words API key missing. Add VITE_WHAT3WORDS_API_KEY to .env.local. Coordinates were still captured and saved from this map click.");
    }

    const updatedEstimate: Estimate = mergeEstimateLocationState({
      ...selectedEstimate,
      what3words: resolvedWords || selectedEstimate.what3words || "",
      latitude: lat,
      longitude: lng,
    });

    setClients((prev) =>
      prev.map((c) =>
        c.id !== selectedClient.id
          ? c
          : {
              ...c,
              estimates: c.estimates.map((e) => (e.id !== selectedEstimate.id ? e : updatedEstimate)),
            }
      )
    );

    updateEstimateAPI(selectedEstimate.id, buildDbEstimatePayload(selectedClient.id, updatedEstimate)).catch(() => {});
    setWhat3WordsPickerOpen(false);
  } catch {
    setWhat3WordsPickerError("Failed to resolve what3words for that map point. Coordinates were still captured and saved from this map click.");

    const updatedEstimate: Estimate = mergeEstimateLocationState({
      ...selectedEstimate,
      latitude: lat,
      longitude: lng,
    });

    setClients((prev) =>
      prev.map((c) =>
        c.id !== selectedClient.id
          ? c
          : {
              ...c,
              estimates: c.estimates.map((e) => (e.id !== selectedEstimate.id ? e : updatedEstimate)),
            }
      )
    );

    updateEstimateAPI(selectedEstimate.id, buildDbEstimatePayload(selectedClient.id, updatedEstimate)).catch(() => {});
  } finally {
    setWhat3WordsPickerLoading(false);
  }
}



  function updateSelectedEstimateLocation(nextEstimate: Estimate) {
    if (!selectedClient || !selectedEstimate) return;

    const normalizedEstimate = mergeEstimateLocationState(nextEstimate);

    setClients((prev) => {
      const nextClients = prev.map((c) =>
        c.id !== selectedClient.id
          ? c
          : {
              ...c,
              estimates: c.estimates.map((e) => (e.id !== selectedEstimate.id ? e : normalizedEstimate)),
            }
      );

      updateEstimateAPI(selectedEstimate.id, buildDbEstimatePayload(selectedClient.id, normalizedEstimate)).catch((error) => {
        console.error("Failed to update estimate location", error);
      });

      return nextClients;
    });
  }

  function updateSelectedEstimateProjectAddress(patch: Partial<Address>) {
    if (!selectedEstimate) return;
    const currentStructured = resolveStructuredAddress(
      selectedEstimate.projectAddressStructured,
      selectedEstimate.projectAddress || ""
    );
    const nextStructured: Address = { ...currentStructured, ...patch };
    const nextProjectAddress = buildAddressString(nextStructured);
    const nextEstimate: Estimate = {
      ...selectedEstimate,
      projectAddressStructured: nextStructured,
      projectAddress: nextProjectAddress,
      postcode: nextStructured.postcode || extractPostcodeFromAddress(nextProjectAddress),
      latitude: null,
      longitude: null,
    };
    updateSelectedEstimateLocation(nextEstimate);
  }
  function clientMatchesFilter(c: Client): boolean {
    if (clientDbFilter === "All") return true;
    const wanted = clientDbFilter === "Orders" ? "Order" : clientDbFilter === "Lost" ? "Lost" : "Open";
    return (c.estimates ?? []).some((e) => (((e as any).outcome ?? "Open") as Models.EstimateOutcome) === wanted);
  }


  function persistEstimateOutcome(
    clientId: Models.ClientId,
    estimateId: Models.EstimateId,
    outcome: Models.EstimateOutcome
  ) {
    setClients((prev) => {
      let updatedEstimate: Estimate | null = null;

      const nextClients = prev.map((c) => {
        if (c.id !== clientId) return c;
        return {
          ...c,
          estimates: c.estimates.map((e) => {
            if (e.id !== estimateId) return e;
            updatedEstimate = { ...e, outcome } as Estimate;
            return updatedEstimate;
          }),
        };
      });

      if (updatedEstimate) {
        updateEstimateAPI(estimateId, buildDbEstimatePayload(clientId, updatedEstimate)).catch((error) => {
          if (error instanceof ApiRequestError && error.isConflict) {
            console.error("Failed to update estimate outcome: duplicate estimate reference", {
              status: error.status,
              path: error.path,
              body: error.body,
              message: error.message,
            });
            return;
          }

          console.error("Failed to update estimate outcome", error);
        });
      }

      return nextClients;
    });
  }
  const filteredClients = useMemo(() => {
    const q = clientDbSearch.trim().toLowerCase();

    const list = clients.filter((c) => {
      if (!clientMatchesFilter(c)) return false;
      if (!q) return true;

      const name = (c.type === "Business" ? (c.businessName || c.clientName) : c.clientName) || "";
      const hay = [
        name,
        c.clientRef || "",
        c.projectName || "",
        c.projectAddress || "",
        c.email || "",
        c.mobile || "",
      ].join(" ").toLowerCase();

      return hay.includes(q);
    });

    const clientRefNumber = (value: string) => {
      const digits = (value || "").match(/\d+/g);
      return digits ? Number(digits.join("")) : 0;
    };

    list.sort((a, b) => {
      const nameA = ((a.type === "Business" ? (a.businessName || a.clientName) : a.clientName) || "").toLowerCase();
      const nameB = ((b.type === "Business" ? (b.businessName || b.clientName) : b.clientName) || "").toLowerCase();
      const projectA = (a.projectName || "").toLowerCase();
      const projectB = (b.projectName || "").toLowerCase();
      const refA = clientRefNumber(a.clientRef || "");
      const refB = clientRefNumber(b.clientRef || "");

      let result = 0;
      if (clientDbSortField === "client_number") result = refA - refB;
      else if (clientDbSortField === "project_name") result = projectA.localeCompare(projectB);
      else result = nameA.localeCompare(nameB);

      return clientDbSort === "asc" ? result : -result;
    });

    return list;
  }, [clients, clientDbSearch, clientDbFilter, clientDbSort, clientDbSortField]);
  const clientCollectionItems = useMemo(() => filteredClients.map((client) => buildClientCollectionItem(client)), [filteredClients]);

  function selectMenu(k: Models.MenuKey) {
    setTopShellPage("app");
    setMenu(k);
    setView("customers");
    setSelectedClientId(null);
    setSelectedEstimateId(null);
    setEstimatePickerClientId(null);
    estimatePickerRef.current?.clear();
    setShowAddClient(false);
  }

  function handleTopShellMenuClick(key: string) {
    if (key === "menu_5") {
      setTopShellPage("tools");
      return;
    }
    
if (key === "menu_5") {
      setTopShellPage("tools");
      return;
    }
    if (key === "client_portal") {
      setTopShellPage("client_portal");
      return;
    }
    if (key === "admin") {
      setTopShellPage("admin");
      return;
    }
    if (key === "window_types_render_preview") {
      setTopShellPage("window_types_render_preview");
      return;
    }
    if (key === "configurator_render") {
      setTopShellPage("configurator_render");
      return;
    }
    if (key === "b92_configurator") {
      setTopShellPage("b92_configurator");
      return;
    }
    if (key === "settings") {
      setTopShellPage("settings");
      return;
    }
    if (key === "help") {
      setTopShellPage("help");
      return;
    }
    setTopShellPage("app");
  }

function openEstimateDefaults(clientId: Models.ClientId, estimateId: Models.EstimateId) {
  setSelectedClientId(clientId);
  setSelectedEstimateId(estimateId);
  setView("estimate_workspace");
}

  
async function createEstimateForClient(client: Client) {
    const estimateDefaults = systemSettings.loadDefaults ? makeDefaultEstimateDefaults() : makeBlankEstimateDefaults();

    const est: Estimate = mergeEstimateLocationState({
      id: Models.asEstimateId(uid()),
      estimateRef: "",
      baseEstimateRef: "",
      revisionNo: 0,
      status: "Draft",
      createdByUserId: CURRENT_APP_USER.id,
      createdByName: CURRENT_APP_USER.name,
      createdByRole: CURRENT_APP_USER.role,
      estimatedOrderMonth: ORDER_MONTHS[new Date().getMonth()],
      estimatedOrderYear: new Date().getFullYear(),
      defaults: estimateDefaults,
      positions: [],
      projectAddress: "",
      projectAddressStructured: emptyAddress(),
      postcode: "",
      what3words: "",
      latitude: null,
      longitude: null,
    });

    try {
      const createdRow = await createEstimateAPI({
        ...buildDbEstimatePayload(client.id, est),
        estimate_ref: "",
        base_estimate_ref: "",
        revision_no: 0,
      });

      const createdEstimate = mapDbEstimateToEstimate(createdRow);

      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...c, estimates: [createdEstimate, ...c.estimates] } : c))
      );

      openEstimateDefaults(client.id, createdEstimate.id);
    } catch (error) {
      if (error instanceof ApiRequestError && error.isConflict) {
        console.error("Failed to create estimate: duplicate estimate reference", {
          status: error.status,
          path: error.path,
          body: error.body,
          message: error.message,
        });
        return;
      }

      console.error("Failed to create estimate", error);
    }
  }

  async function copyEstimateForClient(client: Client, sourceEstimateId: Models.EstimateId) {
    const sourceEstimate = client.estimates.find((e) => e.id === sourceEstimateId);
    if (!sourceEstimate) return;

    const copiedEstimate: Estimate = mergeEstimateLocationState({
      ...sourceEstimate,
      id: Models.asEstimateId(uid()),
      estimateRef: "",
      baseEstimateRef: "",
      revisionNo: 0,
      status: "Draft",
      createdByUserId: CURRENT_APP_USER.id,
      createdByName: CURRENT_APP_USER.name,
      createdByRole: CURRENT_APP_USER.role,
      defaults: { ...sourceEstimate.defaults },
      positions: (sourceEstimate.positions ?? []).map((p) => ({
        ...p,
        id: Models.asPositionId(uid()),
        cellInsertions: { ...(p.cellInsertions ?? {}) },
        overrides: { ...(p.overrides ?? {}) },
        colWidthsMm: p.colWidthsMm ? [...p.colWidthsMm] : undefined,
        rowHeightsMm: p.rowHeightsMm ? [...p.rowHeightsMm] : undefined,
      })),
    });

    try {
      const createdRow = await createEstimateAPI({
        ...buildDbEstimatePayload(client.id, copiedEstimate),
        estimate_ref: "",
        base_estimate_ref: "",
        revision_no: 0,
      });

      const createdEstimate = mapDbEstimateToEstimate(createdRow);

      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...c, estimates: [createdEstimate, ...c.estimates] } : c))
      );
    } catch (error) {
      if (error instanceof ApiRequestError && error.isConflict) {
        console.error("Failed to copy estimate: duplicate estimate reference", {
          status: error.status,
          path: error.path,
          body: error.body,
          message: error.message,
        });
        return;
      }

      console.error("Failed to copy estimate", error);
    }
  }
async function deleteEstimatesForClient(clientId: Models.ClientId, estimateIds: Models.EstimateId[]) {
  if (!estimateIds.length) return;

  try {
    await Promise.all(estimateIds.map((estimateId) => deleteEstimateAPI(estimateId)));

    if (selectedClientId === clientId && selectedEstimateId && estimateIds.includes(selectedEstimateId)) {
      setSelectedEstimateId(null);
    }

    await refreshClientsFromApi();
  } catch (error) {
    console.error("Failed to delete estimates", error);
  }
}

async function restoreDeletedEstimatesForClient(clientId: Models.ClientId, estimateIds: Models.EstimateId[]) {
  if (!estimateIds.length) return;

  try {
    await Promise.all(estimateIds.map((estimateId) => restoreEstimateAPI(estimateId)));
    await refreshClientsFromApi();
  } catch (error) {
    console.error("Failed to restore estimates", error);
  }
}

async function purgeDeletedEstimatesForClient(clientId: Models.ClientId, estimateIds?: Models.EstimateId[]) {
  const records = deletedEstimatesByClientId[clientId] ?? [];
  const idsToPurge = estimateIds?.length ? estimateIds : records.map((record) => record.estimate.id);
  if (!idsToPurge.length) return;

  try {
    await Promise.all(idsToPurge.map((estimateId) => purgeEstimateAPI(estimateId)));
    await refreshClientsFromApi();
  } catch (error) {
    console.error("Failed to purge estimates", error);
  }
}

async function deleteClientToRecycle(clientId: Models.ClientId) {
  try {
    await deleteClientAPI(clientId);

    if (selectedClientId === clientId) {
      setSelectedClientId(null);
      setSelectedEstimateId(null);
    }

    if (estimatePickerClientId === clientId) {
      setEstimatePickerClientId(null);
    }

    if (editingClientId === clientId) {
      setEditingClientId(null);
      setShowAddClient(false);
    }

    if (view === "estimate_defaults") {
      setView("customers");
    }

    await refreshClientsFromApi();
  } catch (error) {
    console.error("Failed to delete client", error);
  }
}

async function restoreDeletedClient(clientId: Models.ClientId) {
  try {
    await restoreClientAPI(clientId);
    await refreshClientsFromApi();
  } catch (error) {
    console.error("Failed to restore client", error);
  }
}

async function purgeDeletedClient(clientId: Models.ClientId) {
  try {
    await purgeClientAPI(clientId);
    await refreshClientsFromApi();
  } catch (error) {
    console.error("Failed to purge client", error);
  }
}

function setEstimateInstaller(clientId: Models.ClientId, estimateId: Models.EstimateId, installerId: string) {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        return {
          ...c,
          estimates: c.estimates.map((e) =>
            e.id !== estimateId
              ? e
              : {
                  ...e,
                  orderMeta: {
                    ...(e.orderMeta ?? {}),
                    timeline: e.orderMeta?.timeline ?? [],
                    installerId,
                  },
                }
          ),
        };
      })
    );
  }

  function updateEstimateOrderMeta(clientId: Models.ClientId, estimateId: Models.EstimateId, patch: Record<string, any>) {
    setClients((prev) => {
      let updatedEstimate: Estimate | null = null;

      const nextClients = prev.map((c) => {
        if (c.id !== clientId) return c;
        return {
          ...c,
          estimates: c.estimates.map((e) => {
            if (e.id !== estimateId) return e;

            const currentMeta = {
              timeline: e.orderMeta?.timeline ?? [],
              ...(e.orderMeta ?? {}),
            } as any;

            const nextMeta = {
              ...currentMeta,
              ...patch,
            };

            if (typeof nextMeta.productionWeeks === "number" && nextMeta.productionStartDate) {
              const start = new Date(nextMeta.productionStartDate + "T00:00:00");
              if (!Number.isNaN(start.getTime())) {
                const end = new Date(start);
                end.setDate(end.getDate() + (nextMeta.productionWeeks * 7));
                nextMeta.productionEndDate = end.toISOString().slice(0, 10);

                const due = new Date(end);
                due.setDate(due.getDate() - 14);
                nextMeta.balanceInvoiceDueDate = due.toISOString().slice(0, 10);
              }
            }

            updatedEstimate = {
              ...e,
              orderMeta: nextMeta,
            };

            return updatedEstimate;
          }),
        };
      });

      if (updatedEstimate) {
        updateEstimateAPI(estimateId, buildDbEstimatePayload(clientId, updatedEstimate)).catch((error) => {
          console.error("Failed to update estimate order meta", error);
        });
      }

      return nextClients;
    });
  }


  function updateEstimatePosition(
    clientId: Models.ClientId,
    estimateId: Models.EstimateId,
    positionId: string,
    patch: {
      positionRef?: string;
      roomName?: string;
      qty?: number;
      itemPrice?: number;
      widthMm?: number;
      heightMm?: number;
      insertion?: string;
      positionType?: "Window" | "Door";
    }
  ) {
    setClients((prev) => {
      let updatedEstimate: Estimate | null = null;

      const nextClients = prev.map((c) => {
        if (c.id !== clientId) return c;
        return {
          ...c,
          estimates: c.estimates.map((e) => {
            if (e.id !== estimateId) return e;

            updatedEstimate = {
              ...e,
              positions: e.positions.map((p) => {
                if (p.id !== positionId) return p;
                const nextQty = patch.qty == null ? p.qty : Math.max(1, Math.round(patch.qty));
                const nextWidth = patch.widthMm == null ? p.widthMm : clampNum(Math.round(patch.widthMm), 300, 6000);
                const nextHeight = patch.heightMm == null ? p.heightMm : clampNum(Math.round(patch.heightMm), 300, 6000);
                return {
                  ...p,
                  ...patch,
                  qty: nextQty,
                  widthMm: nextWidth,
                  heightMm: nextHeight,
                };
              }),
            };

            return updatedEstimate;
          }),
        };
      });

      if (updatedEstimate) {
        updateEstimateAPI(estimateId, buildDbEstimatePayload(clientId, updatedEstimate)).catch((error) => {
          console.error("Failed to update estimate position", error);
        });
      }

      return nextClients;
    });
  }

  function estimateCommercialTotals(est: Estimate | null) {
    const positions = est?.positions ?? [];
    const totalSquareMetres = positions.reduce((sum, p) => sum + ((Number(p.widthMm || 0) * Number(p.heightMm || 0)) / 1000000) * Math.max(1, Number(p.qty || 1)), 0);
    const totalLinearMetres = positions.reduce((sum, p) => sum + (((2 * Number(p.widthMm || 0)) + (2 * Number(p.heightMm || 0))) / 1000) * Math.max(1, Number(p.qty || 1)), 0);
    const totalQty = positions.reduce((sum, p) => sum + Math.max(1, Number(p.qty || 1)), 0);
    const estimateTotal = positions.reduce((sum, p) => sum + (Number(p.itemPrice || 0) * Math.max(1, Number(p.qty || 1))), 0);
    return { totalSquareMetres, totalLinearMetres, totalQty, estimateTotal };
  }

  function formatMoney(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

  function formatMeasure(n: number) {
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  }

  const activeUserName = CURRENT_APP_USER.name;

  async function apiFetchJson(path: string, options?: RequestInit) {
    return apiFetch(path, options);
  }

  function positionDescription(p: Client["estimates"][number]["positions"][number]) {
    return positionDescriptionForDisplay(p);
  }

  function PositionPreview({ position }: { position: Client["estimates"][number]["positions"][number] }) {
    const contract = getConfiguredPositionContract(position);
    return (
      <div style={{ width: 48, height: 54, borderRadius: 12, border: "1px solid #d4d4d8", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: position.positionType === "Door" ? 18 : 28, height: 38, borderRadius: 3, border: "2px solid #52525b", position: "relative", background: "#fff" }}>
          <div style={{ position: "absolute", inset: 4, border: "1px solid #a1a1aa", borderRadius: 2 }} />
          {contract ? <div style={{ position: "absolute", left: -4, right: -4, bottom: -14, fontSize: 8, fontWeight: 800, textAlign: "center", color: "#2563eb" }}>B92</div> : null}
        </div>
      </div>
    );
  }

  function stageDateValue(e: any, stage: string): string {
    const meta = e.orderMeta ?? {};
    if (stage === "signoff_sent") return meta.clientSignoffSentDate ?? "";
    if (stage === "signoff_received") return meta.clientSignoffReceivedDate ?? "";
    if (stage === "factory_order") return meta.factoryOrderSignedOffDate ?? "";
    if (stage === "in_production") return meta.productionStartDate ?? "";
    if (stage === "pre_dispatch_invoice") return meta.balanceInvoiceDueDate ?? "";
    if (stage === "production_complete") return meta.productionCompletedDate ?? meta.productionEndDate ?? "";
    if (stage === "factory_dispatch") return meta.factoryDispatchDate ?? "";
    if (stage === "delivery") return meta.deliveryDate ?? "";
    if (stage === "installation") return meta.installationDate ?? "";
    return "";
  }

  function timelineWithCompletion(e: any) {
    const base = e.orderMeta?.timeline ?? [];
    return base.map((t: any) => ({
      ...t,
      completed: !!stageDateValue(e, t.stage),
    }));
  }

  function openClient(client: Client) {
  setSelectedClientId(client.id);

  // Store the selected client in App state first, then switch view.
  // (Fixes blank screen: ref isn''t mounted yet when called from Customers list)
  setEstimatePickerClientId(client.id);
  setView("estimate_picker");
}

  function setEstimateDefaults(next: EstimateDefaults) {
    if (!selectedClient || !selectedEstimate) return;
    setClients((prev) => {
      let updatedEstimate: Estimate | null = null;

      const nextClients = prev.map((c) => {
        if (c.id !== selectedClient.id) return c;
        return {
          ...c,
          estimates: c.estimates.map((e) => {
            if (e.id !== selectedEstimate.id) return e;
            updatedEstimate = { ...e, defaults: next };
            return updatedEstimate;
          }),
        };
      });

      if (updatedEstimate) {
        updateEstimateAPI(selectedEstimate.id, buildDbEstimatePayload(selectedClient.id, updatedEstimate)).catch((error) => {
          console.error("Failed to update estimate defaults", error);
        });
      }

      return nextClients;
    });
  }

  function setEstimateForecast(next: { estimatedOrderMonth?: string; estimatedOrderYear?: number }) {
    if (!selectedClient || !selectedEstimate) return;
    setClients((prev) => {
      let updatedEstimate: Estimate | null = null;

      const nextClients = prev.map((c) => {
        if (c.id !== selectedClient.id) return c;
        return {
          ...c,
          estimates: c.estimates.map((e) => {
            if (e.id !== selectedEstimate.id) return e;
            updatedEstimate = {
              ...e,
              estimatedOrderMonth: next.estimatedOrderMonth ?? e.estimatedOrderMonth,
              estimatedOrderYear: next.estimatedOrderYear ?? e.estimatedOrderYear,
            };
            return updatedEstimate;
          }),
        };
      });

      if (updatedEstimate) {
        updateEstimateAPI(selectedEstimate.id, buildDbEstimatePayload(selectedClient.id, updatedEstimate)).catch((error) => {
          console.error("Failed to update estimate forecast", error);
        });
      }

      return nextClients;
    });
  }

  function resetClientDraftForm() {
    setEditingClientId(null);
    setDraftClientType("Individual");
    setDraftClientName("");
    setDraftBusinessName("");
    setDraftContactName("");
    setDraftWhat3Words("");
    setDraftEmail("");
    setDraftMobile("");
    setDraftHome("");
    setDraftProjectName("");
    setDraftCustAddress1("");
    setDraftCustAddress2("");
    setDraftCustAddress3("");
    setDraftCustTown("");
    setDraftCustCity("");
    setDraftCustCounty("");
    setDraftCustPostcode("");
    setDraftProjAddress1("");
    setDraftProjAddress2("");
    setDraftProjAddress3("");
    setDraftProjTown("");
    setDraftProjCity("");
    setDraftProjCounty("");
    setDraftProjPostcode("");
    setInvoiceAddressMode("customer");
    setDraftInvAddress1("");
    setDraftInvAddress2("");
    setDraftInvAddress3("");
    setDraftInvTown("");
    setDraftInvCity("");
    setDraftInvCounty("");
    setDraftInvPostcode("");
    setCustomerAddressSectionOpen(false);
    setInvoiceAddressSectionOpen(false);
  }

  function closeAddClientPanel() {
    setShowAddClient(false);
    setEditingClientId(null);
    setResumeEstimateCreationAfterClientCreate(false);
  }

  function closeAddEstimateModal() {
    setShowAddEstimateModal(false);
    setCreateEstimateSubmitting(false);
    if (clients.length > 0) {
      setCreateEstimateClientId((prev) => (prev && clients.some((client) => client.id === prev) ? prev : clients[0].id));
    } else {
      setCreateEstimateClientId("");
    }
    setResumeEstimateCreationAfterClientCreate(false);
  }

  async function createClient(type: ClientType) {
    if (clientSaving) return null;

    const customerAddressStructured: Address = {
      line1: draftCustAddress1.trim(),
      line2: draftCustAddress2.trim(),
      line3: draftCustAddress3.trim(),
      town: draftCustTown.trim(),
      city: draftCustCity.trim(),
      county: draftCustCounty.trim(),
      postcode: draftCustPostcode.trim(),
    };

    const customInvoiceAddressStructured: Address = {
      line1: draftInvAddress1.trim(),
      line2: draftInvAddress2.trim(),
      line3: draftInvAddress3.trim(),
      town: draftInvTown.trim(),
      city: draftInvCity.trim(),
      county: draftInvCounty.trim(),
      postcode: draftInvPostcode.trim(),
    };

    const customerAddress = buildAddressString(customerAddressStructured) || DEFAULT_CUSTOMER_ADDRESS;

    const invoiceAddressStructured =
      invoiceAddressMode === "customer"
        ? { ...customerAddressStructured }
        : { ...customInvoiceAddressStructured };

    const invoiceAddress = buildAddressString(invoiceAddressStructured) || customerAddress;

    const projectAddress = "";
    const projectAddressStructured = resolveStructuredAddress(undefined, projectAddress);

    const businessName = draftBusinessName.trim();
    const contactPerson = draftContactName.trim();
    const clientName = type === "Business" ? businessName || "Business" : draftClientName.trim() || "Client";

    const newClient: Client = {
      id: Models.asClientId(uid()),
      type,
      clientRef: nextClientRef(clientCounter),
      clientName,
      email: draftEmail.trim(),
      mobile: draftMobile.trim(),
      home: draftHome.trim(),
      projectName: draftProjectName.trim(),
      what3words: draftWhat3Words.trim(),
      customerAddress,
      projectAddress,
      invoiceAddress,
      customerAddressStructured: resolveStructuredAddress(customerAddressStructured, customerAddress),
      projectAddressStructured,
      invoiceAddressStructured: resolveStructuredAddress(invoiceAddressStructured, invoiceAddress),
      postcode: extractPostcodeFromAddress(projectAddress),
      businessName: type === "Business" ? businessName : undefined,
      contactPerson: type === "Business" ? contactPerson : undefined,
      estimates: [],
    };

    setClientSaving(true);
    try {
      await apiFetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDbClientPayload(newClient)),
      });

      setClients((prev) => [newClient, ...prev]);
      setClientCounter((n) => n + 1);
      setClientDbSearch("");
      setClientsLoaded(true);
      setShowAddClient(false);
      resetClientDraftForm();

      if (resumeEstimateCreationAfterClientCreate) {
        setCreateEstimateClientId(newClient.id);
        setShowAddEstimateModal(true);
        setResumeEstimateCreationAfterClientCreate(false);
      }

      return newClient;
    } catch (error) {
      if (error instanceof ApiRequestError) {
        console.error("Failed to create client", {
          status: error.status,
          path: error.path,
          body: error.body,
          message: error.message,
        });
      } else {
        console.error("Failed to create client", error);
      }

      return null;
    } finally {
      setClientSaving(false);
    }
  }


  function openAddClientPanel() {
    resetClientDraftForm();
    setShowAddClient(true);
  }

  function openAddEstimateModal(preselectedClientId?: Models.ClientId | null) {
    if (clients.length > 0) {
      const nextClientId =
        preselectedClientId && clients.some((client) => client.id === preselectedClientId)
          ? preselectedClientId
          : clients[0]?.id ?? "";
      setCreateEstimateClientId(nextClientId);
    } else {
      setCreateEstimateClientId("");
    }
    setShowAddEstimateModal(true);
  }

  function openAddClientThenEstimateFlow() {
    setShowAddEstimateModal(false);
    setResumeEstimateCreationAfterClientCreate(true);
    openAddClientPanel();
  }

  async function handleCreateEstimateFromModal() {
    if (createEstimateSubmitting) return;

    const selectedModalClient = clients.find((client) => client.id === createEstimateClientId) ?? null;
    if (!selectedModalClient) return;

    setCreateEstimateSubmitting(true);
    try {
      setShowAddEstimateModal(false);
      setResumeEstimateCreationAfterClientCreate(false);
      await createEstimateForClient(selectedModalClient);
    } finally {
      setCreateEstimateSubmitting(false);
    }
  }

  const selectedCreateEstimateClient = clients.find((client) => client.id === createEstimateClientId) ?? null;


  const globalEstimateRows = useMemo(() => {
    return clients.flatMap((client) =>
      client.estimates.map((estimate) => {
        const outcome = ((estimate as any).outcome ?? "Open") as Models.EstimateOutcome;
        const installerId = estimate.orderMeta?.installerId;
        return {
          client,
          estimate,
          outcome,
          installerId,
        };
      })
    );
  }, [clients]);

  function clientRefNumber(value: string) {
    const digits = (value || "").match(/\d+/g);
    return digits ? Number(digits.join("")) : 0;
  }

  function clientDisplayName(client: Client) {
    return client.type === "Business" ? (client.businessName || client.clientName) : client.clientName;
  }

  function matchesGlobalStatus(
    row: { client: Client; estimate: Estimate; outcome: Models.EstimateOutcome; installerId?: string },
    menuKey: "estimates" | "orders" | "lost" | "installation"
  ) {
    if (menuKey === "estimates") return row.outcome === "Open";
    if (menuKey === "orders") return row.outcome === "Order";
    if (menuKey === "lost") return row.outcome === "Lost";
    if (menuKey === "installation") return row.outcome === "Order" && !!row.installerId;
    return false;
  }

  function filteredGlobalRows(menuKey: GlobalEstimateMenuKey) {
    const q = globalSearch.trim().toLowerCase();
    const activeGlobalSortDirection =
      menuKey === "estimates" || menuKey === "orders" || menuKey === "lost"
        ? globalSortDirectionByMenu[menuKey]
        : globalSort;

    const rows = globalEstimateRows.filter((row) => {
      if (!matchesGlobalStatus(row, menuKey)) return false;
      if (menuKey !== "installation" && globalCreatorFilterByMenu[menuKey] === "mine") {
        const creatorId = String(row.estimate.createdByUserId || CURRENT_APP_USER.id);
        if (creatorId !== CURRENT_APP_USER.id) return false;
      }
      if (globalMonthFilter !== "All" && row.estimate.estimatedOrderMonth !== globalMonthFilter) return false;
      if (!q) return true;

      const totals = estimateCommercialTotals(row.estimate);
      const hay = [
        clientDisplayName(row.client),
        row.client.clientRef || "",
        row.client.projectName || "",
        row.client.mobile || "",
        row.client.home || "",
        row.estimate.estimateRef || "",
        row.estimate.estimatedOrderMonth || "",
        row.estimate.estimatedOrderYear ? String(row.estimate.estimatedOrderYear) : "",
        formatMoney(totals.estimateTotal),
      ].join(" ").toLowerCase();

      return hay.includes(q);
    });

    rows.sort((a, b) => {
      const totalsA = estimateCommercialTotals(a.estimate);
      const totalsB = estimateCommercialTotals(b.estimate);

      let result = 0;
      if (globalSortField === "client_number") {
        result = clientRefNumber(a.client.clientRef || "") - clientRefNumber(b.client.clientRef || "");
      } else if (globalSortField === "project_name") {
        result = (a.client.projectName || "").localeCompare(b.client.projectName || "", undefined, { sensitivity: "base" });
      } else if (globalSortField === "total_cost") {
        result = totalsA.estimateTotal - totalsB.estimateTotal;
      } else {
        result = clientDisplayName(a.client).localeCompare(clientDisplayName(b.client), undefined, { sensitivity: "base" });
      }

      return activeGlobalSortDirection === "asc" ? result : -result;
    });

    return rows;
  }

  function globalEstimateRowById(estimateId: Models.EstimateId | string | null) {
    if (!estimateId) return null;
    return globalEstimateRows.find((row) => row.estimate.id === estimateId) ?? null;
  }

  function globalClientForEstimate(estimateId: Models.EstimateId) {
    const row = globalEstimateRowById(estimateId);
    if (!row) {
      throw new Error(`Missing global client context for estimate ${estimateId}`);
    }
    return row.client;
  }

  async function openGlobalInstallations(e: any, _pickerClient: any) {
    setGlobalSelectedOrderForInstallations(e.id);

    const settings = loadSettings();
    const installers = getInstallers();

    const projectAddressText = String(e.projectAddress || "");
    const postcodeMatch = projectAddressText.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
    const sitePostcode = String(e.postcode || (postcodeMatch ? postcodeMatch[0] : ""));

    const provider = settings.mapsProvider === "none" ? "manual" : settings.mapsProvider;
    const apiKey =
      settings.mapsProvider === "google"
        ? settings.googleMapsApiKey
        : settings.mapsProvider === "azure"
          ? settings.azureMapsApiKey
          : "";

    const results = await rankInstallersByDistance({
      sitePostcode,
      installers,
      provider,
      apiKey,
    });

    setGlobalRankedInstallers(results);
  }

  function globalInstallerLabel(installerId: string) {
    const installer = getInstallers().find((x) => x.id === installerId);
    return installer?.companyName ?? installerId;
  }

  function selectGlobalInstallerForEstimate(estimateId: Models.EstimateId, installerId: string) {
    setGlobalSelectedInstallerByEstimateId((prev) => ({
      ...prev,
      [estimateId]: installerId,
    }));
    setEstimateInstaller(globalClientForEstimate(estimateId).id, estimateId, installerId);
  }

  function setGlobalOrderMetaField(estimateId: Models.EstimateId, key: string, value: any) {
    updateEstimateOrderMeta(globalClientForEstimate(estimateId).id, estimateId, { [key]: value });
  }

  function importGlobalSupplierEstimate(estimateId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp";
    input.onchange = () => {
      const names = Array.from(input.files ?? []).map((file) => file.name);
      if (!names.length) return;
      setGlobalSupplierEstimateFilesByEstimateId((prev) => ({
        ...prev,
        [estimateId]: [...(prev[estimateId] ?? []), ...names],
      }));
    };
    input.click();
  }

  function confirmDeleteGlobalEstimate(estimateId: Models.EstimateId) {
    const row = globalEstimateRowById(estimateId);
    if (!row) return;
    const ok = window.confirm(`Send estimate ${row.estimate.estimateRef} to recycle bin?`);
    if (!ok) return;
    if (globalExpandedEstimateId === estimateId) {
      setGlobalExpandedEstimateId(null);
    }
    deleteEstimatesForClient(row.client.id, [estimateId]);
  }

  function openEstimateFromGlobalCollection(estimateId: Models.EstimateId) {
    const row = globalEstimateRowById(estimateId);
    if (!row) return;
    openEstimateFromGlobalMenu(row.client.id, estimateId);
  }

  const installationRowsForBoard = useMemo(() => filteredGlobalRows("installation"), [globalEstimateRows, globalSearch, globalSort, globalSortField, globalMonthFilter, globalCreatorFilterByMenu, globalSortDirectionByMenu]);

  const estimateMapRowsForBoard = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();

    const rows = globalEstimateRows.filter((row) => {
      if (row.outcome !== "Open") return false;
      if (globalMonthFilter !== "All" && row.estimate.estimatedOrderMonth !== globalMonthFilter) return false;
      if (!q) return true;

      const totals = estimateCommercialTotals(row.estimate);
      const hay = [
        clientDisplayName(row.client),
        row.client.clientRef || "",
        row.client.projectName || "",
        row.client.mobile || "",
        row.client.home || "",
        row.estimate.postcode || "",
        row.estimate.what3words || "",
        row.estimate.projectAddress || "",
        row.estimate.estimateRef || "",
        row.estimate.estimatedOrderMonth || "",
        row.estimate.estimatedOrderYear ? String(row.estimate.estimatedOrderYear) : "",
        formatMoney(totals.estimateTotal),
      ].join(" ").toLowerCase();

      return hay.includes(q);
    });

    rows.sort((a, b) => {
      const totalsA = estimateCommercialTotals(a.estimate);
      const totalsB = estimateCommercialTotals(b.estimate);

      let result = 0;
      if (globalSortField === "client_number") {
        result = clientRefNumber(a.client.clientRef || "") - clientRefNumber(b.client.clientRef || "");
      } else if (globalSortField === "project_name") {
        result = (a.client.projectName || "").localeCompare(b.client.projectName || "", undefined, { sensitivity: "base" });
      } else if (globalSortField === "total_cost") {
        result = totalsA.estimateTotal - totalsB.estimateTotal;
      } else {
        result = clientDisplayName(a.client).localeCompare(clientDisplayName(b.client), undefined, { sensitivity: "base" });
      }

      return globalSort === "asc" ? result : -result;
    });

    return rows;
  }, [globalEstimateRows, globalSearch, globalSort, globalSortField, globalMonthFilter, globalCreatorFilterByMenu]);

  useEffect(() => {
    setGlobalExpandedEstimateId(null);
  }, [globalCreatorFilterByMenu]);

  function persistResolvedEstimateCoordinates(
    clientId: Models.ClientId,
    estimate: Estimate,
    resolved: ResolvedClientLocation
  ) {
    if (resolved.source === "estimate" || resolved.source === "cache") return;

    const currentLat = estimate.latitude == null || !Number.isFinite(Number(estimate.latitude)) ? null : Number(estimate.latitude);
    const currentLng = estimate.longitude == null || !Number.isFinite(Number(estimate.longitude)) ? null : Number(estimate.longitude);

    if (currentLat === resolved.lat && currentLng === resolved.lng) return;
    if (pendingResolvedCoordinatePersistsRef.current[estimate.id]) return;

    pendingResolvedCoordinatePersistsRef.current[estimate.id] = true;

    const updatedEstimate: Estimate = mergeEstimateLocationState({
      ...estimate,
      latitude: resolved.lat,
      longitude: resolved.lng,
    });

    setClients((prev) =>
      prev.map((client) =>
        client.id !== clientId
          ? client
          : {
              ...client,
              estimates: client.estimates.map((item) => (item.id !== estimate.id ? item : updatedEstimate)),
            }
      )
    );

    updateEstimateAPI(estimate.id, buildDbEstimatePayload(clientId, updatedEstimate))
      .catch((error) => {
        console.error("Failed to persist resolved estimate coordinates", error);
      })
      .finally(() => {
        delete pendingResolvedCoordinatePersistsRef.current[estimate.id];
      });
  }

  useEffect(() => {
    if (!googleMapsApiKey || !mapsApiReady) return;

    const sourceRows = [...installationRowsForBoard, ...estimateMapRowsForBoard];

    let cancelled = false;

    async function loadResolvedLocations() {
      const nextEntries = await Promise.all(
        sourceRows.map(async ({ client, estimate }) => {
          if (resolvedLocationsByClientId[estimate.id] && resolvedLocationsByClientId[estimate.id] !== null) {
            return null;
          }

          try {
            const resolved = await resolveEstimateLocation(estimate, client, { googleMapsApiKey, what3wordsApiKey });
            if (resolved) {
              persistResolvedEstimateCoordinates(client.id, estimate, resolved);
            }
            return [estimate.id, resolved] as const;
          } catch (error) {
            console.error("Location resolution failed", estimate.id, error);
            return [estimate.id, null] as const;
          }
        })
      );

      if (cancelled) return;

      setResolvedLocationsByClientId((prev) => {
        const next = { ...prev };
        let changed = false;

        nextEntries.forEach((entry) => {
          if (!entry) return;
          const [estimateId, resolved] = entry;
          const current = prev[estimateId];
          const shouldWrite =
            resolved
              ? !current || current.lat !== resolved.lat || current.lng !== resolved.lng || current.label !== resolved.label
              : current === undefined;

          if (shouldWrite) {
            next[estimateId] = resolved;
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    }

    loadResolvedLocations();

    return () => {
      cancelled = true;
    };
  }, [googleMapsApiKey, what3wordsApiKey, installationRowsForBoard, estimateMapRowsForBoard, mapsApiReady]);

  useEffect(() => {
    setSelectedMapEstimateId(null);
  }, [menu]);

  function globalSummaryForRows(rows: ReturnType<typeof filteredGlobalRows>) {
    return rows.reduce(
      (acc, row) => {
        const totals = estimateCommercialTotals(row.estimate);
        acc.count += 1;
        acc.totalSquareMetres += totals.totalSquareMetres;
        acc.totalLinearMetres += totals.totalLinearMetres;
        acc.totalQty += totals.totalQty;
        acc.totalCost += totals.estimateTotal;
        return acc;
      },
      { count: 0, totalSquareMetres: 0, totalLinearMetres: 0, totalQty: 0, totalCost: 0 }
    );
  }

  function toggleGlobalSelectMode(menuKey: "estimates" | "orders" | "lost") {
    setGlobalSelectModeByMenu((prev) => {
      const enabled = !prev[menuKey];
      return { ...prev, [menuKey]: enabled };
    });
    setGlobalSelectedEstimateIdsByMenu((prev) => ({
      ...prev,
      [menuKey]: {},
    }));
  }

  function toggleGlobalEstimateSelection(menuKey: "estimates" | "orders" | "lost", estimateId: Models.EstimateId, checked: boolean) {
    setGlobalSelectedEstimateIdsByMenu((prev) => ({
      ...prev,
      [menuKey]: {
        ...(prev[menuKey] ?? {}),
        [estimateId]: checked,
      },
    }));
  }

  function deleteSelectedGlobalEstimates(menuKey: "estimates" | "orders" | "lost") {
    const selectedMap = globalSelectedEstimateIdsByMenu[menuKey] ?? {};
    const rows = filteredGlobalRows(menuKey).filter((row) => !!selectedMap[row.estimate.id]);

    const idsByClient = rows.reduce((acc, row) => {
      const key = row.client.id;
      acc[key] = [...(acc[key] ?? []), row.estimate.id];
      return acc;
    }, {} as Record<string, Models.EstimateId[]>);

    Object.entries(idsByClient).forEach(([clientId, ids]) => {
      deleteEstimatesForClient(clientId as Models.ClientId, ids);
    });

    setGlobalSelectedEstimateIdsByMenu((prev) => ({
      ...prev,
      [menuKey]: {},
    }));
    setGlobalSelectModeByMenu((prev) => ({
      ...prev,
      [menuKey]: false,
    }));
  }

  const recycleClientRows = useMemo(() => {
    return Object.entries(deletedClientsById).map(([clientId, record]) => ({
      clientId: clientId as Models.ClientId,
      client: record.client,
      deletedAt: record.deletedAt,
      deletedEstimateCount: record.deletedEstimates?.length ?? 0,
    }));
  }, [deletedClientsById]);

  const recycleEstimateRows = useMemo(() => {
    return Object.entries(deletedEstimatesByClientId).flatMap(([clientId, records]) => {
      const activeClient = clients.find((c) => c.id === clientId) ?? null;

      return records.map((record) => ({
        clientId: clientId as Models.ClientId,
        client: activeClient,
        estimate: record.estimate,
        deletedAt: record.deletedAt,
        selectionKey: `${clientId}::${record.estimate.id}`,
      }));
    });
  }, [clients, deletedEstimatesByClientId]);

  function renderRecycleBinMenu() {
    const showClients = recycleBinFilter === "all" || recycleBinFilter === "clients";
    const showEstimates = recycleBinFilter === "all" || recycleBinFilter === "estimates";
    const selectedClientIds = Object.entries(selectedRecycleClientIds).filter(([, checked]) => !!checked).map(([clientId]) => clientId as Models.ClientId);
    const selectedEstimateRows = recycleEstimateRows.filter((row) => !!selectedRecycleEstimateKeys[row.selectionKey]);
    const hasSelection = selectedClientIds.length > 0 || selectedEstimateRows.length > 0;

    function clearRecycleSelection() {
      setSelectedRecycleClientIds({});
      setSelectedRecycleEstimateKeys({});
    }

    function restoreSelectedRecycleItems() {
      selectedClientIds.forEach((clientId) => restoreDeletedClient(clientId));
      selectedEstimateRows.forEach((row) => restoreDeletedEstimatesForClient(row.clientId, [row.estimate.id]));
      clearRecycleSelection();
    }

    function purgeSelectedRecycleItems() {
      selectedClientIds.forEach((clientId) => purgeDeletedClient(clientId));
      selectedEstimateRows.forEach((row) => purgeDeletedEstimatesForClient(row.clientId, [row.estimate.id]));
      clearRecycleSelection();
    }

    function toggleRecycleClientSelection(clientId: Models.ClientId, checked: boolean) {
      setSelectedRecycleClientIds((prev) => ({ ...prev, [clientId]: checked }));
    }

    function toggleRecycleEstimateSelection(selectionKey: string, checked: boolean) {
      setSelectedRecycleEstimateKeys((prev) => ({ ...prev, [selectionKey]: checked }));
    }

    const totalVisibleCount =
      (showClients ? recycleClientRows.length : 0) +
      (showEstimates ? recycleEstimateRows.length : 0);

    const filterButtons: Array<{ key: "all" | "clients" | "estimates"; label: string }> = [
      { key: "all", label: "All" },
      { key: "clients", label: "Clients" },
      { key: "estimates", label: "Estimates" },
    ];

    const viewButtons: Array<{ key: "grid" | "list"; label: string }> = [
      { key: "grid", label: "Grid View" },
      { key: "list", label: "List View" },
    ];

    function renderClientCards() {
      return recycleClientRows.map(({ clientId, client, deletedAt, deletedEstimateCount }) => (
        <div
          key={`client_${clientId}`}
          className="operational-card"
          style={{
            padding: 14,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div className="operational-eyebrow">Client</div>
              <div className="operational-title" style={{ fontSize: 16, fontWeight: 900 }}>{clientDisplayName(client)}</div>
              <Small>{client.clientRef} • {client.type}</Small>
            </div>
            <input
              type="checkbox"
              checked={!!selectedRecycleClientIds[clientId]}
              onChange={(ev) => toggleRecycleClientSelection(clientId, ev.currentTarget.checked)}
            />
          </div>

          <div style={{ display: "grid", gap: 4 }}>
            <Small>Project: {client.projectName || "Not set"}</Small>
            <Small>Active estimates on client record: {client.estimates.length}</Small>
            <Small>Previously deleted estimates linked to this client: {deletedEstimateCount}</Small>
            <Small>Deleted: {new Date(deletedAt).toLocaleString()}</Small>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={() => restoreDeletedClient(clientId)}>Restore Client</Button>
            <Button variant="secondary" onClick={() => purgeDeletedClient(clientId)}>Delete Permanently</Button>
          </div>
        </div>
      ));
    }

    function renderEstimateCards() {
      return recycleEstimateRows.map(({ clientId, client, estimate, deletedAt, selectionKey }) => (
        <div
          key={`estimate_${selectionKey}`}
          className="operational-card"
          style={{
            padding: 14,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div className="operational-eyebrow">Estimate</div>
              <div className="operational-title" style={{ fontSize: 16, fontWeight: 900 }}>{estimate.estimateRef}</div>
              <Small>{client ? `${clientDisplayName(client)} • ${client.clientRef}` : "Client removed from active list"}</Small>
            </div>
            <input
              type="checkbox"
              checked={!!selectedRecycleEstimateKeys[selectionKey]}
              onChange={(ev) => toggleRecycleEstimateSelection(selectionKey, ev.currentTarget.checked)}
            />
          </div>

          <div style={{ display: "grid", gap: 4 }}>
            <Small>Status: {(estimate as any).outcome ?? "Open"}</Small>
            <Small>Forecast: {monthYearLabel(estimate.estimatedOrderMonth || "", estimate.estimatedOrderYear || 0)}</Small>
            <Small>Deleted: {new Date(deletedAt).toLocaleString()}</Small>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={() => restoreDeletedEstimatesForClient(clientId, [estimate.id])}>Restore Estimate</Button>
            <Button variant="secondary" onClick={() => purgeDeletedEstimatesForClient(clientId, [estimate.id])}>Delete Permanently</Button>
          </div>
        </div>
      ));
    }

    function renderListTables() {
      return (
        <div style={{ display: "grid", gap: 12 }}>
          {showClients && (
            <div className="operational-table-shell">
              <div className="operational-table-section-header" style={{ padding: 12 }}>
                <H3>Deleted Clients</H3>
              </div>
              <div style={{ overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
                  <thead>
                    <tr className="operational-table-header">
                      {["", "Client Name", "Client Number", "Project Name", "Deleted", "Restore", "Delete Permanently"].map((label, index) => (
                        <th
                          key={label}
                          style={{
                            textAlign: index >= 5 ? "right" : "left",
                            padding: 10,
                            fontSize: 12,
                            borderBottom: "1px solid var(--color-border)",
                            position: "sticky",
                            top: 0,
                            zIndex: 2,
                            background: "var(--color-surface-subtle)",
                          }}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recycleClientRows.map(({ clientId, client, deletedAt }) => (
                      <tr key={`client_row_${clientId}`}>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top" }}>
                          <input
                            type="checkbox"
                            checked={!!selectedRecycleClientIds[clientId]}
                            onChange={(ev) => toggleRecycleClientSelection(clientId, ev.currentTarget.checked)}
                          />
                        </td>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top", fontWeight: 700 }}>{clientDisplayName(client)}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top" }}>{client.clientRef}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top" }}>{client.projectName || ""}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top" }}>{new Date(deletedAt).toLocaleString()}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top", textAlign: "right" }}>
                          <Button variant="secondary" onClick={() => restoreDeletedClient(clientId)}>Restore</Button>
                        </td>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top", textAlign: "right" }}>
                          <Button variant="secondary" onClick={() => purgeDeletedClient(clientId)}>Delete Permanently</Button>
                        </td>
                      </tr>
                    ))}
                    {recycleClientRows.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: 16 }}>
                          <Small>No deleted clients.</Small>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showEstimates && (
            <div className="operational-table-shell">
              <div className="operational-table-section-header" style={{ padding: 12 }}>
                <H3>Deleted Estimates</H3>
              </div>
              <div style={{ overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
                  <thead>
                    <tr className="operational-table-header">
                      {["", "Client Name", "Client Number", "Estimate Ref", "Project Name", "Deleted", "Restore", "Delete Permanently"].map((label, index) => (
                        <th
                          key={label}
                          style={{
                            textAlign: index >= 6 ? "right" : "left",
                            padding: 10,
                            fontSize: 12,
                            borderBottom: "1px solid var(--color-border)",
                            position: "sticky",
                            top: 0,
                            zIndex: 2,
                            background: "var(--color-surface-subtle)",
                          }}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recycleEstimateRows.map(({ clientId, client, estimate, deletedAt, selectionKey }) => (
                      <tr key={`estimate_row_${selectionKey}`}>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top" }}>
                          <input
                            type="checkbox"
                            checked={!!selectedRecycleEstimateKeys[selectionKey]}
                            onChange={(ev) => toggleRecycleEstimateSelection(selectionKey, ev.currentTarget.checked)}
                          />
                        </td>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top", fontWeight: 700 }}>{client ? clientDisplayName(client) : "Unknown client"}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top" }}>{client?.clientRef || ""}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top" }}>{estimate.estimateRef}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top" }}>{client?.projectName || ""}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top" }}>{new Date(deletedAt).toLocaleString()}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top", textAlign: "right" }}>
                          <Button variant="secondary" onClick={() => restoreDeletedEstimatesForClient(clientId, [estimate.id])}>Restore</Button>
                        </td>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top", textAlign: "right" }}>
                          <Button variant="secondary" onClick={() => purgeDeletedEstimatesForClient(clientId, [estimate.id])}>Delete Permanently</Button>
                        </td>
                      </tr>
                    ))}
                    {recycleEstimateRows.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ padding: 16 }}>
                          <Small>No deleted estimates.</Small>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <Card style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "grid", gap: 12, minHeight: 0, gridTemplateRows: "auto auto auto 1fr" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <H2>Recycle Bin</H2>
              <Small>Deleted clients and estimates are held here for up to 30 days unless purged sooner.</Small>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={restoreSelectedRecycleItems} disabled={!hasSelection}>Restore Selected</Button>
              <Button variant="secondary" onClick={purgeSelectedRecycleItems} disabled={!hasSelection}>Delete Selected</Button>
              <Button variant="secondary" onClick={clearRecycleSelection} disabled={!hasSelection}>Clear Selection</Button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Small>Filter</Small>
            {filterButtons.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRecycleBinFilter(item.key)}
                className={`operational-toggle${recycleBinFilter === item.key ? " operational-toggle--active" : ""}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(160px, 1fr))", gap: 10, flex: "1 1 480px" }}>
              <div className="operational-stat">
                <div className="operational-stat__label">Deleted clients</div>
                <div className="operational-stat__value">{recycleClientRows.length}</div>
              </div>
              <div className="operational-stat">
                <div className="operational-stat__label">Deleted estimates</div>
                <div className="operational-stat__value">{recycleEstimateRows.length}</div>
              </div>
              <div className="operational-stat">
                <div className="operational-stat__label">Visible items</div>
                <div className="operational-stat__value">{totalVisibleCount}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Small>View</Small>
              {viewButtons.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setRecycleBinView(item.key)}
                  className={`operational-toggle${recycleBinView === item.key ? " operational-toggle--active" : ""}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ minHeight: 0, overflow: "auto" }}>
            {recycleBinView === "grid" ? (
              <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
                {showClients && (
                  <div style={{ display: "grid", gap: 10 }}>
                    <H3>Deleted Clients</H3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                      {renderClientCards()}
                    </div>
                  </div>
                )}

                {showEstimates && (
                  <div style={{ display: "grid", gap: 10 }}>
                    <H3>Deleted Estimates</H3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                      {renderEstimateCards()}
                    </div>
                  </div>
                )}

                {totalVisibleCount === 0 && (
                  <div className="operational-empty">
                    <Small>No deleted items.</Small>
                  </div>
                )}
              </div>
            ) : (
              renderListTables()
            )}
          </div>
        </div>
      </Card>
    );
  }

function openEstimateFromGlobalMenu(clientId: Models.ClientId, estimateId: Models.EstimateId) {
    setMenu("client_database");
    openEstimateDefaults(clientId, estimateId);
  }


  function installationKeyDate(date?: string) {
    return date || "";
  }

  function installationClientLocationLabel(client: Client) {
    if (client.what3words) return `what3words: ${client.what3words}`;
    if (client.postcode) return `Postcode: ${client.postcode}`;
    const firstLine = (client.projectAddress || "").split(/\r?\n/).map((s) => (s || "").trim())[0];
    return firstLine ? `Address: ${firstLine}` : "Address unavailable";
  }

  function installationProjectAddressLabel(client: Client) {
    const lines = (client.projectAddress || "").split(/\r?\n/).map((s) => (s || "").trim()).filter(Boolean);
    if (!lines.length) return client.postcode || "Address unavailable";
    return lines.join(", ");
  }

  function installationWhat3WordsLabel(client: Client) {
    return client.what3words || "Not set";
  }

  function estimateLocationLabel(estimate: Estimate) {
    if (estimate.what3words) return `what3words: ${estimate.what3words}`;
    if (estimate.postcode) return `Postcode: ${estimate.postcode}`;
    const firstLine = (estimate.projectAddress || "").split(/\r?\n/).map((s) => (s || "").trim()).filter(Boolean)[0];
    return firstLine ? `Address: ${firstLine}` : "Address unavailable";
  }

  function estimateProjectAddressLabel(estimate: Estimate) {
    const lines = (estimate.projectAddress || "").split(/\r?\n/).map((s) => (s || "").trim()).filter(Boolean);
    if (!lines.length) return estimate.postcode || "Address unavailable";
    return lines.join(", ");
  }

  function scrollMapRowIntoView(prefix: "installation-row" | "estimate-map-row", estimateId: Models.EstimateId) {
    if (typeof document === "undefined") return;
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`${prefix}-${estimateId}`);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  
function renderInstallationBoard() {
    const rows = filteredGlobalRows("installation");
    const summary = globalSummaryForRows(rows);
    const mapItems: GoogleMapMarkerItem[] = rows.flatMap(({ client, estimate }) => {
      const resolved = resolvedLocationsByClientId[estimate.id];
      if (!resolved) return [];
      return [
        {
          id: estimate.id,
          lat: resolved.lat,
          lng: resolved.lng,
          title: clientDisplayName(client),
          subtitle: resolved.label,
          variant: "installation",
        },
      ];
    });

    return (
      <Card style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "grid", gap: 12, minHeight: 0, height: "100%", gridTemplateRows: "auto auto 1fr" }}>
          <div>
            <H2>Installation</H2>
            <Small>Operational installation view with expandable project detail on the left and live map on the right.</Small>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(140px, 1fr))", gap: 10 }}>
            <div className="operational-stat">
              <div className="operational-stat__label">Open installations</div>
              <div className="operational-stat__value">{summary.count}</div>
            </div>
            <div className="operational-stat">
              <div className="operational-stat__label">Total mÃƒâ€šÃ‚Â²</div>
              <div className="operational-stat__value">{formatMeasure(summary.totalSquareMetres)}</div>
            </div>
            <div className="operational-stat">
              <div className="operational-stat__label">Total quantity</div>
              <div className="operational-stat__value">{summary.totalQty}</div>
            </div>
            <div className="operational-stat">
              <div className="operational-stat__label">Total order value</div>
              <div className="operational-stat__value">{formatMoney(summary.totalCost)}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, minHeight: 0 }}>
            <div style={{ minHeight: 0, overflow: "auto", display: "grid", gap: 10, alignContent: "start", paddingRight: 4 }}>
              {rows.map(({ client, estimate }) => {
                const isExpanded = installationExpandedEstimateId === estimate.id;
                const activeTab = installationTabByEstimateId[estimate.id] ?? "key_dates";
                const totals = estimateCommercialTotals(estimate);
                const keyDates: Models.OrderMeta = estimate.orderMeta ?? { timeline: [] };
                const headline = clientDisplayName(client);

                return (
                  <div
                    id={`installation-row-${estimate.id}`}
                    key={estimate.id}
                    className={`operational-card${isExpanded ? " operational-card--expanded" : ""}`}
                    style={{
                      padding: 12,
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <div
                      
                      onClick={() => {
                        setSelectedMapEstimateId(estimate.id);
                        setInstallationExpandedEstimateId((prev) => (prev === estimate.id ? null : estimate.id));
                      }}
                      style={{ cursor: "pointer", display: "grid", gap: 10 }}
                    >
                      <div
                       style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr 1.15fr 1.2fr 88px", gap: 16, alignItems: "start" }}>
                        <div
                      >
                          <div
                       style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", marginBottom: 4 }}>Client Name</div>
                          <div
                       style={{ fontSize: 14, fontWeight: 900, color: "var(--color-text-primary)", lineHeight: 1.35 }}>{headline}</div>
                        </div>
                        <div
                      >
                          <div
                       style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", marginBottom: 4 }}>Order Ref</div>
                          <div
                       style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text-primary)", lineHeight: 1.35 }}>{estimate.estimateRef}</div>
                        </div>
                        <div
                      >
                          <div
                       style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", marginBottom: 4 }}>Project Name</div>
                          <div
                       style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1.35 }}>{client.projectName || ""}</div>
                        </div>
                        <div
                      >
                          <div
                       style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", marginBottom: 4 }}>Key Dates</div>
                          <div
                       style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
                            <div
                      >Dispatch Date<br />{installationKeyDate(keyDates.factoryDispatchDate)}</div>
                            <div
                       style={{ marginTop: 6 }}>Delivery Date<br />{installationKeyDate(keyDates.deliveryDate)}</div>
                            <div
                       style={{ marginTop: 6 }}>Installation Date<br />{installationKeyDate(keyDates.installationDate)}</div>
                          </div>
                        </div>
                        <div
                       style={{ alignSelf: "center", justifySelf: "end", fontSize: 12, fontWeight: 900, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                          {isExpanded ? "Hide detail" : "Expand"}
                        </div>
                      </div>

                      <div
                       style={{ display: "grid", gap: 6 }}>
                        <div
                       style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text-primary)" }}>
                          Project Address: <span style={{ fontWeight: 700 }}>{installationProjectAddressLabel(client)}</span>
                        </div>
                        <div
                       style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text-primary)" }}>
                          what3words: <span style={{ fontWeight: 700 }}>{installationWhat3WordsLabel(client)}</span>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div
                       style={{ display: "grid", gap: 12 }}>
                        <div
                       style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {([
                            ["key_dates", "Key Dates"],
                            ["order_copy", "Confirmed Order"],
                          ] as const).map(([tabKey, label]) => {
                            const active = activeTab === tabKey;
                            return (
                              <button
                                key={tabKey}
                                type="button"
                                onClick={() => setInstallationTabByEstimateId((prev) => ({ ...prev, [estimate.id]: tabKey }))}
                                className={`operational-toggle${active ? " operational-toggle--active" : ""}`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>

                        {activeTab === "key_dates" && (
                          <div className="operational-surface operational-surface--subtle" style={{ padding: 12, display: "grid", gap: 10 }}>
                            <div
                       style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(160px, 1fr))", gap: 10 }}>
                              {[
                                ["Client sign-off sent", keyDates.clientSignoffSentDate],
                                ["Client sign-off received", keyDates.clientSignoffReceivedDate],
                                ["Deposit paid", keyDates.depositPaidDate],
                                ["Factory order signed off", keyDates.factoryOrderSignedOffDate],
                                ["Factory invoice paid", keyDates.factoryInvoicePaidDate],
                                ["Production start", keyDates.productionStartDate],
                                ["Production end", keyDates.productionEndDate],
                                ["Balance invoice due", keyDates.balanceInvoiceDueDate],
                                ["Production completed", keyDates.productionCompletedDate],
                                ["Dispatch date", keyDates.factoryDispatchDate],
                                ["Delivery date", keyDates.deliveryDate],
                                ["Installation date", keyDates.installationDate],
                              ].map(([label, value]) => (
                                <div key={String(label)} className="operational-surface" style={{ padding: 10 }}>
                                  <div className="operational-eyebrow">{label}</div>
                                  <div className="operational-title" style={{ fontSize: 14, fontWeight: 800 }}>{installationKeyDate(String(value || ""))}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeTab === "order_copy" && (
                          <div className="operational-table-shell">
                            <div
                       style={{ padding: 12, borderBottom: "1px solid var(--color-border)", display: "grid", gap: 4 }}>
                              <div
                       style={{ fontSize: 14, fontWeight: 900, color: "var(--color-text-primary)" }}>Confirmed order copy</div>
                              <Small>{estimate.positions.length} position(s) {formatMoney(totals.estimateTotal)}</Small>
                            </div>
                            <div
                       style={{ maxHeight: 320, overflow: "auto" }}>
                              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                                <thead>
                                  <tr className="operational-table-header">
                                    {["Reference", "Room", "Description", "Qty", "Item price", "Quantity price"].map((label) => (
                                      <th key={label} style={{ textAlign: label === "Qty" || label === "Item price" || label === "Quantity price" ? "right" : "left", padding: 10, fontSize: 12, borderBottom: "1px solid var(--color-border)", position: "sticky", top: 0, background: "var(--color-surface-subtle)" }}>{label}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {estimate.positions.map((position) => {
                                    const lineTotal = Number(position.itemPrice || 0) * Math.max(1, Number(position.qty || 1));
                                    return (
                                      <tr key={position.id}>
                                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top", fontWeight: 800 }}>{position.positionRef}</td>
                                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top" }}>{position.roomName || ""}</td>
                                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top" }}>{position.positionType} {position.heightMm} mm</td>
                                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top", textAlign: "right" }}>{position.qty}</td>
                                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top", textAlign: "right" }}>{formatMoney(Number(position.itemPrice || 0))}</td>
                                        <td style={{ padding: 10, borderBottom: "1px solid var(--color-border)", verticalAlign: "top", textAlign: "right", fontWeight: 800 }}>{formatMoney(lineTotal)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {rows.length === 0 && (
                <div className="operational-empty">
                  <Small>No installation items found.</Small>
                </div>
              )}
            </div>

            <div style={{ minHeight: 0, display: "grid", gridTemplateRows: "auto 1fr", gap: 12 }}>
              <div className="operational-surface" style={{ padding: 12 }}>
                <div className="operational-title" style={{ fontSize: 14, fontWeight: 900 }}>Installation Map</div>
                <Small>Google Maps view for all open installations using postcode, what3words, or project address fallback.</Small>
              </div>

              <div className="operational-surface operational-surface--subtle" style={{ padding: 12, minHeight: 0 }}>
                <GoogleMapPanel
                  apiKey={googleMapsApiKey}
                  items={mapItems}
                  selectedId={selectedMapEstimateId ?? installationExpandedEstimateId ?? undefined}
                  onSelect={(markerId) => {
                    const nextId = markerId as Models.EstimateId;
                    setSelectedMapEstimateId(nextId);
                    setInstallationExpandedEstimateId(nextId);
                    scrollMapRowIntoView("installation-row", nextId);
                  }}
                  onApiReady={() => setMapsApiReady(true)}
                  height={980}
                  emptyText="No installation locations could be resolved yet."
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }


function renderEstimateMapBoard() {
    const rows = estimateMapRowsForBoard;
    const summary = globalSummaryForRows(rows);
    const mapItems: GoogleMapMarkerItem[] = rows.flatMap(({ client, estimate }) => {
      const resolved = resolvedLocationsByClientId[estimate.id];
      if (!resolved) return [];
      return [
        {
          id: estimate.id,
          lat: resolved.lat,
          lng: resolved.lng,
          title: clientDisplayName(client),
          subtitle: resolved.label,
          variant: "open",
        },
      ];
    });

    return (
      <Card style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "grid", gap: 12, minHeight: 0, height: "100%", gridTemplateRows: "auto auto 1fr" }}>
          <div>
            <H2>Estimate Map</H2>
            <Small>All estimates plotted on Google Maps using postcode, what3words, or address fallback.</Small>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(140px, 1fr))", gap: 10 }}>
            <div className="operational-stat">
              <div className="operational-stat__label">Mapped estimates</div>
              <div className="operational-stat__value">{mapItems.length}</div>
            </div>
            <div className="operational-stat">
              <div className="operational-stat__label">All estimates</div>
              <div className="operational-stat__value">{rows.length}</div>
            </div>
            <div className="operational-stat">
              <div className="operational-stat__label">Total mÃƒâ€šÃ‚Â²</div>
              <div className="operational-stat__value">{formatMeasure(summary.totalSquareMetres)}</div>
            </div>
            <div className="operational-stat">
              <div className="operational-stat__label">Total cost</div>
              <div className="operational-stat__value">{formatMoney(summary.totalCost)}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, minHeight: 0 }}>
            <div style={{ minHeight: 0, overflow: "auto", display: "grid", gap: 10, alignContent: "start", paddingRight: 4 }}>
              {rows.map(({ client, estimate, outcome, installerId }) => {
                const selected = selectedMapEstimateId === estimate.id;
                const totals = estimateCommercialTotals(estimate);
                return (
                  <button
                    id={`estimate-map-row-${estimate.id}`}
                    key={estimate.id}
                    type="button"
                    onClick={() => {
                      setSelectedMapEstimateId(estimate.id);
                      scrollMapRowIntoView("estimate-map-row", estimate.id);
                    }}
                    className={`operational-card${selected ? " operational-card--selected" : ""}`}
                    style={{
                      padding: 12,
                      display: "grid",
                      gap: 10,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div
                       style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "start" }}>
                      <div
                       style={{ display: "grid", gap: 4 }}>
                        <div
                       className="operational-title" style={{ fontSize: 14, fontWeight: 900 }}>{clientDisplayName(client)}</div>
                        <Small>{estimate.estimateRef} {client.clientRef}</Small>
                      </div>
                      <Pill>{installerId ? "Installation" : outcome}</Pill>
                    </div>
                    <div
                       style={{ display: "grid", gap: 4 }}>
                      <Small>{client.projectName || "No project name"}</Small>
                      <Small>{monthYearLabel(estimate.estimatedOrderMonth || "", estimate.estimatedOrderYear || 0)}</Small>
                      <Small>{estimateProjectAddressLabel(estimate)}</Small>
                      <Small>{estimateLocationLabel(estimate)}</Small>
                      <Small>{formatMeasure(totals.totalSquareMetres)} m {formatMoney(totals.estimateTotal)}</Small>
                    </div>
                    <div
                       style={{ display: "flex", justifyContent: "flex-start" }}>
                      <span
                        onClick={(ev) => {
                          ev.stopPropagation();
                          openEstimateFromGlobalMenu(client.id, estimate.id);
                        }}
                        className="operational-toggle"
                      >
                        Open Estimate
                      </span>
                    </div>
                  </button>
                );
              })}

              {rows.length === 0 && (
                <div className="operational-empty">
                  <Small>No estimates available for the map.</Small>
                </div>
              )}
            </div>

            <div style={{ minHeight: 0, display: "grid", gridTemplateRows: "auto 1fr", gap: 12 }}>
              <div className="operational-surface" style={{ padding: 12 }}>
                <div className="operational-title" style={{ fontSize: 14, fontWeight: 900 }}>Estimate Map</div>
                <Small>Marker colours reflect estimate outcome and installation allocation.</Small>
              </div>

              <div className="operational-surface operational-surface--subtle" style={{ padding: 12, minHeight: 0 }}>
                <GoogleMapPanel
                  apiKey={googleMapsApiKey}
                  items={mapItems}
                  selectedId={selectedMapEstimateId ?? undefined}
                  onSelect={(markerId) => {
                    const nextId = markerId as Models.EstimateId;
                    setSelectedMapEstimateId(nextId);
                    scrollMapRowIntoView("estimate-map-row", nextId);
                  }}
                  onApiReady={() => setMapsApiReady(true)}
                  height={980}
                  emptyText="No estimate locations could be resolved yet."
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  function renderGlobalEstimateMenu(
    title: string,
    menuKey: "estimates" | "orders" | "lost" | "installation",
    emptyText: string
  ) {
    const rows = filteredGlobalRows(menuKey);
    const summary = globalSummaryForRows(rows);
    const viewMode = menuKey === "installation" ? "list" : globalEstimateViewModeByMenu[menuKey];
    const sortDirection = menuKey === "installation" ? globalSort : globalSortDirectionByMenu[menuKey];
    const creatorFilter = menuKey === "installation" ? "all" : globalCreatorFilterByMenu[menuKey];
    const collectionOutcome: Models.EstimateOutcome =
      menuKey === "orders" || menuKey === "installation"
        ? "Order"
        : menuKey === "lost"
          ? "Lost"
          : "Open";
    const collectionItems = rows.map((row) => mapGlobalEstimateToCollectionItem(row));
    const sendModalRow = globalEstimateRowById(globalSendModalEstimateId);
    const sendEmailDraft = sendModalRow
      ? buildSendEmailTextService({ pickerClient: sendModalRow.client, estimateId: sendModalRow.estimate.id })
      : { subject: "", body: "" };

    return (
      <>
        <Card style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "grid", gap: 12, minHeight: 0, height: "100%", gridTemplateRows: "auto auto 1fr" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <H2>{title}</H2>
                <Small>Status-driven view across all clients and projects.</Small>
              </div>
              {menuKey !== "installation" && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {!globalSelectModeByMenu[menuKey] ? (
                    <Button variant="secondary" onClick={() => toggleGlobalSelectMode(menuKey)}>Select</Button>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => deleteSelectedGlobalEstimates(menuKey)}
                        disabled={!rows.some((row) => !!(globalSelectedEstimateIdsByMenu[menuKey] ?? {})[row.estimate.id])}
                      >
                        Delete Selected
                      </Button>
                      <Button variant="secondary" onClick={() => toggleGlobalSelectMode(menuKey)}>Cancel</Button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 320px", maxWidth: 520 }}>
                  <Input
                    value={globalSearch}
                    onChange={setGlobalSearch}
                    placeholder={`Search ${title.toLowerCase()}, client refs, project names, estimate refs or values`}
                  />
                </div>

                <ControlToolbar>
                  {menuKey !== "installation" && (
                    <ControlToolbarGroup label="Scope">
                      <Button
                        variant={creatorFilter === "mine" ? "primary" : "secondary"}
                        onClick={() =>
                          setGlobalCreatorFilterByMenu((prev) => ({ ...prev, [menuKey]: "mine" }))
                        }
                      >
                        My {title}
                      </Button>
                      <Button
                        variant={creatorFilter === "all" ? "primary" : "secondary"}
                        onClick={() =>
                          setGlobalCreatorFilterByMenu((prev) => ({ ...prev, [menuKey]: "all" }))
                        }
                      >
                        All {title}
                      </Button>
                    </ControlToolbarGroup>
                  )}
                  {menuKey !== "installation" && (
                    <ControlToolbarGroup label="View">
                      <Button
                        variant={viewMode === "list" ? "primary" : "secondary"}
                        onClick={() =>
                          setGlobalEstimateViewModeByMenu((prev) => ({ ...prev, [menuKey]: "list" }))
                        }
                      >
                        List
                      </Button>
                      <Button
                        variant={viewMode === "grid" ? "primary" : "secondary"}
                        onClick={() =>
                          setGlobalEstimateViewModeByMenu((prev) => ({ ...prev, [menuKey]: "grid" }))
                        }
                      >
                        Grid
                      </Button>
                    </ControlToolbarGroup>
                  )}
                  <ControlToolbarGroup label="Sort by">
                    <select
                      value={globalSortField}
                      onChange={(e) => setGlobalSortField(e.currentTarget.value as GlobalSortField)}
                      className="operational-select"
                    >
                      <option value="client_number">Client Number</option>
                      <option value="client_name">Client Name</option>
                      <option value="project_name">Project Name</option>
                      <option value="total_cost">Total Cost</option>
                    </select>
                    <Button
                      variant={sortDirection === "asc" ? "primary" : "secondary"}
                      onClick={() =>
                        menuKey === "installation"
                          ? setGlobalSort("asc")
                          : setGlobalSortDirectionByMenu((prev) => ({ ...prev, [menuKey]: "asc" }))
                      }
                    >
                      Ascending
                    </Button>
                    <Button
                      variant={sortDirection === "desc" ? "primary" : "secondary"}
                      onClick={() =>
                        menuKey === "installation"
                          ? setGlobalSort("desc")
                          : setGlobalSortDirectionByMenu((prev) => ({ ...prev, [menuKey]: "desc" }))
                      }
                    >
                      Descending
                    </Button>
                  </ControlToolbarGroup>
                </ControlToolbar>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Small>Forecast month</Small>
                {monthFilterOptions.map((month) => {
                  const isSelected = globalMonthFilter === month;
                  const isCurrentMonth = month === currentMonthName;
                  return (
                    <button
                      key={month}
                      type="button"
                      onClick={() => setGlobalMonthFilter(month)}
                      className={`operational-toggle${isSelected ? " operational-toggle--active" : isCurrentMonth ? " operational-toggle--current" : ""}`}
                    >
                      {month}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(140px, 1fr))", gap: 10 }}>
                <div className="operational-stat">
                  <div className="operational-stat__label">Items</div>
                  <div className="operational-stat__value">{summary.count}</div>
                </div>
                <div className="operational-stat">
                  <div className="operational-stat__label">Total mÂ²</div>
                  <div className="operational-stat__value">{formatMeasure(summary.totalSquareMetres)}</div>
                </div>
                <div className="operational-stat">
                  <div className="operational-stat__label">Linear metreage</div>
                  <div className="operational-stat__value">{formatMeasure(summary.totalLinearMetres)}</div>
                </div>
                <div className="operational-stat">
                  <div className="operational-stat__label">Total quantity</div>
                  <div className="operational-stat__value">{summary.totalQty}</div>
                </div>
                <div className="operational-stat">
                  <div className="operational-stat__label">Total cost</div>
                  <div className="operational-stat__value">{formatMoney(summary.totalCost)}</div>
                </div>
              </div>
            </div>

            <div className="operational-surface" style={{ overflow: "hidden", minHeight: 0 }}>
              <div style={{ height: "100%", minHeight: 0, overflow: "auto", padding: 12, display: "grid", gap: 12 }}>
                {menuKey !== "installation" && globalSelectModeByMenu[menuKey] && rows.length > 0 && (
                  <div className="operational-surface operational-surface--subtle" style={{ padding: 12, display: "grid", gap: 8 }}>
                    <div className="operational-copy" style={{ fontSize: 12, fontWeight: 800 }}>Bulk selection</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {rows.map(({ client, estimate }) => (
                        <label key={`select_${estimate.id}`} className="operational-title" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                          <input
                            type="checkbox"
                            checked={!!(globalSelectedEstimateIdsByMenu[menuKey] ?? {})[estimate.id]}
                            onChange={(ev) => toggleGlobalEstimateSelection(menuKey, estimate.id, ev.currentTarget.checked)}
                          />
                          <span>{clientDisplayName(client)} • {client.clientRef || "No client ref"} • {estimate.estimateRef}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <EstimateCollectionView
                  currentTab={menuKey === "orders" ? "orders" : menuKey === "lost" ? "lost" : "estimates"}
                  titleText={title}
                  emptyText={emptyText}
                  items={collectionItems}
                  showSectionSummary={false}
                  viewMode={viewMode}
                  outcome={collectionOutcome}
                  sectionTotals={{
                    totalSquareMetres: summary.totalSquareMetres,
                    totalLinearMetres: summary.totalLinearMetres,
                    totalQty: summary.totalQty,
                    totalCost: summary.totalCost,
                  }}
                  expandedEstimateId={globalExpandedEstimateId}
                  onToggleEstimate={(estimateId) =>
                    setGlobalExpandedEstimateId((prev) => (prev === estimateId ? null : estimateId))
                  }
                  statusMenuForEstimateId={globalStatusMenuForEstimateId}
                  setStatusMenuForEstimateId={setGlobalStatusMenuForEstimateId}
                  selectedOrderForInstallations={globalSelectedOrderForInstallations}
                  rankedInstallers={globalRankedInstallers}
                  selectedInstallerByEstimateId={globalSelectedInstallerByEstimateId}
                  supplierEstimateFilesByEstimateId={globalSupplierEstimateFilesByEstimateId}
                  itemPriceByPositionId={globalItemPriceByPositionId}
                  setItemPriceByPositionId={setGlobalItemPriceByPositionId}
                  formatMeasure={formatMeasure}
                  formatMoney={formatMoney}
                  getClientForItem={(item) => globalClientForEstimate(item.id)}
                  activeUserName={activeUserName}
                  apiFetchJson={apiFetchJson}
                  copyEstimateForClient={copyEstimateForClient}
                  confirmDeleteEstimate={confirmDeleteGlobalEstimate}
                  openEstimateFromPicker={openEstimateFromGlobalCollection}
                  persistEstimateOutcome={persistEstimateOutcome}
                  downloadEstimateWordDocService={downloadEstimateWordDocService}
                  printEstimatePdfService={printEstimatePdfService}
                  addFollowUpForEstimateService={addFollowUpForEstimateService}
                  positionDescription={positionDescription}
                  PositionPreview={PositionPreview}
                  timelineWithCompletion={timelineWithCompletion}
                  openInstallations={openGlobalInstallations}
                  installerLabel={globalInstallerLabel}
                  selectInstallerForEstimate={selectGlobalInstallerForEstimate}
                  setOrderMetaField={setGlobalOrderMetaField}
                  setSendModalEstimateId={setGlobalSendModalEstimateId}
                  setSendModalOpen={setGlobalSendModalOpen}
                  importSupplierEstimate={importGlobalSupplierEstimate}
                />
              </div>
            </div>
          </div>
        </Card>

        {globalSendModalOpen && sendModalRow && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              zIndex: 9999,
            }}
          >
            <div className="ep-send-modal-card">
              <div className="ep-send-modal-header">
                <div>
                  <div className="ep-send-modal-title">Send estimate</div>
                  <div className="ep-send-modal-meta">
                    {clientDisplayName(sendModalRow.client)} • {sendModalRow.client.clientRef ?? ""} • {sendModalRow.estimate.estimateRef ?? ""}
                  </div>
                </div>

                <div className="ep-send-modal-close">
                  <Button variant="secondary" onClick={() => setGlobalSendModalOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>

              <div className="ep-send-modal-body">
                <div className="ep-send-section">
                  <div className="ep-send-section-title">Send email</div>

                  <div className="ep-send-stack">
                    <div className="ep-send-field">
                      <Small>Subject</Small>
                      <input className="ep-send-input" value={sendEmailDraft.subject} readOnly />
                    </div>

                    <div className="ep-send-field">
                      <Small>Body</Small>
                      <textarea className="ep-send-textarea" value={sendEmailDraft.body} readOnly rows={8} />
                    </div>

                    <div className="ep-send-inline-actions">
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(`Subject: ${sendEmailDraft.subject}\n\n${sendEmailDraft.body}`);
                            alert("Email text copied.");
                          } catch {
                            alert("Could not copy to clipboard.");
                          }
                        }}
                      >
                        Copy email text
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={() =>
                          printEstimatePdfService({
                            pickerClient: sendModalRow.client,
                            e: sendModalRow.estimate,
                            itemPriceByPositionId: globalItemPriceByPositionId,
                            formatMeasure,
                            formatMoney,
                            positionDescription,
                            alertFn: alert,
                          })
                        }
                      >
                        Generate PDF
                      </Button>

                      <Button
                        variant="primary"
                        onClick={() =>
                          openMailClientService(
                            (sendModalRow.client as any)?.email ?? "",
                            sendEmailDraft.subject,
                            sendEmailDraft.body
                          )
                        }
                      >
                        Open email app
                      </Button>
                    </div>

                    <Small style={{ color: "var(--color-text-muted)" }}>
                      Use “Print PDF” to generate the customer-facing estimate PDF, then attach that PDF in your email app. Direct file attachment from the browser send flow is not wired yet.
                    </Small>
                  </div>
                </div>

                <div className="ep-send-section">
                  <div className="ep-send-section-title">Add follow up</div>

                  <div className="ep-send-stack" style={{ gap: 10 }}>
                    <label className="ep-send-checkbox">
                      <input type="checkbox" checked={globalSendModalAddFollowUp} onChange={(e) => setGlobalSendModalAddFollowUp(e.currentTarget.checked)} />
                      <span className="ep-send-checkbox-text">
                        Create follow-up (default {globalSendModalFollowUpDays} days / 72 hours)
                      </span>
                    </label>

                    <div className="ep-send-inline-row">
                      <Small>Follow up in (days)</Small>
                      <input
                        className="ep-send-input ep-send-input--days"
                        type="number"
                        min={0}
                        value={globalSendModalFollowUpDays}
                        onChange={(e) => setGlobalSendModalFollowUpDays(Math.max(0, Number(e.currentTarget.value || 0)))}
                      />

                      <label className="ep-send-checkbox">
                        <input type="checkbox" checked={globalSendModalPhoneCall} onChange={(e) => setGlobalSendModalPhoneCall(e.currentTarget.checked)} />
                        <span className="ep-send-checkbox-text">Telephone call</span>
                      </label>
                    </div>

                    <Small style={{ color: "var(--color-text-muted)" }}>
                      Follow-ups are saved to the database and appear in Customers - Follow Ups on the scheduled due date.
                    </Small>
                  </div>
                </div>

                <div className="ep-send-footer">
                  <Button variant="secondary" onClick={() => setGlobalSendModalOpen(false)}>
                    Cancel
                  </Button>

                  <Button
                    variant="primary"
                    onClick={() => {
                      printEstimatePdfService({
                        pickerClient: sendModalRow.client,
                        e: sendModalRow.estimate,
                        itemPriceByPositionId: globalItemPriceByPositionId,
                        formatMeasure,
                        formatMoney,
                        positionDescription,
                        alertFn: alert,
                      });
                      openMailClientService((sendModalRow.client as any)?.email ?? "", sendEmailDraft.subject, sendEmailDraft.body);
                      if (globalSendModalAddFollowUp) {
                        addFollowUpForEstimateService({
                          pickerClient: sendModalRow.client,
                          estimateId: sendModalRow.estimate.id,
                          opts: {
                            days: globalSendModalFollowUpDays,
                            sendEmail: true,
                            needsCall: globalSendModalPhoneCall,
                          },
                          apiFetchJson,
                          activeUserName,
                          alertFn: alert,
                          logError: console.error,
                        });
                      }
                      setGlobalSendModalOpen(false);
                    }}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
<AppShell title="QuoteSync" onMenuClick={handleTopShellMenuClick}>
  { topShellPage === "admin" ? (
    <AdminPlaceholderPage />
  ) : topShellPage === "window_types_render_preview" ? (
    <AdminPlaceholderPage
      initialSection="configurator_controls"
      initialConfiguratorTab="windowTypes"
      initialWindowTypesCategory="windows"
    />
  ) : topShellPage === "configurator_render" ? (
    <AdminPlaceholderPage initialSection="configurator_controls" initialConfiguratorTab="configuratorRender" />
  ) : topShellPage === "b92_configurator" ? (
    <AdminPlaceholderPage initialSection="configurator_controls" initialConfiguratorTab="b92Configurator" />
  ) : topShellPage === "client_portal" ? (
    <ClientPortalPlaceholderPage />
  ) : topShellPage === "settings" ? (
        <TopShellPlaceholder
          title="Settings"
          summary="Future-ready settings area placeholder. This will later host branding, styling, logo uploads, and broader system configuration."
        />
      ) : topShellPage === "help" ? (
        <TopShellPlaceholder
          title="Help"
          summary="Future-ready help area placeholder. This will later host support content, onboarding, and documentation."
        />
      ) : (
        <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", background: "var(--app-shell-main-bg)", color: "var(--color-text-primary)", minHeight: "calc(100vh - 84px)", height: "calc(100vh - 84px)", overflow: "hidden" }}>
          <div style={{ width: "100%", margin: "0", padding: 0, height: "100%" }}>
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, height: "100%", minHeight: 0, alignItems: "stretch" }}>
          {/* Sidebar */}
          <Card style={{ padding: 12, position: "sticky", top: 16, alignSelf: "stretch", height: "100%", minHeight: 0, overflowY: "auto" }}>
            <div style={{ padding: "6px 6px 12px 6px" }}>
            </div>

            <div style={{ marginTop: 14 }}>
              <H3>Dashboard</H3>
              <div style={{ marginTop: 8 }}>
                <SidebarItem label="Main Dashboard" active={menu === "dashboard"} onClick={() => selectMenu("dashboard")} />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <H3>Customers</H3>
              <div style={{ marginTop: 8 }}>
                <SidebarItem label="Client Database" active={menu === "client_database"} onClick={() => selectMenu("client_database")} />
                <SidebarItem label="Follow Ups" active={menu === "follow_ups"} onClick={() => selectMenu("follow_ups")} />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <H3>Estimate / Order Status</H3>
              <div style={{ marginTop: 8 }}>
                <SidebarItem label="Estimates" active={menu === "estimates"} onClick={() => selectMenu("estimates")} />
                <SidebarItem label="Orders" active={menu === "orders"} onClick={() => selectMenu("orders")} />
                <SidebarItem label="Lost" active={menu === "lost"} onClick={() => selectMenu("lost")} />
                <SidebarItem label="Installation" active={menu === "installation"} onClick={() => selectMenu("installation")} />
                <SidebarItem label="Estimate Map" active={menu === "estimate_map"} onClick={() => selectMenu("estimate_map")} />
                <SidebarItem label="Completed Projects" active={menu === "completed_projects"} onClick={() => selectMenu("completed_projects")} />
                <SidebarItem label="Recycle Bin" active={menu === "recycle_bin"} onClick={() => selectMenu("recycle_bin")} />
              </div>
            
            </div>
          </Card>

          {/* Main */}
          <div style={{ display: "grid", gap: menu === "dashboard" && view === "customers" ? 10 : 16, minHeight: 0, height: "100%", overflowY: "auto", paddingRight: 4, alignContent: "start" }}>
            {demoClientsLoaded && (
              <div className="demo-mode-banner" role="status">
                <strong>Demo mode active</strong>
                <span>{demoModeWarning || "Generated demo clients are currently displayed."}</span>
              </div>
            )}
            {!demoClientsLoaded && demoModeWarning && (
              <div className="demo-mode-banner demo-mode-banner--warning" role="status">
                <strong>Demo data not loaded</strong>
                <span>{demoModeWarning}</span>
              </div>
            )}
            {topShellPage === "tools" && <ToolsHubPage />}
            {topShellPage !== "tools" && menu !== "dashboard" && view !== "estimate_workspace" && (
              <Card style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <H2>Quick actions</H2>
                    <Small>Start the core workflow from the main page: Client → Estimate → Order → Installation.</Small>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button variant="primary" onClick={openAddClientPanel}>
                      Add Client
                    </Button>
                  </div>
                </div>
              </Card>
            )}
			{topShellPage !== "tools" && menu === "dashboard" && view === "customers" && (
              <MainDashboard
                clients={clients}
                activeUserName="User"
                onOpenMenu={(targetMenu) => selectMenu(targetMenu as Models.MenuKey)}
                onOpenEstimate={(clientId, estimateId) => openEstimateDefaults(clientId, estimateId)}
              />
            )}

{what3WordsPickerOpen && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 80,
      background: "rgba(24,24,27,0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}
  >
    <div
      className="legacy-modal-surface"
      style={{
        width: "min(1100px, 96vw)",
        maxHeight: "92vh",
        overflow: "auto",
        borderRadius: 18,
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <H3>Project what3words map picker</H3>
          <Small>Select the estimate project location on the map. The what3words field will auto-fill when available.</Small>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setWhat3WordsPickerOpen(false);
            setWhat3WordsPickerError("");
          }}
        >
          Close
        </Button>
      </div>

      {what3WordsPickerError ? (
        <div className="legacy-error-callout" style={{ borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700 }}>
          {what3WordsPickerError}
        </div>
      ) : null}

      {what3WordsPickerLoading ? (
        <div className="legacy-modal-status" style={{ borderRadius: 12, padding: 12 }}>
          <Small>Resolving what3words for the selected map point...</Small>
        </div>
      ) : null}

      <GoogleMapPanel
        apiKey={googleMapsApiKey}
        items={[]}
        onApiReady={() => setMapsApiReady(true)}
        onMapClick={handleWhat3WordsMapPick}
        height={560}
        emptyText="Click the map to select the project location."
      />
    </div>
  </div>
)}

{showAddClient && (
  <ModalOverlay width="min(1100px, 96vw)" onClose={closeAddClientPanel}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div>
        <H2>{editingClientId ? "Edit client" : "Add client"}</H2>
        <Small>
          {resumeEstimateCreationAfterClientCreate
            ? "Create the client first, then continue directly into estimate creation."
            : "Create a client without leaving the current page."}
        </Small>
      </div>

      <Button variant="secondary" onClick={closeAddClientPanel}>
        Close
      </Button>
    </div>

    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <H3>Client contact information</H3>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={draftClientType === "Business"}
              onChange={(e) => setDraftClientType(e.currentTarget.checked ? "Business" : "Individual")}
            />
            <span className="legacy-checkbox-label" style={{ fontSize: 12, fontWeight: 800 }}>Business customer</span>
          </label>

          <Small>Type: {draftClientType}</Small>
        </div>
      </div>

      {draftClientType === "Business" ? (
        <>
          <div>
            <div style={labelStyle}>Business name</div>
            <Input value={draftBusinessName} onChange={setDraftBusinessName} placeholder="Company Ltd" />
          </div>

          <div>
            <div style={labelStyle}>Contact name</div>
            <Input value={draftContactName} onChange={setDraftContactName} placeholder="Name" />
          </div>
        </>
      ) : (
        <div>
          <div style={labelStyle}>Client name</div>
          <Input value={draftClientName} onChange={setDraftClientName} placeholder="Name" />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={labelStyle}>Email</div>
          <Input value={draftEmail} onChange={setDraftEmail} placeholder="email@example.com" />
        </div>
        <div>
          <div style={labelStyle}>Mobile</div>
          <Input value={draftMobile} onChange={setDraftMobile} placeholder="07..." />
        </div>
      </div>

      <div>
        <div style={labelStyle}>Home</div>
        <Input value={draftHome} onChange={setDraftHome} placeholder="01..." />
      </div>

      <div>
        <div style={labelStyle}>Project name</div>
        <Input value={draftProjectName} onChange={setDraftProjectName} placeholder="Project name" />
      </div>

      <div className="legacy-section-divider" style={{ marginTop: 10, paddingTop: 10 }}>
        <button
          type="button"
          onClick={() => setCustomerAddressSectionOpen((prev) => !prev)}
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            margin: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            font: "inherit",
          }}
          className="legacy-section-toggle"
        >
          <H3>{customerAddressSectionOpen ? "▼" : "▶"} Customer address</H3>
        </button>

        {customerAddressSectionOpen && (
          <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>Address line 1</div>
                <Input value={draftCustAddress1} onChange={setDraftCustAddress1} placeholder="Address line 1" />
              </div>
              <div>
                <div style={labelStyle}>Address line 2</div>
                <Input value={draftCustAddress2} onChange={setDraftCustAddress2} placeholder="Address line 2" />
              </div>
            </div>

            <div>
              <div style={labelStyle}>Address line 3</div>
              <Input value={draftCustAddress3} onChange={setDraftCustAddress3} placeholder="Address line 3" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>Town</div>
                <Input value={draftCustTown} onChange={setDraftCustTown} placeholder="Town" />
              </div>
              <div>
                <div style={labelStyle}>City</div>
                <Input value={draftCustCity} onChange={setDraftCustCity} placeholder="City" />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>County/District</div>
                <Input value={draftCustCounty} onChange={setDraftCustCounty} placeholder="County/District" />
              </div>
              <div>
                <div style={labelStyle}>Postcode</div>
                <Input value={draftCustPostcode} onChange={setDraftCustPostcode} placeholder="Postcode" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="legacy-section-divider" style={{ marginTop: 10, paddingTop: 10 }}>
        <button
          type="button"
          onClick={() => setInvoiceAddressSectionOpen((prev) => !prev)}
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            margin: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            font: "inherit",
          }}
          className="legacy-section-toggle"
        >
          <H3>{invoiceAddressSectionOpen ? "▼" : "▶"} Invoice address</H3>
        </button>

        {invoiceAddressSectionOpen && (
          <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700 }}>
                <input
                  type="radio"
                  name="invoiceAddressMode"
                  checked={invoiceAddressMode === "customer"}
                  onChange={() => setInvoiceAddressMode("customer")}
                />
                Same as customer address
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700 }}>
                <input
                  type="radio"
                  name="invoiceAddressMode"
                  checked={invoiceAddressMode === "custom"}
                  onChange={() => setInvoiceAddressMode("custom")}
                />
                Custom invoice address
              </label>
            </div>

            {invoiceAddressMode === "custom" && (
              <div style={{ marginTop: 4, display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={labelStyle}>Address line 1</div>
                    <Input value={draftInvAddress1} onChange={setDraftInvAddress1} placeholder="Address line 1" />
                  </div>
                  <div>
                    <div style={labelStyle}>Address line 2</div>
                    <Input value={draftInvAddress2} onChange={setDraftInvAddress2} placeholder="Address line 2" />
                  </div>
                </div>

                <div>
                  <div style={labelStyle}>Address line 3</div>
                  <Input value={draftInvAddress3} onChange={setDraftInvAddress3} placeholder="Address line 3" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={labelStyle}>Town</div>
                    <Input value={draftInvTown} onChange={setDraftInvTown} placeholder="Town" />
                  </div>
                  <div>
                    <div style={labelStyle}>City</div>
                    <Input value={draftInvCity} onChange={setDraftInvCity} placeholder="City" />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={labelStyle}>County/District</div>
                    <Input value={draftInvCounty} onChange={setDraftInvCounty} placeholder="County/District" />
                  </div>
                  <div>
                    <div style={labelStyle}>Postcode</div>
                    <Input value={draftInvPostcode} onChange={setDraftInvPostcode} placeholder="Postcode" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <Button variant="secondary" onClick={closeAddClientPanel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={clientSaving}
          onClick={() => {
            if (editingClientId) {
              updateClient(draftClientType);
              return;
            }
            void createClient(draftClientType);
          }}
        >
          {clientSaving ? "Saving..." : editingClientId ? "Save Changes" : "Create Client"}
        </Button>
      </div>
    </div>
  </ModalOverlay>
)}

{showAddEstimateModal && (
  <ModalOverlay width="min(720px, 96vw)" onClose={closeAddEstimateModal}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div>
        <H2>Add estimate</H2>
        <Small>Create a new estimate from the main page without leaving the current workflow.</Small>
      </div>

      <Button variant="secondary" onClick={closeAddEstimateModal}>
        Close
      </Button>
    </div>

    {!clientsLoaded ? (
      <div style={{ display: "grid", gap: 12 }}>
        <div className="legacy-modal-status" style={{ borderRadius: 16, padding: 16, display: "grid", gap: 8 }}>
          <H3>Loading clients</H3>
          <Small>Checking the live client list before starting estimate creation.</Small>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={closeAddEstimateModal}>
            Cancel
          </Button>
        </div>
      </div>
    ) : clients.length === 0 ? (
      <div style={{ display: "grid", gap: 12 }}>
        <div className="legacy-modal-status" style={{ borderRadius: 16, padding: 16, display: "grid", gap: 8 }}>
          <H3>No clients yet</H3>
          <Small>Add a client first, then continue straight into estimate creation.</Small>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={closeAddEstimateModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={openAddClientThenEstimateFlow}>
            Add Client
          </Button>
        </div>
      </div>
    ) : (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={labelStyle}>Client</div>
          <select
            value={createEstimateClientId}
            onChange={(event) => setCreateEstimateClientId(event.currentTarget.value)}
            className="operational-select"
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {(client.type === "Business" ? client.businessName || client.clientName : client.clientName) || "Client"} · {client.clientRef || "No client ref"}
              </option>
            ))}
          </select>
        </div>

        {selectedCreateEstimateClient && (
          <div className="legacy-modal-status" style={{ borderRadius: 16, padding: 16, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill>{selectedCreateEstimateClient.clientRef || "No client ref"}</Pill>
              <Pill>{selectedCreateEstimateClient.projectName || "No project name"}</Pill>
            </div>
            <H3>{clientDisplayName(selectedCreateEstimateClient)}</H3>
            <Small>{selectedCreateEstimateClient.email || selectedCreateEstimateClient.mobile || selectedCreateEstimateClient.home || "No contact details set"}</Small>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={closeAddEstimateModal}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!selectedCreateEstimateClient || createEstimateSubmitting} onClick={() => void handleCreateEstimateFromModal()}>
            {createEstimateSubmitting ? "Creating..." : "Create Estimate"}
          </Button>
        </div>
      </div>
    )}
  </ModalOverlay>
)}

            {/* CUSTOMERS LIST */}
            {menu === "client_database" && view === "customers" && (
  <Card style={{ minHeight: 0, height: "100%", display: "flex", flexDirection: "column", minWidth: 0, overflow: "auto" }}>
    <div className="clients-surface-header">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <H2>Client Database</H2>
          <Small>Open a client to choose an estimate (or create one).</Small>
        </div>

        <Button variant="primary" onClick={openAddClientPanel}>
          Add new client
        </Button>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px", maxWidth: 520 }}>
            <Input
              value={clientDbSearch}
              onChange={setClientDbSearch}
              placeholder="Search clients, refs, project names or address"
              autoComplete="off"
            />
          </div>

          <ControlToolbar>
            <ControlToolbarGroup label="Scope">
              {(["All", "Open", "Orders", "Lost"] as const).map((opt) => (
                <Button
                  key={opt}
                  variant={clientDbFilter === opt ? "primary" : "secondary"}
                  onClick={() => setClientDbFilter(opt)}
                >
                  {opt}
                </Button>
              ))}
            </ControlToolbarGroup>

            <ControlToolbarGroup label="View">
              <ClientCollectionViewToggle viewMode={clientCollectionViewMode} onChange={setClientCollectionViewMode} />
            </ControlToolbarGroup>

            <ControlToolbarGroup label="Sort by">
              <select
                value={clientDbSortField}
                onChange={(e) => setClientDbSortField(e.currentTarget.value as "client_name" | "client_number" | "project_name")}
                className="clients-surface-sort-select"
              >
                <option value="client_name">Client Name</option>
                <option value="client_number">Client Number</option>
                <option value="project_name">Project Name</option>
              </select>
              <Button variant={clientDbSort === "asc" ? "primary" : "secondary"} onClick={() => setClientDbSort("asc")}>
                Ascending
              </Button>
              <Button variant={clientDbSort === "desc" ? "primary" : "secondary"} onClick={() => setClientDbSort("desc")}>
                Descending
              </Button>
            </ControlToolbarGroup>
          </ControlToolbar>
        </div>

        <div className="clients-surface-toolbar">
          <Small>{clientCollectionItems.length} clients shown</Small>
        </div>
      </div>
    </div>

                {/* Customers list */}
                <div className="clients-surface-shell">
                  {clientCollectionItems.length === 0 && <div className="clients-surface-empty">No clients yet.</div>}

                  {clientCollectionItems.length > 0 &&
                    (clientCollectionViewMode === "list" ? (
                      <ClientsListView
                        items={clientCollectionItems}
                        onOpenClient={openClient}
                        onCreateEstimate={createEstimateForClient}
                      />
                    ) : (
                      <ClientsGridView
                        items={clientCollectionItems}
                        onOpenClient={openClient}
                        onCreateEstimate={createEstimateForClient}
                      />
                    ))}
                </div>
              </Card>
            )}

                        {menu === "follow_ups" && view === "customers" && (
              <FollowUpsFeature
                clients={clients}
                onOpenClient={(clientId) => {
                  setEstimatePickerClientId(clientId);
                  setView("estimate_picker");
                }}
              />
            )}

            {menu === "estimates" && view === "customers" && renderGlobalEstimateMenu(
              "Estimates",
              "estimates",
              "No estimates found."
            )}

            {menu === "orders" && view === "customers" && renderGlobalEstimateMenu(
              "Orders",
              "orders",
              "No orders found."
            )}

            {menu === "lost" && view === "customers" && renderGlobalEstimateMenu(
              "Lost",
              "lost",
              "No lost estimates found."
            )}

            {menu === "installation" && view === "customers" && renderInstallationBoard()}

            {menu === "estimate_map" && view === "customers" && renderEstimateMapBoard()}

            {menu === "completed_projects" && view === "customers" && (
              <Card style={{ minHeight: 520 }}>
                <H2>Completed Projects</H2>
                <Small>Completed projects workflow will be added in a later phase.</Small>
              </Card>
            )}

            {menu === "recycle_bin" && view === "customers" && renderRecycleBinMenu()}

            {/* ESTIMATE PICKER */}
            {view === "estimate_picker" && (
              <EstimatePickerFeature
				ref={estimatePickerRef}
				clientId={estimatePickerClientId}
				initialClientId={estimatePickerClientId}
				onConsumedInitialClientId={() => setEstimatePickerClientId(null)}
				clients={clients}
				onBack={() => {
				setEstimatePickerClientId(null);
				estimatePickerRef.current?.clear();
				setView("customers");
			}}
				openEditClientPanel={openEditClientPanel}
				createEstimateForClient={createEstimateForClient}
				copyEstimateForClient={copyEstimateForClient}
				deleteClientToRecycle={deleteClientToRecycle}
				deletedEstimatesForClient={estimatePickerClientId ? (deletedEstimatesByClientId[estimatePickerClientId] ?? []) : []}
				deleteEstimatesForClient={deleteEstimatesForClient}
				restoreDeletedEstimatesForClient={restoreDeletedEstimatesForClient}
				purgeDeletedEstimatesForClient={purgeDeletedEstimatesForClient}
				setEstimateInstaller={setEstimateInstaller}
				updateEstimateOrderMeta={updateEstimateOrderMeta}
				updateEstimatePosition={updateEstimatePosition}
				openEstimateDefaults={(clientId, estimateId) => openEstimateDefaults(clientId, estimateId)}
                persistEstimateOutcome={persistEstimateOutcome}
			/>
            )}
            {/* ESTIMATE DEFAULTS */}
            {view === "estimate_defaults" && selectedClient && selectedEstimate && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <H2>Estimate Configurator Disabled</H2>
                    <div
                      style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
                    >
                      <Pill>{selectedClient.clientRef}</Pill>
                      <Pill>{selectedEstimate.estimateRef}</Pill>
                      <Small>{selectedClient.clientName}</Small>
                    </div>
                    <Small>{DISABLED_ESTIMATE_CONFIGURATOR_MESSAGE}</Small>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <Button variant="secondary" onClick={() => setView("customers")}>
                      Back
                    </Button>
                    <Button variant="primary" onClick={() => setView("estimate_workspace")}>
                      Go to Estimate
                    </Button>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                  <ClientSummary c={selectedClient} />
                </div>
              </Card>
            )}

            {/* ESTIMATE WORKSPACE */}
            {view === "estimate_workspace" && selectedClient && selectedEstimate && (
                <Card style={{ minHeight: 520, display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <H2>Estimate</H2>
                      <div
                         style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <Pill>{selectedClient.clientRef}</Pill>
                        <Pill>{selectedEstimate.estimateRef}</Pill>
                        <Small>{selectedClient.clientName}</Small>
                      </div>
                      <Small>Supplier/Product Defaults are set separately. Add Position starts at Position Configuration.</Small>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <Button variant="secondary" onClick={() => setView("customers")}>
                        Back
                      </Button>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <ClientSummary c={selectedClient} />
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <Button variant="secondary" disabled style={{ width: "100%" }}>
                      Add Position Disabled
                    </Button>
                    <Small>{DISABLED_ESTIMATE_CONFIGURATOR_MESSAGE}</Small>
                  </div>

                  <div className="legacy-section-divider" style={{ marginTop: 16, paddingTop: 12, flex: 1 }}>
                    <H3>Positions</H3>
                    <Small>Positions added to this estimate appear below.</Small>

                    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                      {selectedEstimate.positions.length === 0 && <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>No positions yet.</div>}

                      {(() => {
                      const totals = estimateCommercialTotals(selectedEstimate);
                      return (
                        <>
                          <div
                        
                            style={{
                              marginTop: 10,
                              display: "grid",
                              gridTemplateColumns: "repeat(4, minmax(140px, 1fr))",
                              gap: 10,
                            }}
                          >
                            <div className="operational-stat">
                              <div className="operational-stat__label">Total mÂ²</div>
                              <div className="operational-stat__value">{formatMeasure(totals.totalSquareMetres)}</div>
                            </div>
                            <div className="operational-stat">
                              <div className="operational-stat__label">Linear metreage</div>
                              <div className="operational-stat__value">{formatMeasure(totals.totalLinearMetres)}</div>
                            </div>
                            <div className="operational-stat">
                              <div className="operational-stat__label">Total quantity</div>
                              <div className="operational-stat__value">{totals.totalQty}</div>
                            </div>
                            <div className="operational-stat">
                              <div className="operational-stat__label">Estimate total</div>
                              <div className="operational-stat__value">{formatMoney(totals.estimateTotal)}</div>
                            </div>
                          </div>

                          <div
                         style={{ marginTop: 10, display: "grid", gap: 10 }}>
                            {selectedEstimate.positions.map((p) => {
                              const lineTotal = Number(p.itemPrice || 0) * Math.max(1, Number(p.qty || 1));
                              return (
                                <div
                         key={p.id} className="operational-surface" style={{ padding: 10 }}>
                                  <div
                         style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                    <div
                         style={{ fontWeight: 900, fontSize: 13 }}>{p.positionRef}</div>
                                    <div
                         style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                                      Qty {p.qty} {p.fieldsY}
                                    </div>
                                  </div>
                                  <div
                         style={{ marginTop: 4, fontSize: 12, color: "var(--color-text-muted)" }}>
                                    {p.roomName || (p.useEstimateDefaults ? "Using estimate defaults" : "Overrides")}
                                  </div>

                                  <div
                         style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 160px 160px", gap: 12, alignItems: "end" }}>
                                    <div
                         />
                                    <div
                        >
                                      <div
                         style={labelStyle}>Item price</div>
                                      <Input
                                        type="number"
                                        value={String(p.itemPrice ?? "")}
                                        onChange={(v) =>
                                          updateEstimatePosition(selectedClient.id, selectedEstimate.id, p.id, {
                                            itemPrice: v === "" ? 0 : Number(v || 0),
                                          })
                                        }
                                        placeholder="0.00"
                                      />
                                    </div>
                                    <div
                        >
                                      <div
                         style={labelStyle}>Quantity price</div>
                                      <div
                        
                                        style={{
                                          width: "100%",
                                          borderRadius: 12,
                                          padding: "10px 12px",
                                          fontSize: 14,
                                          fontWeight: 800,
                                          textAlign: "right",
                                        }}
                                        className="legacy-modal-status"
                                      >
                                        {formatMoney(lineTotal)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                </Card>
            )}

            {/* CLIENT DATABASE VIEW FALLBACK (Phase 4F) */}
            {menu === "client_database" && view !== "customers" && view !== "estimate_picker" && view !== "estimate_defaults" && view !== "estimate_workspace" && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <H2>Client Database</H2>
                  <Small>
                    Main panel is blank because view is not recognised: <b>{String(view)}</b>
                  </Small>
                  <Small>Click reset to return to Customers.</Small>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Button variant="primary" onClick={() => setView("customers")}>Reset to Customers</Button>
                    <Button variant="secondary" onClick={() => { setMenu("client_database"); setView("customers"); }}>Reset Menu + View</Button>
                  </div>
                </div>
              </Card>
            )}
            {menu === "project_preferences" && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ display: "grid", gap: 16, maxWidth: 900 }}>
                  <div>
                    <H2>Project Preferences</H2>
                    <Small>Configure default loading behaviour for QuoteSync.</Small>
                  </div>

                  <div className="legacy-surface-card" style={{ padding: 16, display: "grid", gap: 12 }}>
                    <div
                       style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div
                      >
                        <H3>Load Defaults</H3>
                        <Small>
                          When enabled, new estimates start with the default supplier, product and technical settings.
                          When disabled, new estimates start blank.
                        </Small>
                      </div>

                      <Toggle
                        value={systemSettings.loadDefaults}
                        onChange={(checked) =>
                          setSystemSettings((prev) => ({
                            ...prev,
                            loadDefaults: checked,
                          }))
                        }
                      />
                    </div>

<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
  <span className="legacy-setting-label" style={{ fontSize: 14, fontWeight: 700 }}>Load Demo Clients</span>
  <Toggle
    value={systemSettings.loadDemoClients}
    onChange={(checked) =>
      setSystemSettings((prev) => ({
        ...prev,
        loadDemoClients: checked,
      }))
    }
  />
</div>

<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
  <span className="legacy-setting-label" style={{ fontSize: 14, fontWeight: 700 }}>Load Demo Estimates</span>
  <Toggle
    value={systemSettings.loadDemoEstimates}
    onChange={(checked) =>
      setSystemSettings((prev) => ({
        ...prev,
        loadDemoEstimates: checked,
      }))
    }
  />
</div>

                    <div
                       style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
  <span className="legacy-setting-label" style={{ fontSize: 14, fontWeight: 700 }}>Load Demo Forecast</span>
  <Toggle
    value={systemSettings.loadDemoForecast}
    onChange={(checked) =>
      setSystemSettings((prev) => ({
        ...prev,
        loadDemoForecast: checked,
      }))
    }
  />
</div>
                  </div>
                </div>
              </Card>
            )}

            {/* Fallback for other menus */}
            {menu !== "dashboard" && menu !== "client_database" && menu !== "follow_ups" && menu !== "estimates" && menu !== "orders" && menu !== "lost" && menu !== "installation" && menu !== "estimate_map" && menu !== "completed_projects" && menu !== "recycle_bin" && menu !== "project_preferences" && (
              <Card style={{ minHeight: 520 }}>
                <H2>{menu.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())}</H2>
                <Small>Placeholder screen.</Small>
              </Card>
            )}
          </div>
        </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
const DISABLED_ESTIMATE_CONFIGURATOR_MESSAGE =
  "Estimate configurator flow is temporarily disabled while the Admin-led configurator is rebuilt.";
