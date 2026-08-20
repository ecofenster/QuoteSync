// Auto-generated extraction (Phase 2): Estimate Picker Tabs
// Purpose: split out Estimate Picker tab UI from App.tsx without changing layout/styles.
// NOTE: This file intentionally duplicates a few small UI primitives (Button/Pill/Small/H3)
// and ClientDetailsReadonly to avoid risky refactors at this stage.

import React, { useEffect, useState } from "react";
import { resolveStructuredAddress, addressTuple } from "../../domain/address";
import { rankInstallersByDistance } from "../../services/distance";
import { getInstallers } from "../../data/installers";
import { ControlToolbar, ControlToolbarGroup } from "../../components/ControlToolbar";
import { loadSettings } from "../../system/settings";
import { CURRENT_APP_USER } from "../../system/currentUser";
import { getPreference, setPreference } from "../../utils/userPreferences";
import { createDefaultTimeline } from "../../system/orderTimeline";
import type { Client, ClientId, EstimateId, EstimateOutcome, EstimatePickerTab, ClientFile } from "../../models/types";
import { estimateTotals, estimateCostTotal } from '../../domain/estimates/estimateCalculations';
import { addFollowUpForEstimate as addFollowUpForEstimateService } from '../../services/followups/followupService';
import { buildSendEmailText as buildSendEmailTextService, openMailClient as openMailClientService } from '../../services/email/emailService';
import { printEstimatePdf as printEstimatePdfService, downloadEstimateWordDoc as downloadEstimateWordDocService } from '../../services/documents/estimateDocumentService';
import { getConfiguredPositionContract } from "../configurator/configuredPositionContract.utils";
import { positionDescriptionForDisplay } from "../../domain/positions/positionPresentation";
import ClientInfoTab from './tabs/ClientInfoTab';
import NotesTab from './tabs/NotesTab';
import FilesTab from './tabs/FilesTab';
import EstimateSectionTab from './tabs/EstimateSectionTab';
import type { EstimateCollectionViewMode } from "../estimateCollection/EstimateCollectionView";
import './tabs/shared.css';

const CLIENT_ESTIMATE_PREF_KEYS = {
  viewMode: {
    estimates: "quotesync:viewMode:client:estimates",
    orders: "quotesync:viewMode:client:orders",
    lost: "quotesync:viewMode:client:lost",
  },
  sortDirection: {
    estimates: "quotesync:sortDirection:client:estimates",
    orders: "quotesync:sortDirection:client:orders",
    lost: "quotesync:sortDirection:client:lost",
  },
  creatorFilter: {
    estimates: "quotesync:filter:client:estimates",
    orders: "quotesync:filter:client:orders",
    lost: "quotesync:filter:client:lost",
  },
} as const;

function isEstimateCollectionViewMode(value: unknown): value is EstimateCollectionViewMode {
  return value === "list" || value === "grid";
}

function isCreatorFilter(value: unknown): value is "mine" | "all" {
  return value === "mine" || value === "all";
}

function isSortDirection(value: unknown): value is "asc" | "desc" {
  return value === "asc" || value === "desc";
}

type Props = {
  estimatePickerTab: EstimatePickerTab;
  initialExpandedEstimateId?: EstimateId | null;
  onConsumedInitialExpandedEstimateId?: () => void;
  setEstimatePickerTab: (t: EstimatePickerTab) => void;

  pickerClient: Client | null;
  createEstimateForClient: (client: Client, options?: { openManufacturerImport?: boolean }) => void;
  openEditClientPanel: (c: Client) => void;
  openEstimateFromPicker: (estimateId: EstimateId) => void;
  copyEstimateForClient: (client: Client, sourceEstimateId: EstimateId) => void;
  deletedEstimatesForClient: { estimate: Client["estimates"][number]; deletedAt: string }[];
  deleteEstimatesForClient: (clientId: ClientId, estimateIds: EstimateId[]) => void;
  restoreDeletedEstimatesForClient: (clientId: ClientId, estimateIds: EstimateId[]) => void;
  purgeDeletedEstimatesForClient: (clientId: ClientId, estimateIds?: EstimateId[]) => void;
  setEstimateInstaller: (clientId: ClientId, estimateId: EstimateId, installerId: string) => void;
  updateEstimateOrderMeta: (clientId: ClientId, estimateId: EstimateId, patch: Record<string, any>) => void;
  updateEstimatePosition: (
    clientId: ClientId,
    estimateId: EstimateId,
    positionId: string,
    patch: {
      positionRef?: string;
      roomName?: string;
      qty?: number;
      widthMm?: number;
      heightMm?: number;
      insertion?: string;
      positionType?: "Window" | "Door";
    }
  ) => void;
  persistEstimateOutcome: (clientId: ClientId, estimateId: EstimateId, outcome: EstimateOutcome) => void;

  accountNoteDraft: string;
  setAccountNoteDraft: (value: string) => void;
  accountNotes: Array<{
    id: string;
    category: "general" | "follow_up" | "service" | "installer" | "client_request";
    noteText: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string | null;
  }>;
  accountNoteCategory: "general" | "follow_up" | "service" | "installer" | "client_request";
  setAccountNoteCategory: React.Dispatch<React.SetStateAction<"general" | "follow_up" | "service" | "installer" | "client_request">>;
  accountNoteFilter: "all" | "general" | "follow_up" | "service" | "installer" | "client_request";
  setAccountNoteFilter: React.Dispatch<React.SetStateAction<"all" | "general" | "follow_up" | "service" | "installer" | "client_request">>;
  accountNoteUpdatedAt: string | null;
  saveAccountNotes: () => void | Promise<void>;

  selectedEstimateNoteId: EstimateId | "";
  setSelectedEstimateNoteId: React.Dispatch<React.SetStateAction<EstimateId | "">>;
  estimateNoteDraft: string;
  setEstimateNoteDraft: (value: string) => void;
  estimateNotes: Array<{
    id: string;
    category: "general" | "follow_up" | "service" | "installer" | "client_request";
    noteText: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string | null;
  }>;
  estimateNoteCategory: "general" | "follow_up" | "service" | "installer" | "client_request";
  setEstimateNoteCategory: React.Dispatch<React.SetStateAction<"general" | "follow_up" | "service" | "installer" | "client_request">>;
  estimateNoteFilter: "all" | "general" | "follow_up" | "service" | "installer" | "client_request";
  setEstimateNoteFilter: React.Dispatch<React.SetStateAction<"all" | "general" | "follow_up" | "service" | "installer" | "client_request">>;
  estimateNoteUpdatedAt: string | null;
  saveEstimateNotes: () => void | Promise<void>;

  notesSaving: boolean;
  activeUserName: string;

  clientFileLabel: string;
  setClientFileLabel: (v: string) => void;
  clientFileUrl: string;
  setClientFileUrl: (v: string) => void;
  clientFileNames: string[];
  setClientFileNames: (v: string[]) => void;
  clientFiles: ClientFile[];
  setClientFiles: React.Dispatch<React.SetStateAction<ClientFile[]>>;
};

function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline";
  disabled?: boolean;
  className?: string;
}) {
  const variantClassName = `ep-button ${variant === "primary" ? "ep-button--primary" : variant === "outline" ? "ep-button--outline" : "ep-button--secondary"}`;
  return (
    <button
      type="button"
      disabled={!!disabled}
      onClick={onClick}
      className={`${variantClassName} ${className}`.trim()}
    >
      {children}
    </button>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { disabled, className = "", ...rest } = props;
  return <input {...rest} className={`ep-shared-input ${className}`.trim()} disabled={disabled} />;
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="ep-pill-base">{children}</span>;
}

function Small({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`ep-small ${className}`.trim()}>{children}</div>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="ep-h3">{children}</h3>;
}

function noteCategoryLabel(category: "general" | "follow_up" | "service" | "installer" | "client_request") {
  if (category === "follow_up") return "Follow Up";
  if (category === "client_request") return "Client Request";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function ensureOrderMeta(e: any) {
  if (!e.orderMeta) {
    e.orderMeta = {
      timeline: createDefaultTimeline(),
    };
  }
}

function stageLabel(stage: string) {
  if (stage === "signoff_sent") return "Sign-off sent";
  if (stage === "signoff_received") return "Sign-off received";
  if (stage === "factory_order") return "Factory order";
  if (stage === "in_production") return "Production start";
  if (stage === "pre_dispatch_invoice") return "Balance due";
  if (stage === "production_complete") return "Production complete";
  if (stage === "factory_dispatch") return "Dispatch";
  if (stage === "delivery") return "Delivery";
  if (stage === "installation") return "Installation";
  return stage;
}

function OrderTimelineBar({ timeline }: { timeline: any[] }) {
  const completedCount = timeline.filter((t) => t.completed).length;
  const percent = timeline.length ? Math.round((completedCount / timeline.length) * 100) : 0;

  return (
    <div className="ep-timeline">
      <div className="ep-timeline-header">
        <div className="ep-timeline-label">Order timeline</div>
        <div className="ep-timeline-label">{completedCount}/{timeline.length} complete ({percent}%)</div>
      </div>
      <progress className="ep-timeline-progress" max={100} value={percent} aria-label="Order timeline progress" />
      <div className="ep-timeline-grid">
        {timeline.map((t, i) => (
          <div key={i} className={`ep-timeline-item ep-timeline-item--${t.completed ? "complete" : "pending"}`}>
            <div className="ep-timeline-item-label">
              {t.completed ? "Complete" : "Pending"}
            </div>
            <div className="ep-timeline-item-stage">{stageLabel(t.stage)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function ClientDetailsReadonly({ c, onEdit }: { c: Client; onEdit: () => void }) {
  const [customerAddressOpen, setCustomerAddressOpen] = useState(false);
  const [invoiceAddressOpen, setInvoiceAddressOpen] = useState(false);

  const customerStructured = resolveStructuredAddress((c as any).customerAddressStructured, (c as any).customerAddress || "");
  const [ca1, ca2, ca3, ct, cc, cco, cp] = addressTuple(customerStructured);

  const invoiceStructured = resolveStructuredAddress(c.invoiceAddressStructured, c.invoiceAddress || "");
  const [i1, i2, i3, it, ic, ico, ip] = addressTuple(invoiceStructured);

  return (
    <div className="ep-pane-card ep-client-details-card">
      <div className="qs-migrated-7">
        <H3>Client contact information</H3>
        <Button variant="secondary" onClick={onEdit}>Edit</Button>
      </div>

      <div className="qs-migrated-8">
        <div className="qs-migrated-9">
          <label className="qs-migrated-10">
            <input type="checkbox" checked={c.type === "Business"} disabled />
            <span className="ep-client-details-checkbox-label">Business customer</span>
          </label>
          <Small>Type: {c.type}</Small>
        </div>

        {c.type === "Business" ? (
          <>
            <div>
              <div className="qs-migrated-243">Business name</div>
              <Input value={c.businessName || c.clientName || ""} onChange={() => {}} disabled />
            </div>
            <div>
              <div className="qs-migrated-243">Contact name</div>
              <Input value={c.contactPerson || ""} onChange={() => {}} disabled />
            </div>
          </>
        ) : (
          <div>
            <div className="qs-migrated-243">Client name</div>
            <Input value={c.clientName || ""} onChange={() => {}} disabled />
          </div>
        )}

        <div className="qs-migrated-13">
          <div>
            <div className="qs-migrated-243">Email</div>
            <Input value={c.email || ""} onChange={() => {}} disabled />
          </div>
          <div>
            <div className="qs-migrated-243">Mobile</div>
            <Input value={c.mobile || ""} onChange={() => {}} disabled />
          </div>
        </div>

        <div>
          <div className="qs-migrated-243">Home</div>
          <Input value={c.home || ""} onChange={() => {}} disabled />
        </div>

        <div className="ep-client-details-section">
          <button
            type="button"
            onClick={() => setCustomerAddressOpen((prev) => !prev)} className="qs-migrated-244"
          >
            <H3>{customerAddressOpen ? "▼" : "▶"} Customer address</H3>
          </button>

          {customerAddressOpen && (
            <div className="qs-migrated-16">
              <div className="qs-migrated-13">
                <div>
                  <div className="qs-migrated-243">Address line 1</div>
                  <Input value={ca1} onChange={() => {}} disabled />
                </div>
                <div>
                  <div className="qs-migrated-243">Address line 2</div>
                  <Input value={ca2} onChange={() => {}} disabled />
                </div>
              </div>

              <div>
                <div className="qs-migrated-243">Address line 3</div>
                <Input value={ca3} onChange={() => {}} disabled />
              </div>

              <div className="qs-migrated-13">
                <div>
                  <div className="qs-migrated-243">Town</div>
                  <Input value={ct} onChange={() => {}} disabled />
                </div>
                <div>
                  <div className="qs-migrated-243">City</div>
                  <Input value={cc} onChange={() => {}} disabled />
                </div>
              </div>

              <div className="qs-migrated-13">
                <div>
                  <div className="qs-migrated-243">County/District</div>
                  <Input value={cco} onChange={() => {}} disabled />
                </div>
                <div>
                  <div className="qs-migrated-243">Postcode</div>
                  <Input value={cp} onChange={() => {}} disabled />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="ep-client-details-section">
          <button
            type="button"
            onClick={() => setInvoiceAddressOpen((prev) => !prev)} className="qs-migrated-244"
          >
            <H3>{invoiceAddressOpen ? "▼" : "▶"} Invoice address</H3>
          </button>

          {invoiceAddressOpen && (
            <div className="qs-migrated-16">
              <div className="qs-migrated-13">
                <div>
                  <div className="qs-migrated-243">Address line 1</div>
                  <Input value={i1} onChange={() => {}} disabled />
                </div>
                <div>
                  <div className="qs-migrated-243">Address line 2</div>
                  <Input value={i2} onChange={() => {}} disabled />
                </div>
              </div>

              <div>
                <div className="qs-migrated-243">Address line 3</div>
                <Input value={i3} onChange={() => {}} disabled />
              </div>

              <div className="qs-migrated-13">
                <div>
                  <div className="qs-migrated-243">Town</div>
                  <Input value={it} onChange={() => {}} disabled />
                </div>
                <div>
                  <div className="qs-migrated-243">City</div>
                  <Input value={ic} onChange={() => {}} disabled />
                </div>
              </div>

              <div className="qs-migrated-13">
                <div>
                  <div className="qs-migrated-243">County/District</div>
                  <Input value={ico} onChange={() => {}} disabled />
                </div>
                <div>
                  <div className="qs-migrated-243">Postcode</div>
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

export default function EstimatePickerTabs(props: Props) {
  const [statusMenuForEstimateId, setStatusMenuForEstimateId] = React.useState<string | null>(null);
  const [selectedOrderForInstallations, setSelectedOrderForInstallations] = useState<string | null>(null);
  const [rankedInstallers, setRankedInstallers] = useState<any[]>([]);
  const [selectedInstallerByEstimateId, setSelectedInstallerByEstimateId] = useState<Record<string, string>>({});

  React.useEffect(() => {
    function onDocClick() {
      setStatusMenuForEstimateId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const {
    estimatePickerTab,
    setEstimatePickerTab,
    pickerClient,
    createEstimateForClient,
    openEditClientPanel,
    openEstimateFromPicker,
    copyEstimateForClient,
    deletedEstimatesForClient,
    deleteEstimatesForClient,
    restoreDeletedEstimatesForClient,
    purgeDeletedEstimatesForClient,
    setEstimateInstaller,
    updateEstimateOrderMeta,
    persistEstimateOutcome,
    accountNoteDraft,
    setAccountNoteDraft,
    accountNotes,
    accountNoteCategory,
    setAccountNoteCategory,
    accountNoteFilter,
    setAccountNoteFilter,
    accountNoteUpdatedAt,
    saveAccountNotes,
    selectedEstimateNoteId,
    setSelectedEstimateNoteId,
    estimateNoteDraft,
    setEstimateNoteDraft,
    estimateNotes,
    estimateNoteCategory,
    setEstimateNoteCategory,
    estimateNoteFilter,
    setEstimateNoteFilter,
    estimateNoteUpdatedAt,
    saveEstimateNotes,
    notesSaving,
    activeUserName,
    clientFileLabel,
    setClientFileLabel,
    clientFileUrl,
    setClientFileUrl,
    clientFileNames,
    setClientFileNames,
    clientFiles,
    setClientFiles,
  } = props;

  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendModalEstimateId, setSendModalEstimateId] = useState<string | null>(null);
  const [sendModalAddFollowUp, setSendModalAddFollowUp] = useState(true);
  const [sendModalFollowUpDays, setSendModalFollowUpDays] = useState(3);
  const [sendModalPhoneCall, setSendModalPhoneCall] = useState(true);
  const [expandedEstimateId, setExpandedEstimateId] = useState<EstimateId | null>(null);
  const [estimateCollectionViewModeByTab, setEstimateCollectionViewModeByTab] = useState<Record<"estimates" | "orders" | "lost", EstimateCollectionViewMode>>(() => ({
    estimates: getPreference(CLIENT_ESTIMATE_PREF_KEYS.viewMode.estimates, "list", isEstimateCollectionViewMode),
    orders: getPreference(CLIENT_ESTIMATE_PREF_KEYS.viewMode.orders, "list", isEstimateCollectionViewMode),
    lost: getPreference(CLIENT_ESTIMATE_PREF_KEYS.viewMode.lost, "list", isEstimateCollectionViewMode),
  }));
  const [estimateSortDirectionByTab, setEstimateSortDirectionByTab] = useState<Record<"estimates" | "orders" | "lost", "asc" | "desc">>(() => ({
    estimates: getPreference(CLIENT_ESTIMATE_PREF_KEYS.sortDirection.estimates, "asc", isSortDirection),
    orders: getPreference(CLIENT_ESTIMATE_PREF_KEYS.sortDirection.orders, "asc", isSortDirection),
    lost: getPreference(CLIENT_ESTIMATE_PREF_KEYS.sortDirection.lost, "asc", isSortDirection),
  }));
  const [estimateCreatorFilterByTab, setEstimateCreatorFilterByTab] = useState<Record<"estimates" | "orders" | "lost", "mine" | "all">>(() => ({
    estimates: getPreference(CLIENT_ESTIMATE_PREF_KEYS.creatorFilter.estimates, "mine", isCreatorFilter),
    orders: getPreference(CLIENT_ESTIMATE_PREF_KEYS.creatorFilter.orders, "mine", isCreatorFilter),
    lost: getPreference(CLIENT_ESTIMATE_PREF_KEYS.creatorFilter.lost, "mine", isCreatorFilter),
  }));
  const [itemPriceByPositionId, setItemPriceByPositionId] = useState<Record<string, string>>({});
  const [supplierEstimateFilesByEstimateId, setSupplierEstimateFilesByEstimateId] = useState<Record<string, string[]>>({});
  const [notesScope, setNotesScope] = useState<"account" | "estimate">("account");

  useEffect(() => {
    if (!props.initialExpandedEstimateId) return;
    setExpandedEstimateId(props.initialExpandedEstimateId);
    props.onConsumedInitialExpandedEstimateId?.();
  }, [props.initialExpandedEstimateId, props.onConsumedInitialExpandedEstimateId]);

  useEffect(() => {
    setExpandedEstimateId(null);
  }, [estimateCreatorFilterByTab]);

  useEffect(() => {
    setPreference(CLIENT_ESTIMATE_PREF_KEYS.viewMode.estimates, estimateCollectionViewModeByTab.estimates);
    setPreference(CLIENT_ESTIMATE_PREF_KEYS.viewMode.orders, estimateCollectionViewModeByTab.orders);
    setPreference(CLIENT_ESTIMATE_PREF_KEYS.viewMode.lost, estimateCollectionViewModeByTab.lost);
  }, [estimateCollectionViewModeByTab]);

  useEffect(() => {
    setPreference(CLIENT_ESTIMATE_PREF_KEYS.sortDirection.estimates, estimateSortDirectionByTab.estimates);
    setPreference(CLIENT_ESTIMATE_PREF_KEYS.sortDirection.orders, estimateSortDirectionByTab.orders);
    setPreference(CLIENT_ESTIMATE_PREF_KEYS.sortDirection.lost, estimateSortDirectionByTab.lost);
  }, [estimateSortDirectionByTab]);

  useEffect(() => {
    setPreference(CLIENT_ESTIMATE_PREF_KEYS.creatorFilter.estimates, estimateCreatorFilterByTab.estimates);
    setPreference(CLIENT_ESTIMATE_PREF_KEYS.creatorFilter.orders, estimateCreatorFilterByTab.orders);
    setPreference(CLIENT_ESTIMATE_PREF_KEYS.creatorFilter.lost, estimateCreatorFilterByTab.lost);
  }, [estimateCreatorFilterByTab]);

  if (!pickerClient) return null;
  const activePickerClient = pickerClient;

  async function apiFetchJson(path: string, options?: RequestInit) {
    const res = await fetch(`http://localhost:3001${path}`, options);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(body || `API request failed: ${res.status}`);
    }
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return res.json();
    }
    return null;
  }

  function formatMeasure(n: number) {
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  }

  function formatMoney(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number.isFinite(n) ? n : 0);
}

      function getFilteredEstimates(outcome: EstimateOutcome) {
    const activeFilter =
      outcome === "Order"
        ? estimateCreatorFilterByTab.orders
        : outcome === "Lost"
          ? estimateCreatorFilterByTab.lost
          : estimateCreatorFilterByTab.estimates;

    return activePickerClient.estimates.filter((e) => {
      if ((((e as any).outcome ?? "Open") as EstimateOutcome) !== outcome) return false;
      if (activeFilter === "all") return true;
      return String(e.createdByUserId || CURRENT_APP_USER.id) === CURRENT_APP_USER.id;
    });
  }

  function sectionCombinedTotals(outcome: EstimateOutcome) {
    const estimates = getFilteredEstimates(outcome);
    if (outcome === "Order") {
      estimates.forEach((e) => ensureOrderMeta(e));
    }
    return estimates.reduce(
      (acc, e) => {
        const totals = estimateTotals(e);
        acc.totalSquareMetres += totals.totalSquareMetres;
        acc.totalLinearMetres += totals.totalLinearMetres;
        acc.totalQty += totals.totalQty;
        acc.totalCost += estimateCostTotal(e, itemPriceByPositionId);
        return acc;
      },
      { totalSquareMetres: 0, totalLinearMetres: 0, totalQty: 0, totalCost: 0 }
    );
  }

  async function openInstallations(e: any, pickerClient: any) {
    setSelectedOrderForInstallations(e.id);

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

    setRankedInstallers(results);
  }

  function installerLabel(installerId: string) {
    const installer = getInstallers().find((x) => x.id === installerId);
    return installer?.companyName ?? installerId;
  }

  function selectInstallerForEstimate(estimateId: EstimateId, installerId: string) {
    setSelectedInstallerByEstimateId((prev) => {
      const next = { ...prev, [estimateId]: installerId };
      return next;
    });
    setEstimateInstaller(activePickerClient.id, estimateId, installerId);
  }

  function setOrderMetaField(estimateId: EstimateId, key: string, value: any) {
    updateEstimateOrderMeta(activePickerClient.id, estimateId, { [key]: value });
  }

  function stageDateValue(e: any, stage: string): string {
    const m = e.orderMeta ?? {};
    if (stage === "signoff_sent") return m.clientSignoffSentDate ?? "";
    if (stage === "signoff_received") return m.clientSignoffReceivedDate ?? "";
    if (stage === "factory_order") return m.factoryOrderSignedOffDate ?? "";
    if (stage === "in_production") return m.productionStartDate ?? "";
    if (stage === "pre_dispatch_invoice") return m.balanceInvoiceDueDate ?? "";
    if (stage === "production_complete") return m.productionCompletedDate ?? m.productionEndDate ?? "";
    if (stage === "factory_dispatch") return m.factoryDispatchDate ?? "";
    if (stage === "delivery") return m.deliveryDate ?? "";
    if (stage === "installation") return m.installationDate ?? "";
    return "";
  }

  function timelineWithCompletion(e: any) {
    const base = e.orderMeta?.timeline ?? [];
    return base.map((t: any) => ({
      ...t,
      completed: !!stageDateValue(e, t.stage),
    }));
  }

  function positionDescription(p: Client["estimates"][number]["positions"][number]) {
    return positionDescriptionForDisplay(p);
  }

  function PositionPreview({ position }: { position: Client["estimates"][number]["positions"][number] }) {
    const contract = getConfiguredPositionContract(position);
    return (
      <div className="qs-migrated-20">
        <div className={`ep-position-glyph ${position.positionType === "Door" ? "ep-position-glyph--door" : "ep-position-glyph--window"}`}>
          <div className="qs-migrated-21" />
          {contract ? <div className="qs-migrated-22">B92</div> : null}
        </div>
      </div>
    );
  }

  function estimateCostLine(e: Client["estimates"][number], p: Client["estimates"][number]["positions"][number]) {
    const raw = itemPriceByPositionId[p.id] ?? String(p.itemPrice ?? "");
    const itemPrice = Number(raw || 0);
    const quantityPrice = (Number.isFinite(itemPrice) ? itemPrice : 0) * Math.max(1, Number(p.qty || 1));
    return { itemPrice, quantityPrice };
  }

  function importSupplierEstimate(estimateId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp";
    input.onchange = () => {
      const names = Array.from(input.files ?? []).map((f) => f.name);
      if (!names.length) return;
      setSupplierEstimateFilesByEstimateId((prev) => ({
        ...prev,
        [estimateId]: [...(prev[estimateId] ?? []), ...names],
      }));
    };
    input.click();
  }

  function confirmDeleteEstimate(estimateId: EstimateId) {
    const estimate = activePickerClient.estimates.find((x) => x.id === estimateId);
    if (!estimate) return;
    const ok = window.confirm(`Send estimate ${estimate.estimateRef} to recycle bin?`);
    if (!ok) return;
    if (expandedEstimateId === estimateId) {
      setExpandedEstimateId(null);
    }
    deleteEstimatesForClient(activePickerClient.id, [estimateId]);
  }

  function renderEstimateSection(
    outcome: EstimateOutcome,
    titleText: string,
    emptyText: string,
    viewKey: "estimates" | "orders" | "lost"
  ) {
    const estimates = [...getFilteredEstimates(outcome)].sort((a, b) => {
      const result = String(a.estimateRef || "").localeCompare(String(b.estimateRef || ""), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return estimateSortDirectionByTab[viewKey] === "asc" ? result : -result;
    });
    if (outcome === "Order") {
      estimates.forEach((e) => ensureOrderMeta(e));
    }
    const sectionTotals = sectionCombinedTotals(outcome);

    return (
      <EstimateSectionTab
        currentTab={estimatePickerTab}
        titleText={titleText}
        emptyText={emptyText}
        estimates={estimates}
        viewMode={estimateCollectionViewModeByTab[viewKey]}
        outcome={outcome}
        sectionTotals={sectionTotals}
        expandedEstimateId={expandedEstimateId}
        setExpandedEstimateId={setExpandedEstimateId}
        statusMenuForEstimateId={statusMenuForEstimateId}
        setStatusMenuForEstimateId={setStatusMenuForEstimateId}
        selectedOrderForInstallations={selectedOrderForInstallations}
        rankedInstallers={rankedInstallers}
        selectedInstallerByEstimateId={selectedInstallerByEstimateId}
        supplierEstimateFilesByEstimateId={supplierEstimateFilesByEstimateId}
        itemPriceByPositionId={itemPriceByPositionId}
        setItemPriceByPositionId={setItemPriceByPositionId}
        formatMeasure={formatMeasure}
        formatMoney={formatMoney}
        pickerClient={pickerClient!}
        activeUserName={activeUserName}
        apiFetchJson={apiFetchJson}
        copyEstimateForClient={copyEstimateForClient}
        confirmDeleteEstimate={confirmDeleteEstimate}
        openEstimateFromPicker={openEstimateFromPicker}
        persistEstimateOutcome={persistEstimateOutcome}
        downloadEstimateWordDocService={downloadEstimateWordDocService}
        printEstimatePdfService={printEstimatePdfService}
        addFollowUpForEstimateService={addFollowUpForEstimateService}
        positionDescription={positionDescription}
        PositionPreview={PositionPreview}
        timelineWithCompletion={timelineWithCompletion}
        openInstallations={openInstallations}
        installerLabel={installerLabel}
        selectInstallerForEstimate={selectInstallerForEstimate}
        setOrderMetaField={setOrderMetaField}
        setSendModalEstimateId={setSendModalEstimateId}
        setSendModalOpen={setSendModalOpen}
        importSupplierEstimate={importSupplierEstimate}
      />
    );
  }

  const totalClientEstimateCount = pickerClient.estimates.length;
  const clientOrderCount = pickerClient.estimates.filter((e) => (((e as any).outcome ?? "Open") as EstimateOutcome) === "Order").length;
  const clientLostCount = pickerClient.estimates.filter((e) => (((e as any).outcome ?? "Open") as EstimateOutcome) === "Lost").length;
  const orderConversionPct = totalClientEstimateCount ? Math.round((clientOrderCount / totalClientEstimateCount) * 100) : 0;
  const lostConversionPct = totalClientEstimateCount ? Math.round((clientLostCount / totalClientEstimateCount) * 100) : 0;

  const sendEmailDraft = sendModalEstimateId ? buildSendEmailTextService({ pickerClient, estimateId: sendModalEstimateId }) : { subject: "", body: "" };

  const filteredAccountNotes = (accountNotes ?? []).filter((note) => accountNoteFilter === "all" || note.category === accountNoteFilter);
  const filteredEstimateNotes = (estimateNotes ?? []).filter((note) => estimateNoteFilter === "all" || note.category === estimateNoteFilter);
  const isEstimateNotesScope = notesScope === "estimate";
  const activeNoteCategory = isEstimateNotesScope ? estimateNoteCategory : accountNoteCategory;
  const activeNoteFilter = isEstimateNotesScope ? estimateNoteFilter : accountNoteFilter;
  const activeNoteDraft = isEstimateNotesScope ? estimateNoteDraft : accountNoteDraft;
  const activeNoteUpdatedAt = isEstimateNotesScope ? estimateNoteUpdatedAt : accountNoteUpdatedAt;
  const activeFilteredNotes = isEstimateNotesScope ? filteredEstimateNotes : filteredAccountNotes;

  return (
    <>
      <div className="qs-migrated-36">
        <div className="ep-tab-list">
          <Button variant={estimatePickerTab === "client_info" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("client_info")}>
            Client Info
          </Button>
          <Button variant={estimatePickerTab === "estimates" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("estimates")}>
            Client Estimates
          </Button>
          <Button variant={estimatePickerTab === "orders" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("orders")}>
            Client Orders
          </Button>
          <Button variant={estimatePickerTab === "lost" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("lost")}>
            Client Lost
          </Button>
          <Button variant={estimatePickerTab === "client_notes" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("client_notes")}>
            Client Notes
          </Button>
          <Button variant={estimatePickerTab === "files" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("files")}>
            Files
          </Button>
        </div>

        {(estimatePickerTab === "estimates" || estimatePickerTab === "orders" || estimatePickerTab === "lost") && (
          <ControlToolbar>
            {estimatePickerTab === "estimates" ? <ControlToolbarGroup label="Create"><Button variant="primary" onClick={() => createEstimateForClient(pickerClient)}>+ New Estimate</Button><Button variant="secondary" onClick={() => createEstimateForClient(pickerClient, { openManufacturerImport: true })}>Import Manufacturer Quote</Button></ControlToolbarGroup> : null}
            <ControlToolbarGroup label="Scope">
              <Button
                variant={estimateCreatorFilterByTab[estimatePickerTab] === "mine" ? "primary" : "secondary"}
                onClick={() =>
                  setEstimateCreatorFilterByTab((prev) => ({ ...prev, [estimatePickerTab]: "mine" }))
                }
              >
                My {estimatePickerTab === "orders" ? "Orders" : estimatePickerTab === "lost" ? "Lost" : "Estimates"}
              </Button>
              <Button
                variant={estimateCreatorFilterByTab[estimatePickerTab] === "all" ? "primary" : "secondary"}
                onClick={() =>
                  setEstimateCreatorFilterByTab((prev) => ({ ...prev, [estimatePickerTab]: "all" }))
                }
              >
                All {estimatePickerTab === "orders" ? "Orders" : estimatePickerTab === "lost" ? "Lost" : "Estimates"}
              </Button>
            </ControlToolbarGroup>

            <ControlToolbarGroup label="View">
              <Button
                variant={estimateCollectionViewModeByTab[estimatePickerTab] === "list" ? "primary" : "secondary"}
                onClick={() =>
                  setEstimateCollectionViewModeByTab((prev) => ({ ...prev, [estimatePickerTab]: "list" }))
                }
              >
                List
              </Button>
              <Button
                variant={estimateCollectionViewModeByTab[estimatePickerTab] === "grid" ? "primary" : "secondary"}
                onClick={() =>
                  setEstimateCollectionViewModeByTab((prev) => ({ ...prev, [estimatePickerTab]: "grid" }))
                }
              >
                Grid
              </Button>
            </ControlToolbarGroup>

            <ControlToolbarGroup label="Sort by">
              <Button
                variant={estimateSortDirectionByTab[estimatePickerTab] === "asc" ? "primary" : "secondary"}
                onClick={() =>
                  setEstimateSortDirectionByTab((prev) => ({ ...prev, [estimatePickerTab]: "asc" }))
                }
              >
                Ascending
              </Button>
              <Button
                variant={estimateSortDirectionByTab[estimatePickerTab] === "desc" ? "primary" : "secondary"}
                onClick={() =>
                  setEstimateSortDirectionByTab((prev) => ({ ...prev, [estimatePickerTab]: "desc" }))
                }
              >
                Descending
              </Button>
            </ControlToolbarGroup>
          </ControlToolbar>
        )}
      </div>

      <div className="ep-stats-grid">
        <div className="ep-stat-card">
          <div className="ep-stat-label">Client Estimates</div>
          <div className="ep-stat-value">{totalClientEstimateCount}</div>
          <Small>Total estimates created for this client.</Small>
        </div>
        <div className="ep-stat-card">
          <div className="ep-stat-label">Orders Conversion</div>
          <div className="ep-stat-value">{orderConversionPct}%</div>
          <Small>{clientOrderCount} of {totalClientEstimateCount} marked as Order.</Small>
        </div>
        <div className="ep-stat-card">
          <div className="ep-stat-label">Lost Conversion</div>
          <div className="ep-stat-value">{lostConversionPct}%</div>
          <Small>{clientLostCount} of {totalClientEstimateCount} marked as Lost.</Small>
        </div>
      </div>

      {estimatePickerTab === "client_info" && (
        <ClientInfoTab
          pickerClient={pickerClient}
          openEditClientPanel={openEditClientPanel}
        />
      )}

      {estimatePickerTab === "estimates" && renderEstimateSection("Open", "Client Estimates", "No open estimates yet.", "estimates")}
      {estimatePickerTab === "orders" && renderEstimateSection("Order", "Client Orders", "No orders yet. Mark an estimate as \"Order\" in the Client Estimates tab.", "orders")}
      {estimatePickerTab === "lost" && renderEstimateSection("Lost", "Client Lost", "No lost estimates yet. Mark an estimate as \"Lost\" in the Client Estimates tab.", "lost")}

      {estimatePickerTab === "client_notes" && (
        <NotesTab
          pickerClient={pickerClient}
          notesScope={notesScope}
          setNotesScope={setNotesScope}
          accountNotes={accountNotes}
          accountNoteFilter={accountNoteFilter}
          setAccountNoteFilter={setAccountNoteFilter}
          accountNoteCategory={accountNoteCategory}
          setAccountNoteCategory={setAccountNoteCategory}
          accountNoteDraft={accountNoteDraft}
          setAccountNoteDraft={setAccountNoteDraft}
          accountNoteUpdatedAt={accountNoteUpdatedAt}
          selectedEstimateNoteId={selectedEstimateNoteId}
          setSelectedEstimateNoteId={setSelectedEstimateNoteId}
          estimateNotes={estimateNotes}
          estimateNoteFilter={estimateNoteFilter}
          setEstimateNoteFilter={setEstimateNoteFilter}
          estimateNoteCategory={estimateNoteCategory}
          setEstimateNoteCategory={setEstimateNoteCategory}
          estimateNoteDraft={estimateNoteDraft}
          setEstimateNoteDraft={setEstimateNoteDraft}
          estimateNoteUpdatedAt={estimateNoteUpdatedAt}
          notesSaving={notesSaving}
          saveAccountNotes={saveAccountNotes}
          saveEstimateNotes={saveEstimateNotes}
        />
      )}

      {estimatePickerTab === "files" && (
        <FilesTab
          clientFileLabel={clientFileLabel}
          setClientFileLabel={setClientFileLabel}
          clientFileUrl={clientFileUrl}
          setClientFileUrl={setClientFileUrl}
          clientFileNames={clientFileNames}
          setClientFileNames={setClientFileNames}
          clientFiles={clientFiles}
          setClientFiles={setClientFiles}
          activeUserName={activeUserName}
        />
      )}

      {sendModalOpen && sendModalEstimateId && (
        <div className="qs-migrated-245"
        >
          <div className="ep-send-modal-card">
            <div className="ep-send-modal-header">
              <div>
                <div className="ep-send-modal-title">Send estimate</div>
                <div className="ep-send-modal-meta">
                  {pickerClient.clientName} • {(pickerClient as any).clientRef ?? ""} •{" "}
                  {pickerClient.estimates.find((x) => x.id === sendModalEstimateId)?.estimateRef ?? ""}
                </div>
              </div>

              <div className="ep-send-modal-close">
                <Button variant="outline" onClick={() => setSendModalOpen(false)}>
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
                    <input
                      className="ep-send-input"
                      value={sendEmailDraft.subject}
                      readOnly
                    />
                  </div>

                  <div className="ep-send-field">
                    <Small>Body</Small>
                    <textarea
                      className="ep-send-textarea"
                      value={sendEmailDraft.body}
                      readOnly
                      rows={8}
                    />
                  </div>

                  <div className="ep-send-inline-actions">
                    <Button
                      variant="outline"
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

                    <Button variant="primary" onClick={() => openMailClientService((pickerClient as any)?.email ?? "", sendEmailDraft.subject, sendEmailDraft.body)}>
                      Open email app
                    </Button>
                  </div>

                  <Small className="qs-migrated-82">
                    Create the customer document from Estimate → Project Costing → Customer Quotation before attaching it in your email app. Direct file attachment from this transitional send flow is not wired yet.
                  </Small>
                </div>
              </div>

              <div className="ep-send-section">
                <div className="ep-send-section-title">Add follow up</div>

                <div className="ep-send-stack qs-migrated-83">
                  <label className="ep-send-checkbox">
                    <input type="checkbox" checked={sendModalAddFollowUp} onChange={(e) => setSendModalAddFollowUp(e.currentTarget.checked)} />
                    <span className="ep-send-checkbox-text">
                      Create follow-up (default {sendModalFollowUpDays} days / 72 hours)
                    </span>
                  </label>

                  <div className="ep-send-inline-row">
                    <Small>Follow up in (days)</Small>
                    <input
                      className="ep-send-input ep-send-input--days"
                      type="number"
                      min={0}
                      value={sendModalFollowUpDays}
                      onChange={(e) => setSendModalFollowUpDays(Math.max(0, Number(e.currentTarget.value || 0)))}
                    />

                    <label className="ep-send-checkbox">
                      <input type="checkbox" checked={sendModalPhoneCall} onChange={(e) => setSendModalPhoneCall(e.currentTarget.checked)} />
                      <span className="ep-send-checkbox-text">Telephone call</span>
                    </label>
                  </div>

                  <Small className="qs-migrated-82">
                    Follow-ups are saved to the database and appear in Customers - Follow Ups on the scheduled due date.
                  </Small>
                </div>
              </div>

              <div className="ep-send-footer">
                <Button variant="outline" onClick={() => setSendModalOpen(false)}>
                  Cancel
                </Button>

                <Button
                  variant="primary"
                  onClick={() => {
                    openMailClientService((pickerClient as any)?.email ?? "", sendEmailDraft.subject, sendEmailDraft.body);
                    if (sendModalAddFollowUp) {
                      addFollowUpForEstimateService({ pickerClient, estimateId: sendModalEstimateId, opts: {
                        days: sendModalFollowUpDays,
                        sendEmail: true,
                        needsCall: sendModalPhoneCall,
                      }, apiFetchJson, activeUserName, alertFn: alert, logError: console.error });
                    }
                    setSendModalOpen(false);
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


