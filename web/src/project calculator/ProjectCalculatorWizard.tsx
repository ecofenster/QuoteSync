import React, { useEffect, useMemo, useRef, useState } from "react";

type CurrencyCode = string;
type ItemBreakdown = {
  windows: number;
  doors: number;
  slidingBelow2_5m: number;
  slidingAbove2_5m: number;
  bifoldingDoors: number;
  glassFacades: number;
  other: number;
};
type ExtraLine = { id: string; name: string; costStr: string; markupPctStr?: string };
type SupplyRow = { id: string; item: string; quantityStr: string; itemPriceStr: string };
type PlaceResult = { id: string; name: string; distanceKm: number; url: string; estGBP: number };

type SavedCalculatorEntry = {
  id: string;
  savedAt: string;
  name: string;
  data: CalculatorState;
  snapshot: {
    liveRate: number | null;
    recommendedLock: number | null;
    lockedFx: number;
    grandTotal: number;
    currency: string;
  };
};

type CalculatorState = {
  supplier: string;
  suppliers: string[];
  currency: CurrencyCode;
  customCurrency: string;
  listPriceStr: string;
  supplyRows: SupplyRow[];
  fxRateStr: string;
  manualFxOverride: boolean;
  globalMarkupPctStr: string;
  baseDiscountEnabled: boolean;
  baseDiscountPctStr: string;
  minOrderFeeStr: string;
  hasExtras: boolean;
  extras: ExtraLine[];
  deliveryStr: string;
  importFeesStr: string;
  designFeesStr: string;
  withInstallation: boolean;
  buildType: "new" | "refurb";
  installMarkupDefaultPctStr: string;
  installCustomMarkups: boolean;
  installMarkupPerCat: Record<string, string>;
  markUpCallOut: boolean;
  itemsStr: Record<keyof ItemBreakdown, string>;
  sitePostcode: string;
  lodgingRateStr: string;
  operatingCostsStr: string;
  hotelResults: PlaceResult[];
  airbnbResults: PlaceResult[];
};

type Props = {
  storageKey?: string;
  estimateRef?: string;
  clientName?: string;
};


const COMMON_CURRENCIES = [
  { code: "EUR", label: "Euros (EUR)", symbol: "€" },
  { code: "GBP", label: "Pounds (GBP)", symbol: "£" },
  { code: "SEK", label: "Swedish Krona (SEK)", symbol: "kr" },
  { code: "USD", label: "US Dollar (USD)", symbol: "$" },
  { code: "PLN", label: "Polish Złoty (PLN)", symbol: "zł" },
  { code: "CHF", label: "Swiss Franc (CHF)", symbol: "Fr" },
  { code: "NOK", label: "Norwegian Krone (NOK)", symbol: "kr" },
  { code: "DKK", label: "Danish Krone (DKK)", symbol: "kr" },
] as const;

const DEFAULT_ADMIN = {
  newBuild: { window: 120, door: 160, slidingDoorBelow2_5m: 220, slidingDoorAbove2_5m: 300, bifoldingDoor: 340, glassFacade: 420, other: 100 },
  refurb: { window: 150, door: 190, slidingDoorBelow2_5m: 260, slidingDoorAbove2_5m: 360, bifoldingDoor: 390, glassFacade: 480, other: 120 },
  callOutFee: 95,
};

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function toNum(s: string) {
  const n = parseFloat((s || "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function toInt(s: string) {
  const n = parseInt((s || "").replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function fmtGBP(v: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(
    Number.isFinite(v) ? v : 0
  );
}

function fmtEnteredCurrency(v: number, symbol: string) {
  return `${symbol}${(Number.isFinite(v) ? v : 0).toFixed(2)}`;
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function safeFetchJSON(url: string, label: string) {
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`${label} error ${res.status}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON`);
  }
}

function calcInstallSubtotal(buildType: "new" | "refurb", items: ItemBreakdown) {
  const r = buildType === "new" ? DEFAULT_ADMIN.newBuild : DEFAULT_ADMIN.refurb;
  return {
    window: (items.windows || 0) * (r.window || 0),
    door: (items.doors || 0) * (r.door || 0),
    slidingDoorBelow2_5m: (items.slidingBelow2_5m || 0) * (r.slidingDoorBelow2_5m || 0),
    slidingDoorAbove2_5m: (items.slidingAbove2_5m || 0) * (r.slidingDoorAbove2_5m || 0),
    bifoldingDoor: (items.bifoldingDoors || 0) * (r.bifoldingDoor || 0),
    glassFacade: (items.glassFacades || 0) * (r.glassFacade || 0),
    other: (items.other || 0) * (r.other || 0),
  };
}

function cardStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    borderRadius: 16,
    border: "1px solid #e4e4e7",
    background: "#fff",
    padding: 16,
    ...extra,
  };
}

function sectionCardStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    borderRadius: 20,
    border: "1px solid #e4e4e7",
    background: "#fff",
    boxShadow: "0 1px 2px rgba(0,0,0,.06)",
    ...extra,
  };
}

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: 12,
    border: "1px solid #d4d4d8",
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    ...extra,
  };
}

function labelStyle(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 800, color: "#3f3f46", marginBottom: 6, display: "block" };
}

function buttonStyle(primary = false, disabled = false): React.CSSProperties {
  return {
    borderRadius: 14,
    border: primary ? "none" : "1px solid #d4d4d8",
    background: primary ? "#18181b" : "#fff",
    color: primary ? "#fff" : "#18181b",
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}

function ghostButtonStyle(disabled = false): React.CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid #e4e4e7",
    background: "#fff",
    color: "#18181b",
    padding: "8px 10px",
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}

function ProgressDots({ steps, activeIndex }: { steps: string[]; activeIndex: number }) {
  return (
    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      {steps.map((title, i) => (
        <div key={title} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: i <= activeIndex ? "#18181b" : "#d4d4d8",
            }}
          />
          <span style={{ fontSize: 12, fontWeight: i === activeIndex ? 800 : 500, color: i === activeIndex ? "#18181b" : "#71717a" }}>
            {title}
          </span>
          {i < steps.length - 1 && <div style={{ width: 24, height: 1, background: "#d4d4d8" }} />}
        </div>
      ))}
    </div>
  );
}

function StepShell({ children }: { children: React.ReactNode }) {
  return <div style={{ ...sectionCardStyle(), padding: 24 }}>{children}</div>;
}

function NumericField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={labelStyle()}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))} style={inputStyle()} inputMode="numeric" />
    </div>
  );
}

export default function ProjectCalculatorWizard({ storageKey = "quotesync.projectCalculator.default", estimateRef = "Estimate", clientName = "" }: Props) {
  const [step, setStep] = useState(0);
  const summaryRef = useRef<HTMLTextAreaElement | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const HISTORY_LIMIT = 25;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedEntries, setSavedEntries] = useState<SavedCalculatorEntry[]>([]);
  const [isLockedFromHistory, setIsLockedFromHistory] = useState(false);
  const [historyWarningDismissed, setHistoryWarningDismissed] = useState(false);
  const [loadedEntryId, setLoadedEntryId] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<string[]>(["Eko Okna", "Gutmann", "Vida International", "Zyle Fenster"]);
  const [supplier, setSupplier] = useState<string>("Eko Okna");
  const [newSupplier, setNewSupplier] = useState("");

  const [currency, setCurrency] = useState<CurrencyCode>("EUR");
  const [customCurrency, setCustomCurrency] = useState("");
  const displayCurrency: CurrencyCode = customCurrency || currency;
  const currencySymbol = useMemo(() => COMMON_CURRENCIES.find((c) => c.code === displayCurrency)?.symbol || `${displayCurrency} `, [displayCurrency]);

  const [listPriceStr, setListPriceStr] = useState("");
  const [supplyRows, setSupplyRows] = useState<SupplyRow[]>([{ id: uid(), item: "", quantityStr: "1", itemPriceStr: "" }]);
  const [fxRateStr, setFxRateStr] = useState("");
  const [manualFxOverride, setManualFxOverride] = useState(false);
  const [liveRate, setLiveRate] = useState<number | null>(null);
  const [liveRateSource, setLiveRateSource] = useState("");
  const [liveRateUpdated, setLiveRateUpdated] = useState("");
  const [liveRateError, setLiveRateError] = useState("");

  const [globalMarkupPctStr, setGlobalMarkupPctStr] = useState("35");
  const [baseDiscountEnabled, setBaseDiscountEnabled] = useState(false);
  const [baseDiscountPctStr, setBaseDiscountPctStr] = useState("0");

  const MIN_ORDER_THRESHOLD_GBP = 4000;
  const [minOrderFeeStr, setMinOrderFeeStr] = useState("600");

  const [hasExtras, setHasExtras] = useState(false);
  const [extras, setExtras] = useState<ExtraLine[]>([]);

  const [deliveryStr, setDeliveryStr] = useState("");
  const [importFeesStr, setImportFeesStr] = useState("");
  const [designFeesStr, setDesignFeesStr] = useState("");

  const [withInstallation, setWithInstallation] = useState(false);
  const [buildType, setBuildType] = useState<"new" | "refurb">("new");
  const [installMarkupDefaultPctStr, setInstallMarkupDefaultPctStr] = useState("35");
  const [installCustomMarkups, setInstallCustomMarkups] = useState(false);
  const [installMarkupPerCat, setInstallMarkupPerCat] = useState<Record<string, string>>({
    window: "35",
    door: "35",
    slidingDoorBelow2_5m: "35",
    slidingDoorAbove2_5m: "35",
    bifoldingDoor: "35",
    glassFacade: "35",
    other: "35",
    callOutFee: "35",
  });
  const [markUpCallOut, setMarkUpCallOut] = useState(true);

  const [itemsStr, setItemsStr] = useState<Record<keyof ItemBreakdown, string>>({
    windows: "0",
    doors: "0",
    slidingBelow2_5m: "0",
    slidingAbove2_5m: "0",
    bifoldingDoors: "0",
    glassFacades: "0",
    other: "0",
  });

  const [sitePostcode, setSitePostcode] = useState("");
  const [lodgingRateStr, setLodgingRateStr] = useState("85");
  const [operatingCostsStr, setOperatingCostsStr] = useState("0");
  const [hotelResults, setHotelResults] = useState<PlaceResult[]>([]);
  const [airbnbResults, setAirbnbResults] = useState<PlaceResult[]>([]);
  const [lodgingLoading, setLodgingLoading] = useState(false);
  const [lodgingError, setLodgingError] = useState("");

  function loadHistory(): SavedCalculatorEntry[] {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  useEffect(() => {
    setSavedEntries(loadHistory());
  }, [storageKey]);

  const steps = [
    { key: "currency", title: "Supply Only Price & currency" },
    { key: "extras", title: "Extras (optional)" },
    { key: "delivery", title: "Delivery cost" },
    { key: "import", title: "Import duties & fees" },
    { key: "design", title: "Design fees (optional)" },
    { key: "install", title: "Supply-only or Installation" },
    { key: "items", title: "Item breakdown from estimate" },
    { key: "review", title: "Summary (GBP)" },
  ] as const;
  const stepKey = steps[step].key;

  const recommendedLock = useMemo(() => (liveRate == null ? null : +(Math.floor(liveRate * 100) / 100 + 0.02).toFixed(2)), [liveRate]);

  const toGBP = useMemo(() => {
    if (displayCurrency === "GBP") return (n: number) => n;
    const activeRate = manualFxOverride ? (toNum(fxRateStr) || 0) : (liveRate ?? 0);
    return (n: number) => n * activeRate;
  }, [displayCurrency, fxRateStr, manualFxOverride, liveRate]);

  useEffect(() => {
    if (displayCurrency === "GBP") {
      setLiveRate(null);
      setLiveRateSource("");
      setLiveRateUpdated("");
      setLiveRateError("");
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchOnce = async () => {
      setLiveRateError("");
      const tries = [
        async () => {
          const j = await safeFetchJSON(`https://api.frankfurter.app/latest?from=${displayCurrency}&to=GBP`, "frankfurter");
          return { live: j?.rates?.GBP as number, source: "frankfurter.app", updated: j?.date || "" };
        },
        async () => {
          const j = await safeFetchJSON(`https://api.exchangerate.host/convert?from=${displayCurrency}&to=GBP&amount=1`, "exchangerate.host");
          return { live: j?.result as number, source: "exchangerate.host", updated: j?.date || "" };
        },
      ];

      for (const fn of tries) {
        try {
          const { live, source, updated } = await fn();
          if (active && typeof live === "number" && isFinite(live)) {
            setLiveRate(live);
            setLiveRateSource(source);
            setLiveRateUpdated(updated);
            if (!manualFxOverride) setFxRateStr(String(+(Math.floor(live * 100) / 100 + 0.02).toFixed(2)));
          }
          return;
        } catch {
          // try next
        }
      }

      if (active) setLiveRateError("Unable to fetch live rate");
    };

    fetchOnce();
    timer = setInterval(fetchOnce, 60000);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [displayCurrency, manualFxOverride]);

  const supplyRowsComputed = useMemo(
    () =>
      supplyRows.map((row) => {
        const quantity = Math.max(0, toInt(row.quantityStr || "0"));
        const itemPriceEntered = toNum(row.itemPriceStr);
        const quantityPriceEntered = quantity * itemPriceEntered;
        const itemPriceGBP = toGBP(itemPriceEntered);
        const quantityPriceGBP = toGBP(quantityPriceEntered);
        const markupPct = toNum(globalMarkupPctStr);
        const markupMultiplier = 1 + markupPct / 100;
        const itemClientPriceGBP = itemPriceGBP * markupMultiplier;
        const quantityClientPriceGBP = quantityPriceGBP * markupMultiplier;
        return {
          ...row,
          quantity,
          itemPriceEntered,
          quantityPriceEntered,
          itemPriceGBP,
          quantityPriceGBP,
          itemClientPriceGBP,
          quantityClientPriceGBP,
        };
      }),
    [supplyRows, toGBP, globalMarkupPctStr]
  );

  useEffect(() => {
    const last = supplyRows[supplyRows.length - 1];
    if (!last) return;
    const complete = (last.item || "").trim() !== "" && toInt(last.quantityStr || "0") > 0 && toNum(last.itemPriceStr || "0") > 0;
    if (!complete) return;
    const emptyExists = supplyRows.some((r) => (r.item || "").trim() === "" && toInt(r.quantityStr || "0") === 0 && toNum(r.itemPriceStr || "0") === 0);
    if (emptyExists) return;
    setSupplyRows((rows) => [...rows, { id: uid(), item: "", quantityStr: "1", itemPriceStr: "" }]);
  }, [supplyRows]);

  const populatedSupplyRows = useMemo(
    () => supplyRowsComputed.filter((row) => (row.item || "").trim() !== "" && row.quantity > 0 && row.itemPriceEntered > 0),
    [supplyRowsComputed]
  );
  const supplyRowsSubtotalEntered = useMemo(() => populatedSupplyRows.reduce((sum, row) => sum + row.quantityPriceEntered, 0), [populatedSupplyRows]);
  const clientSupplyListSubtotalGBP = useMemo(() => populatedSupplyRows.reduce((sum, row) => sum + row.quantityClientPriceGBP, 0), [populatedSupplyRows]);
  const fixedListPriceGBP = useMemo(() => toGBP(toNum(listPriceStr)), [toGBP, listPriceStr]);
  const listPriceGBP = fixedListPriceGBP;

  const appliesMinFee = listPriceGBP > 0 && listPriceGBP < MIN_ORDER_THRESHOLD_GBP;
  const appliedMinFee = appliesMinFee ? toNum(minOrderFeeStr) : 0;
  const supplyOnlyPriceGBPNet = listPriceGBP + appliedMinFee;
  const supplyAfterDiscount = supplyOnlyPriceGBPNet * (1 - (baseDiscountEnabled ? toNum(baseDiscountPctStr) : 0) / 100);
  const supplyOnlyPriceWithMarkup = supplyAfterDiscount * (1 + toNum(globalMarkupPctStr) / 100);
  const fixedListEstimatedProfitGBP = supplyOnlyPriceWithMarkup - fixedListPriceGBP;

  const fixedListPriceEntered = useMemo(() => toNum(listPriceStr), [listPriceStr]);
  const supplyListEnteredMismatch = populatedSupplyRows.length > 0 && Math.abs(supplyRowsSubtotalEntered - fixedListPriceEntered) > 0.01;
  const supplyListMismatch = populatedSupplyRows.length > 0 && Math.abs(clientSupplyListSubtotalGBP - supplyOnlyPriceWithMarkup) > 0.01;

  const extrasGBPPerLine = useMemo(() => extras.map((e) => toGBP(toNum(e.costStr))), [extras, toGBP]);
  const extrasWithMarkupTotal = useMemo(
    () =>
      extras.reduce((sum, e, i) => sum + (extrasGBPPerLine[i] || 0) * (1 + toNum(e.markupPctStr || globalMarkupPctStr) / 100), 0),
    [extras, extrasGBPPerLine, globalMarkupPctStr]
  );
  const extrasCostTotalGBP = useMemo(() => extrasGBPPerLine.reduce((a, b) => a + (b || 0), 0), [extrasGBPPerLine]);
  const deliveryGBP = useMemo(() => toGBP(toNum(deliveryStr)), [toGBP, deliveryStr]);
  const importGBP = useMemo(() => toGBP(toNum(importFeesStr)), [toGBP, importFeesStr]);
  const designGBP = useMemo(() => toGBP(toNum(designFeesStr)), [toGBP, designFeesStr]);

  const items: ItemBreakdown = {
    windows: toInt(itemsStr.windows),
    doors: toInt(itemsStr.doors),
    slidingBelow2_5m: toInt(itemsStr.slidingBelow2_5m),
    slidingAbove2_5m: toInt(itemsStr.slidingAbove2_5m),
    bifoldingDoors: toInt(itemsStr.bifoldingDoors),
    glassFacades: toInt(itemsStr.glassFacades),
    other: toInt(itemsStr.other),
  };
  const totalItems = Object.values(items).reduce((a, b) => a + (b || 0), 0);

  const installParts = useMemo(() => calcInstallSubtotal(buildType, items), [buildType, items]);
  const installRawSubtotalGBP = useMemo(
    () =>
      installParts.window +
      installParts.door +
      installParts.slidingDoorBelow2_5m +
      installParts.slidingDoorAbove2_5m +
      installParts.bifoldingDoor +
      installParts.glassFacade +
      installParts.other +
      DEFAULT_ADMIN.callOutFee,
    [installParts]
  );

  const installWithMarkup = useMemo(() => {
    if (!withInstallation) return 0;
    const pctFor = (cat: string) => (installCustomMarkups ? Number(installMarkupPerCat[cat] || installMarkupDefaultPctStr) : Number(installMarkupDefaultPctStr)) / 100;
    const callOut = markUpCallOut ? DEFAULT_ADMIN.callOutFee * (1 + pctFor("callOutFee")) : DEFAULT_ADMIN.callOutFee;
    return (
      installParts.window * (1 + pctFor("window")) +
      installParts.door * (1 + pctFor("door")) +
      installParts.slidingDoorBelow2_5m * (1 + pctFor("slidingDoorBelow2_5m")) +
      installParts.slidingDoorAbove2_5m * (1 + pctFor("slidingDoorAbove2_5m")) +
      installParts.bifoldingDoor * (1 + pctFor("bifoldingDoor")) +
      installParts.glassFacade * (1 + pctFor("glassFacade")) +
      installParts.other * (1 + pctFor("other")) +
      callOut
    );
  }, [withInstallation, installCustomMarkups, installMarkupPerCat, installMarkupDefaultPctStr, markUpCallOut, installParts]);

  const supplyGrossGBP = supplyOnlyPriceWithMarkup - supplyAfterDiscount;
  const extrasGrossGBP = extrasWithMarkupTotal - extrasCostTotalGBP;
  const installGrossGBP = withInstallation ? installWithMarkup - installRawSubtotalGBP : 0;
  const totalGrossGBP = supplyGrossGBP + extrasGrossGBP + installGrossGBP;
  const operatingCostsGBP = useMemo(() => toNum(operatingCostsStr), [operatingCostsStr]);
  const netProfitGBP = totalGrossGBP - operatingCostsGBP;
  const grandTotal = supplyOnlyPriceWithMarkup + extrasWithMarkupTotal + deliveryGBP + importGBP + designGBP + (withInstallation ? installWithMarkup : 0);

  const canNext = useMemo(() => {
    if (stepKey === "currency") {
      if (displayCurrency === "GBP") return listPriceGBP > 0;
      return listPriceGBP > 0 && toNum(fxRateStr) > 0;
    }
    return true;
  }, [stepKey, displayCurrency, listPriceGBP, fxRateStr]);


  const currentState = useMemo<CalculatorState>(
    () => ({
      supplier,
      suppliers,
      currency,
      customCurrency,
      listPriceStr,
      supplyRows,
      fxRateStr,
      manualFxOverride,
      globalMarkupPctStr,
      baseDiscountEnabled,
      baseDiscountPctStr,
      minOrderFeeStr,
      hasExtras,
      extras,
      deliveryStr,
      importFeesStr,
      designFeesStr,
      withInstallation,
      buildType,
      installMarkupDefaultPctStr,
      installCustomMarkups,
      installMarkupPerCat,
      markUpCallOut,
      itemsStr,
      sitePostcode,
      lodgingRateStr,
      operatingCostsStr,
      hotelResults,
      airbnbResults,
    }),
    [
      supplier, suppliers, currency, customCurrency, listPriceStr, supplyRows, fxRateStr, manualFxOverride,
      globalMarkupPctStr, baseDiscountEnabled, baseDiscountPctStr, minOrderFeeStr, hasExtras, extras,
      deliveryStr, importFeesStr, designFeesStr, withInstallation, buildType, installMarkupDefaultPctStr,
      installCustomMarkups, installMarkupPerCat, markUpCallOut, itemsStr, sitePostcode, lodgingRateStr,
      operatingCostsStr, hotelResults, airbnbResults
    ]
  );

  function applyCalculatorState(state: CalculatorState) {
    setSupplier(state.supplier);
    setSuppliers(state.suppliers?.length ? state.suppliers : suppliers);
    setCurrency(state.currency);
    setCustomCurrency(state.customCurrency);
    setListPriceStr(state.listPriceStr);
    setSupplyRows(state.supplyRows?.length ? state.supplyRows : [{ id: uid(), item: "", quantityStr: "1", itemPriceStr: "" }]);
    setFxRateStr(state.fxRateStr);
    setManualFxOverride(state.manualFxOverride);
    setGlobalMarkupPctStr(state.globalMarkupPctStr);
    setBaseDiscountEnabled(state.baseDiscountEnabled);
    setBaseDiscountPctStr(state.baseDiscountPctStr);
    setMinOrderFeeStr(state.minOrderFeeStr);
    setHasExtras(state.hasExtras);
    setExtras(state.extras ?? []);
    setDeliveryStr(state.deliveryStr);
    setImportFeesStr(state.importFeesStr);
    setDesignFeesStr(state.designFeesStr);
    setWithInstallation(state.withInstallation);
    setBuildType(state.buildType);
    setInstallMarkupDefaultPctStr(state.installMarkupDefaultPctStr);
    setInstallCustomMarkups(state.installCustomMarkups);
    setInstallMarkupPerCat(state.installMarkupPerCat);
    setMarkUpCallOut(state.markUpCallOut);
    setItemsStr(state.itemsStr);
    setSitePostcode(state.sitePostcode);
    setLodgingRateStr(state.lodgingRateStr);
    setOperatingCostsStr(state.operatingCostsStr);
    setHotelResults(state.hotelResults ?? []);
    setAirbnbResults(state.airbnbResults ?? []);
  }

  function persistEntries(next: SavedCalculatorEntry[]) {
    setSavedEntries(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  }

  function saveCalculator() {
    const entry: SavedCalculatorEntry = {
      id: uid(),
      savedAt: new Date().toISOString(),
      name: saveName.trim() || `${estimateRef} ${new Date().toLocaleString("en-GB")}`,
      data: currentState,
      snapshot: {
        liveRate,
        recommendedLock,
        lockedFx: toNum(fxRateStr),
        grandTotal,
        currency: displayCurrency,
      },
    };
    persistEntries([entry, ...savedEntries].slice(0, HISTORY_LIMIT));
    setLoadedEntryId(entry.id);
    setIsLockedFromHistory(true);
    setHistoryWarningDismissed(false);
  }

  function loadSavedCalculator(entry: SavedCalculatorEntry) {
    applyCalculatorState(entry.data);
    setLoadedEntryId(entry.id);
    setIsLockedFromHistory(true);
    setHistoryWarningDismissed(false);
    setHistoryOpen(false);
  }

  function editSavedCalculator() {
    setIsLockedFromHistory(false);
    setHistoryWarningDismissed(false);
  }

  function dismissHistoryWarning() {
    setHistoryWarningDismissed(true);
  }

  function deleteSavedCalculator(entryId: string) {
    persistEntries(savedEntries.filter((x) => x.id !== entryId));
    if (loadedEntryId === entryId) {
      setLoadedEntryId(null);
      setIsLockedFromHistory(false);
      setHistoryWarningDismissed(false);
    }
  }

  const loadedEntry = useMemo(() => savedEntries.find((x) => x.id === loadedEntryId) ?? null, [savedEntries, loadedEntryId]);
  const savedPriceChanged = useMemo(() => {
    if (!loadedEntry) return false;
    const currentLocked = toNum(fxRateStr);
    const savedLocked = loadedEntry.snapshot.lockedFx;
    const currentTotal = grandTotal;
    const savedTotal = loadedEntry.snapshot.grandTotal;
    if (Math.abs(currentLocked - savedLocked) > 0.0001) return true;
    if (Math.abs(currentTotal - savedTotal) > 0.01) return true;
    if ((recommendedLock ?? null) !== (loadedEntry.snapshot.recommendedLock ?? null)) return true;
    return false;
  }, [loadedEntry, fxRateStr, grandTotal, recommendedLock]);

  const showSavedWarning = stepKey === "currency" && isLockedFromHistory && savedPriceChanged && !historyWarningDismissed;

  const summaryText = useMemo(() => {
    const lines: string[] = [];
    lines.push("QUOTE SUMMARY (All totals in GBP)");
    lines.push("");
    lines.push(`Supplier: ${supplier}`);
    lines.push(`Currency used for input: ${displayCurrency}`);
    if (displayCurrency !== "GBP" && toNum(fxRateStr) > 0) {
      lines.push(`Locked FX rate: 1 ${displayCurrency} = ${toNum(fxRateStr).toFixed(4)} GBP`);
    }
    lines.push(`Fixed list price: ${fmtEnteredCurrency(toNum(listPriceStr), currencySymbol)}`);
    lines.push(`GBP List Price - (Our Purchase Price): ${fmtGBP(fixedListPriceGBP)}`);
    if (appliesMinFee) lines.push(`Minimum order fee applied: ${fmtGBP(appliedMinFee)}`);
    lines.push(`Supply only price (Client Purchase Price): ${fmtGBP(supplyOnlyPriceWithMarkup)}`);
    if (baseDiscountEnabled && toNum(baseDiscountPctStr) > 0) {
      lines.push(`Supply only discount: ${toNum(baseDiscountPctStr).toFixed(2)}%`);
    } else {
      lines.push("Supply only discount: Not applied");
    }
    lines.push(`Supply only price after discount & markup: ${fmtGBP(supplyOnlyPriceWithMarkup)}`);
    lines.push(`Estimated profit from fixed list price: ${fmtGBP(fixedListEstimatedProfitGBP)}`);
    lines.push("");

    if (hasExtras && extras.length > 0) {
      lines.push("EXTRAS");
      extras.forEach((ex, i) => {
        const costGBP = extrasGBPPerLine[i] || 0;
        const markupPct = toNum(ex.markupPctStr || globalMarkupPctStr);
        const totalGBP = costGBP * (1 + markupPct / 100);
        lines.push(`- ${ex.name || `Extra ${i + 1}`}: ${fmtGBP(totalGBP)}`);
      });
      lines.push(`Extras total: ${fmtGBP(extrasWithMarkupTotal)}`);
      lines.push("");
    }

    if (deliveryGBP > 0) lines.push(`Delivery: ${fmtGBP(deliveryGBP)}`);
    if (importGBP > 0) lines.push(`Import duties & fees: ${fmtGBP(importGBP)}`);
    if (designGBP > 0) lines.push(`Design fees: ${fmtGBP(designGBP)}`);
    if (withInstallation) lines.push(`Installation: ${fmtGBP(installWithMarkup)}`);

    lines.push("");
    lines.push("ITEM BREAKDOWN");
    lines.push(`Windows: ${items.windows}`);
    lines.push(`Doors: ${items.doors}`);
    lines.push(`Sliding doors below 2.5m: ${items.slidingBelow2_5m}`);
    lines.push(`Sliding doors above 2.5m: ${items.slidingAbove2_5m}`);
    lines.push(`Bifolding doors: ${items.bifoldingDoors}`);
    lines.push(`Glass facades: ${items.glassFacades}`);
    lines.push(`Other: ${items.other}`);
    lines.push(`Total items: ${totalItems}`);
    lines.push("");
    lines.push(`GRAND TOTAL: ${fmtGBP(grandTotal)}`);
    return lines.join("\n");
  }, [
    supplier,
    displayCurrency,
    fxRateStr,
    listPriceStr,
    currencySymbol,
    fixedListPriceGBP,
    appliesMinFee,
    appliedMinFee,
    supplyOnlyPriceWithMarkup,
    baseDiscountEnabled,
    baseDiscountPctStr,
    fixedListEstimatedProfitGBP,
    hasExtras,
    extras,
    extrasGBPPerLine,
    globalMarkupPctStr,
    extrasWithMarkupTotal,
    deliveryGBP,
    importGBP,
    designGBP,
    withInstallation,
    installWithMarkup,
    items,
    totalItems,
    grandTotal,
  ]);

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopyStatus("Copied to clipboard.");
      return;
    } catch {
      // fallback below
    }
    const el = summaryRef.current;
    if (el) {
      el.focus();
      el.select();
      setCopyStatus("Clipboard blocked. Summary selected — press Ctrl+C.");
    } else {
      setCopyStatus("Clipboard blocked. Select and copy the summary manually.");
    }
  }

  async function findNearby() {
    setLodgingError("");
    setLodgingLoading(true);
    try {
      const pc = (sitePostcode || "").trim();
      if (!pc) throw new Error("Enter a site postcode first");

      const geoJ = await safeFetchJSON(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`, "postcodes.io");
      if (!(geoJ && geoJ.status === 200 && geoJ.result)) throw new Error("Postcode not found");

      const { latitude: lat, longitude: lon } = geoJ.result;
      const radiusMeters = 5000;
      const query = `[out:json][timeout:25];nwr(around:${radiusMeters},${lat},${lon})[tourism~"hotel|guest_house|motel|hostel"];out center;`;
      const overpass = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
      const mirrors = [overpass, overpass.replace("overpass-api.de", "overpass.kumi.systems"), overpass.replace("overpass-api.de", "lz4.overpass-api.de")];

      let opJ: any = null;
      for (const m of mirrors) {
        try {
          opJ = await safeFetchJSON(m, "Overpass");
          break;
        } catch {
          // try next
        }
      }
      if (!opJ) throw new Error("Overpass unavailable");

      const elements: any[] = opJ.elements || [];
      const places = elements
        .map((el, idx) => {
          const name = (el.tags && (el.tags.name || el.tags["name:en"])) || `Hotel ${idx + 1}`;
          const p = { lat: el.lat || el.center?.lat || lat, lon: el.lon || el.center?.lon || lon };
          const d = haversineKm({ lat, lon }, { lat: p.lat, lon: p.lon });
          const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " " + pc)}`;
          return { id: String(el.id || `${name}-${idx}`), name, distanceKm: d, url };
        })
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 5);

      const est = Number(lodgingRateStr) || 85;
      setHotelResults(places.map((p) => ({ ...p, estGBP: est })));
      const airUrlBase = `https://www.airbnb.com/s/${lat.toFixed(5)}--${lon.toFixed(5)}/homes`;
      setAirbnbResults(
        new Array(5).fill(0).map((_, i) => ({
          id: `air${i}`,
          name: `Airbnb near ${pc} #${i + 1}`,
          distanceKm: 0.5 + i * 0.3,
          url: airUrlBase,
          estGBP: Math.round(est * 0.95),
        }))
      );
    } catch (e: any) {
      setLodgingError(e?.message || "Unable to fetch nearby stays");
      setHotelResults([]);
      setAirbnbResults([]);
    } finally {
      setLodgingLoading(false);
    }
  }

  function next() {
    if (step < steps.length - 1 && canNext) setStep((s) => s + 1);
  }

  function back() {
    if (step > 0) setStep((s) => s - 1);
  }

  function addSupplyRow() {
    setSupplyRows((rows) => [...rows, { id: uid(), item: "", quantityStr: "1", itemPriceStr: "" }]);
  }

  function removeSupplyRow(id: string) {
    setSupplyRows((rows) => (rows.length > 1 ? rows.filter((row) => row.id !== id) : rows));
  }

  function addExtra() {
    setExtras((prev) => [...prev, { id: uid(), name: "", costStr: "", markupPctStr: globalMarkupPctStr }]);
  }

  function removeExtra(id: string) {
    setExtras((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div style={{ minHeight: "100%", background: "#f8fafc", padding: 16 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.02em", color: "#111827" }}>Project Calculator</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
              Driven wizard prototype for supply pricing, extras, installation, nearby stays, and internal profit analysis.
            </div>
            {isLockedFromHistory && (
              <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, background: "#fee2e2", color: "#991b1b", padding: "6px 10px", fontSize: 12, fontWeight: 800 }}>
                Saved calculator loaded • pricing locked
              </div>
            )}
            <ProgressDots steps={steps.map((s) => s.title)} activeIndex={step} />
          </div>

          <div style={{ display: "inline-flex", gap: 8, alignItems: "center", borderRadius: 14, border: "1px solid #e4e4e7", background: "#fff", padding: "10px 12px" }}>
            <button type="button" style={ghostButtonStyle()} onClick={() => setHistoryOpen((v) => !v)}>
              {historyOpen ? "Close History" : "History"}
            </button>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>Admin settings</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Installation rates are inline for now.</div>
          </div>

        </div>

        {historyOpen && (
          <div style={{ ...sectionCardStyle(), padding: 20 }}>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>Saved calculator history</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Project-specific history for {estimateRef}{clientName ? ` • ${clientName}` : ""}</div>
                </div>
              </div>
              {savedEntries.length === 0 ? (
                <div style={{ fontSize: 13, color: "#6b7280" }}>No saved calculators yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {savedEntries.map((entry) => (
                    <div key={entry.id} style={{ ...cardStyle(), display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{entry.name}</div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                            Saved {new Date(entry.savedAt).toLocaleString("en-GB")} • {entry.snapshot.currency} • {fmtGBP(entry.snapshot.grandTotal)}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" style={buttonStyle(false)} onClick={() => loadSavedCalculator(entry)}>Load</button>
                          <button type="button" style={ghostButtonStyle()} onClick={() => deleteSavedCalculator(entry.id)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {stepKey === "currency" && (
          <StepShell>
            <div style={{ display: "grid", gap: 20 }}>
              {showSavedWarning && (
                <div
                  style={{
                    borderRadius: 16,
                    background: "#dc2626",
                    color: "#fff",
                    padding: 16,
                    textAlign: "center",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 900 }}>Saved calculator pricing has changed</div>
                  <div style={{ fontSize: 13 }}>
                    The current live / locked FX or resulting total differs from the saved calculator. Pricing remains locked until you choose to edit.
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                    <button type="button" style={{ ...buttonStyle(false), background: "#fff", color: "#b91c1c", border: "none" }} onClick={dismissHistoryWarning}>
                      Dismiss
                    </button>
                    <button type="button" style={{ ...buttonStyle(true), background: "#111827" }} onClick={editSavedCalculator}>
                      Edit Saved Calculator
                    </button>
                  </div>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                <div>
                  <label style={labelStyle()}>Supplier</label>
                  <select value={supplier} onChange={(e) => setSupplier(e.target.value)} style={inputStyle()} disabled={isLockedFromHistory}>
                    {suppliers.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle()}>Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => {
                      setCurrency(e.target.value);
                      setCustomCurrency("");
                      setManualFxOverride(false);
                    }}
                    style={inputStyle()}
                    disabled={isLockedFromHistory}
                  >
                    {COMMON_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle()}>Add supplier name</label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} placeholder="Add another supplier" style={{ ...inputStyle(), maxWidth: 360 }} disabled={isLockedFromHistory} />
                  <button
                    type="button"
                    style={buttonStyle(false, isLockedFromHistory)}
                    disabled={isLockedFromHistory}
                    onClick={() => {
                      const name = newSupplier.trim();
                      if (!name) return;
                      if (!suppliers.includes(name)) setSuppliers((prev) => [...prev, name]);
                      setSupplier(name);
                      setNewSupplier("");
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 1.3fr) minmax(280px, 1fr)", gap: 20 }}>
                <div style={{ display: "grid", gap: 16 }}>
                  <div>
                    <label style={labelStyle()}>Fixed list price ({displayCurrency})</label>
                    <input value={listPriceStr} onChange={(e) => setListPriceStr(e.target.value)} placeholder="0.00" style={inputStyle()} disabled={isLockedFromHistory} />
                  </div>

                  <div>
                    <label style={labelStyle()}>Global markup</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 42px", gap: 8, alignItems: "center", maxWidth: 220 }}>
                      <input value={globalMarkupPctStr} onChange={(e) => setGlobalMarkupPctStr(e.target.value)} placeholder="35" style={inputStyle()} disabled={isLockedFromHistory} />
                      <div style={{ fontSize: 14, color: "#52525b" }}>%</div>
                    </div>
                  </div>

                  {displayCurrency !== "GBP" && (
                    <div style={{ ...cardStyle({ background: "#fff" }), padding: 14 }}>
                      <div style={{ fontSize: 12, color: "#52525b", marginBottom: 8 }}>Live rate & recommendation (auto-refresh each minute)</div>
                      {liveRateError ? (
                        <div style={{ fontSize: 13, color: "#b91c1c" }}>{liveRateError}. Enter the rate manually if needed.</div>
                      ) : liveRate == null ? (
                        <div style={{ fontSize: 13, color: "#52525b" }}>Loading…</div>
                      ) : (
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ fontSize: 13, fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", color: "#111827" }}>
                            Live: 1 {displayCurrency} = {liveRate.toFixed(5)} GBP
                          </div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>
                            Source: {liveRateSource}
                            {liveRateUpdated ? ` • ${liveRateUpdated}` : ""}
                          </div>
                          <div style={{ fontSize: 13, fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", color: "#111827" }}>
                            Recommended lock: {(Math.floor(liveRate * 100) / 100 + 0.02).toFixed(2)} GBP
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label style={labelStyle()}>Locked FX (editable)</label>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                      <input type="checkbox" checked={manualFxOverride} onChange={(e) => setManualFxOverride(e.target.checked)} disabled={isLockedFromHistory} />
                      <span style={{ fontSize: 13, color: "#52525b" }}>Manual override</span>
                    </div>
                    <input
                      value={fxRateStr}
                      onChange={(e) => {
                        setManualFxOverride(true);
                        setFxRateStr(e.target.value);
                      }}
                      disabled={isLockedFromHistory}
                      placeholder={liveRate ? liveRate.toFixed(2) : "0.00"}
                      style={inputStyle()}
                    />
                    <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                      Active calculation rate: {displayCurrency === "GBP" ? "1.00000" : `${(manualFxOverride ? (toNum(fxRateStr) || 0) : (liveRate ?? 0)).toFixed(5)} (${manualFxOverride ? "Locked FX" : "Live FX"})`}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...cardStyle({ background: "#f3f4f6" }) }}>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>GBP List Price - (Our Purchase Price)</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#111827", marginTop: 6 }}>{fmtGBP(fixedListPriceGBP)}</div>
                  </div>

                  <div style={{ ...cardStyle({ background: "#dcfce7", borderColor: "#bbf7d0" }) }}>
                    <div style={{ fontSize: 12, color: "#166534" }}>Supply only price (Client Purchase Price)</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#14532d", marginTop: 6 }}>{fmtGBP(supplyOnlyPriceWithMarkup)}</div>
                  </div>

                  <div style={cardStyle()}>
                    <label style={labelStyle()}>Supply only discount (optional)</label>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input type="checkbox" checked={baseDiscountEnabled} onChange={(e) => setBaseDiscountEnabled(e.target.checked)} disabled={isLockedFromHistory} />
                      <span style={{ fontSize: 13, color: "#52525b" }}>Apply discount to supply only price</span>
                    </div>
                    {baseDiscountEnabled && (
                      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 42px", gap: 8, alignItems: "center", maxWidth: 220 }}>
                        <input value={baseDiscountPctStr} onChange={(e) => setBaseDiscountPctStr(e.target.value)} placeholder="0" style={inputStyle()} disabled={isLockedFromHistory} />
                        <div style={{ fontSize: 14, color: "#52525b" }}>%</div>
                      </div>
                    )}
                  </div>

                  <div style={{ ...cardStyle({ background: "#f3f4f6" }) }}>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Supply only price after discount & markup</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#111827", marginTop: 6 }}>{fmtGBP(supplyOnlyPriceWithMarkup)}</div>
                  </div>

                  <div style={{ ...cardStyle({ background: "#dcfce7", borderColor: "#bbf7d0" }) }}>
                    <div style={{ fontSize: 12, color: "#166534" }}>Estimated profit from fixed list price</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#14532d", marginTop: 6 }}>{fmtGBP(fixedListEstimatedProfitGBP)}</div>
                  </div>
                </div>
              </div>

              {(supplyListEnteredMismatch || supplyListMismatch) && (
                <div
                  style={{
                    borderRadius: 16,
                    background: "#dc2626",
                    color: "#fff",
                    padding: 14,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 900 }}>Supply item list mismatch</div>
                  {supplyListEnteredMismatch && (
                    <div style={{ fontSize: 13 }}>
                      Supply list subtotal ({displayCurrency}) does not match the fixed list price entered.
                    </div>
                  )}
                  {supplyListMismatch && (
                    <div style={{ fontSize: 13 }}>
                      Client Supply list subtotal does not match the Supply only price (Client Purchase Price).
                    </div>
                  )}
                </div>
              )}

              <div style={sectionCardStyle()}>
                <div style={{ padding: 16, display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>Supply item list</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Rows auto-add when the last row is completed.</div>
                    </div>
                    <button type="button" style={buttonStyle(false, isLockedFromHistory)} onClick={addSupplyRow} disabled={isLockedFromHistory}>
                      Add item
                    </button>
                  </div>

                  <div style={{ maxHeight: 360, overflowY: "auto", borderRadius: 12, border: "1px solid #e4e4e7" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980, background: "#fff" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #e4e4e7", background: "#fafafa", color: "#52525b", fontSize: 12, textAlign: "left" }}>
                          <th style={{ padding: "10px 12px" }}>Item</th>
                          <th style={{ padding: "10px 12px" }}>Qty</th>
                          <th style={{ padding: "10px 12px" }}>Item price ({displayCurrency})</th>
                          <th style={{ padding: "10px 12px" }}>Qty price ({displayCurrency})</th>
                          <th style={{ padding: "10px 12px" }}>Item price (GBP, client)</th>
                          <th style={{ padding: "10px 12px" }}>Qty price (GBP, client)</th>
                          <th style={{ padding: "10px 12px", textAlign: "right" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplyRowsComputed.map((row, idx) => (
                          <tr key={row.id} style={{ borderBottom: "1px solid #f4f4f5", verticalAlign: "top" }}>
                            <td style={{ padding: "10px 12px", minWidth: 220 }}>
                              <input
                                value={row.item}
                                onChange={(e) => setSupplyRows((rows) => rows.map((r) => (r.id === row.id ? { ...r, item: e.target.value } : r)))}
                                disabled={isLockedFromHistory}
                                placeholder={`Item ${idx + 1}`}
                                style={inputStyle()}
                              />
                            </td>
                            <td style={{ padding: "10px 12px", width: 90 }}>
                              <input
                                value={row.quantityStr}
                                onChange={(e) => setSupplyRows((rows) => rows.map((r) => (r.id === row.id ? { ...r, quantityStr: e.target.value } : r)))}
                                disabled={isLockedFromHistory}
                                placeholder="1"
                                style={inputStyle()}
                                inputMode="numeric"
                              />
                            </td>
                            <td style={{ padding: "10px 12px", width: 170 }}>
                              <input
                                value={row.itemPriceStr}
                                onChange={(e) => setSupplyRows((rows) => rows.map((r) => (r.id === row.id ? { ...r, itemPriceStr: e.target.value } : r)))}
                                disabled={isLockedFromHistory}
                                placeholder="0.00"
                                style={inputStyle()}
                                inputMode="decimal"
                              />
                            </td>
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{fmtEnteredCurrency(row.quantityPriceEntered, currencySymbol)}</td>
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{fmtGBP(row.itemClientPriceGBP)}</td>
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{fmtGBP(row.quantityClientPriceGBP)}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right" }}>
                              <button type="button" style={ghostButtonStyle(supplyRows.length === 1 || isLockedFromHistory)} onClick={() => removeSupplyRow(row.id)} disabled={supplyRows.length === 1 || isLockedFromHistory}>
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, fontSize: 13 }}>
                    <div
                      style={{
                        ...cardStyle({
                          background: supplyListEnteredMismatch ? "#dc2626" : "#f9fafb",
                          borderColor: supplyListEnteredMismatch ? "#dc2626" : "#e4e4e7",
                          padding: 12,
                        }),
                        color: supplyListEnteredMismatch ? "#fff" : "#111827",
                      }}
                    >
                      <div style={{ fontSize: 11, color: supplyListEnteredMismatch ? "#fff" : "#6b7280" }}>Supply list subtotal ({displayCurrency})</div>
                      <div style={{ fontWeight: 800, marginTop: 4 }}>{fmtEnteredCurrency(supplyRowsSubtotalEntered, currencySymbol)}</div>
                    </div>
                    <div
                      style={{
                        ...cardStyle({
                          background: supplyListMismatch ? "#dc2626" : "#f9fafb",
                          borderColor: supplyListMismatch ? "#dc2626" : "#e4e4e7",
                          padding: 12,
                        }),
                        color: supplyListMismatch ? "#fff" : "#111827",
                      }}
                    >
                      <div style={{ fontSize: 11, color: supplyListMismatch ? "#fff" : "#6b7280" }}>Client Supply list subtotal</div>
                      <div style={{ fontWeight: 800, marginTop: 4 }}>{fmtGBP(clientSupplyListSubtotalGBP)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {appliesMinFee && (
                <div style={{ ...cardStyle({ background: "#fffbeb", borderColor: "#fcd34d" }), padding: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>Minimum order not met</div>
                  <div style={{ fontSize: 12, color: "#52525b", marginTop: 4 }}>
                    A minimum order fee will be applied to the supply only price.
                  </div>
                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "minmax(180px, 240px) 1fr", gap: 12, alignItems: "end" }}>
                    <div>
                      <label style={labelStyle()}>Minimum order fee (GBP)</label>
                      <input value={minOrderFeeStr} onChange={(e) => setMinOrderFeeStr(e.target.value)} placeholder="600.00" style={inputStyle()} disabled={isLockedFromHistory} />
                    </div>
                    <div style={{ fontSize: 14, color: "#111827" }}>
                      Applied: <span style={{ fontWeight: 800 }}>{fmtGBP(appliedMinFee)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </StepShell>
        )}

        {stepKey === "extras" && (
          <StepShell>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, color: "#111827" }}>
                  <input type="checkbox" checked={hasExtras} onChange={(e) => setHasExtras(e.target.checked)} />
                  Add extras
                </label>
                <button type="button" style={buttonStyle(false, !hasExtras)} onClick={addExtra} disabled={!hasExtras}>
                  Add extra
                </button>
              </div>

              {hasExtras && (
                <div style={{ display: "grid", gap: 12 }}>
                  {extras.length === 0 && <div style={{ fontSize: 13, color: "#6b7280" }}>No extras yet. Click “Add extra”.</div>}
                  {extras.map((ex, idx) => (
                    <div key={ex.id} style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) 160px 120px 110px", gap: 10, alignItems: "end" }}>
                      <div>
                        <label style={labelStyle()}>Extra name</label>
                        <input
                          value={ex.name}
                          onChange={(e) => setExtras((list) => list.map((x) => (x.id === ex.id ? { ...x, name: e.target.value } : x)))}
                          placeholder={`e.g., Trickle vents (${idx + 1})`}
                          style={inputStyle()}
                        />
                      </div>
                      <div>
                        <label style={labelStyle()}>Cost ({displayCurrency})</label>
                        <input
                          value={ex.costStr}
                          onChange={(e) => setExtras((list) => list.map((x) => (x.id === ex.id ? { ...x, costStr: e.target.value } : x)))}
                          placeholder="0.00"
                          style={inputStyle()}
                        />
                      </div>
                      <div>
                        <label style={labelStyle()}>Markup %</label>
                        <input
                          value={ex.markupPctStr || globalMarkupPctStr}
                          onChange={(e) => setExtras((list) => list.map((x) => (x.id === ex.id ? { ...x, markupPctStr: e.target.value } : x)))}
                          placeholder={globalMarkupPctStr}
                          style={inputStyle()}
                        />
                      </div>
                      <button type="button" style={buttonStyle(false)} onClick={() => removeExtra(ex.id)}>
                        Remove
                      </button>
                    </div>
                  ))}
                  <div style={{ textAlign: "right", fontSize: 14, fontWeight: 800, color: "#111827" }}>Extras total: {fmtGBP(extrasWithMarkupTotal)}</div>
                </div>
              )}
            </div>
          </StepShell>
        )}

        {stepKey === "delivery" && (
          <StepShell>
            <div>
              <label style={labelStyle()}>Delivery cost ({displayCurrency})</label>
              <input value={deliveryStr} onChange={(e) => setDeliveryStr(e.target.value)} placeholder="0.00" style={inputStyle({ maxWidth: 260 })} />
            </div>
          </StepShell>
        )}

        {stepKey === "import" && (
          <StepShell>
            <div>
              <label style={labelStyle()}>Import duties & fees ({displayCurrency})</label>
              <input value={importFeesStr} onChange={(e) => setImportFeesStr(e.target.value)} placeholder="0.00" style={inputStyle({ maxWidth: 260 })} />
            </div>
          </StepShell>
        )}

        {stepKey === "design" && (
          <StepShell>
            <div>
              <label style={labelStyle()}>Design fees (optional) ({displayCurrency})</label>
              <input value={designFeesStr} onChange={(e) => setDesignFeesStr(e.target.value)} placeholder="0.00" style={inputStyle({ maxWidth: 260 })} />
            </div>
          </StepShell>
        )}

        {stepKey === "install" && (
          <StepShell>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1.1fr) minmax(260px, 0.9fr)", gap: 20 }}>
              <div style={{ display: "grid", gap: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, color: "#111827" }}>
                  <input type="checkbox" checked={withInstallation} onChange={(e) => setWithInstallation(e.target.checked)} />
                  Include installation
                </label>

                {withInstallation && (
                  <>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button type="button" style={buttonStyle(buildType === "new")} onClick={() => setBuildType("new")}>
                        New build
                      </button>
                      <button type="button" style={buttonStyle(buildType === "refurb")} onClick={() => setBuildType("refurb")}>
                        Refurbishment
                      </button>
                    </div>

                    <div>
                      <label style={labelStyle()}>Installation markup % (default)</label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 42px", gap: 8, alignItems: "center", maxWidth: 220 }}>
                        <input value={installMarkupDefaultPctStr} onChange={(e) => setInstallMarkupDefaultPctStr(e.target.value)} placeholder="35" style={inputStyle()} />
                        <div style={{ fontSize: 14, color: "#52525b" }}>%</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" checked={installCustomMarkups} onChange={(e) => setInstallCustomMarkups(e.target.checked)} />
                      <span style={{ fontSize: 13, color: "#52525b" }}>Customise per category</span>
                    </div>

                    {installCustomMarkups && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                        {[
                          ["Window", "window"],
                          ["Door", "door"],
                          ["Sliding < 2.5m", "slidingDoorBelow2_5m"],
                          ["Sliding ≥ 2.5m", "slidingDoorAbove2_5m"],
                          ["Bifolding", "bifoldingDoor"],
                          ["Glass facade", "glassFacade"],
                          ["Other", "other"],
                          ["Call-out fee", "callOutFee"],
                        ].map(([label, key]) => (
                          <div key={key}>
                            <label style={labelStyle()}>{label} %</label>
                            <input
                              value={installMarkupPerCat[key]}
                              onChange={(e) => setInstallMarkupPerCat((prev) => ({ ...prev, [key]: e.target.value }))}
                              style={inputStyle()}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" checked={markUpCallOut} onChange={(e) => setMarkUpCallOut(e.target.checked)} />
                      <span style={{ fontSize: 13, color: "#52525b" }}>Apply markup to call-out fee</span>
                    </div>

                    <div style={sectionCardStyle()}>
                      <div style={{ padding: 16, display: "grid", gap: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>Site postcode & nearby accommodation</div>
                        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(180px, 220px)", gap: 12 }}>
                          <div>
                            <label style={labelStyle()}>Site postcode</label>
                            <input value={sitePostcode} onChange={(e) => setSitePostcode(e.target.value)} placeholder="e.g., SW1A 1AA" style={inputStyle()} />
                          </div>
                          <div>
                            <label style={labelStyle()}>Guideline cost per room (GBP)</label>
                            <input value={lodgingRateStr} onChange={(e) => setLodgingRateStr(e.target.value)} placeholder="85" style={inputStyle()} />
                          </div>
                        </div>

                        <div>
                          <button type="button" style={buttonStyle(false, lodgingLoading)} onClick={findNearby} disabled={lodgingLoading}>
                            {lodgingLoading ? "Searching…" : "Find nearby stays (10-min)"}
                          </button>
                        </div>

                        {lodgingError && <div style={{ fontSize: 13, color: "#b91c1c" }}>{lodgingError}</div>}

                        {(hotelResults.length > 0 || airbnbResults.length > 0) && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Hotels / B&Bs (guide price)</div>
                              <div style={{ display: "grid", gap: 8 }}>
                                {hotelResults.map((h) => (
                                  <a
                                    key={h.id}
                                    href={h.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      display: "block",
                                      borderRadius: 12,
                                      border: "1px solid #e4e4e7",
                                      padding: 10,
                                      textDecoration: "none",
                                      color: "inherit",
                                      background: "#fff",
                                    }}
                                  >
                                    <div style={{ fontWeight: 700 }}>{h.name}</div>
                                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                                      Approx. {fmtGBP(h.estGBP)} • {h.distanceKm.toFixed(1)} km
                                    </div>
                                  </a>
                                ))}
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Airbnb (guide price)</div>
                              <div style={{ display: "grid", gap: 8 }}>
                                {airbnbResults.map((a) => (
                                  <a
                                    key={a.id}
                                    href={a.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      display: "block",
                                      borderRadius: 12,
                                      border: "1px solid #e4e4e7",
                                      padding: 10,
                                      textDecoration: "none",
                                      color: "inherit",
                                      background: "#fff",
                                    }}
                                  >
                                    <div style={{ fontWeight: 700 }}>{a.name}</div>
                                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                                      Approx. {fmtGBP(a.estGBP)} • around site
                                    </div>
                                  </a>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div style={{ ...cardStyle({ background: "#f3f4f6", alignSelf: "start" }) }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>Estimated installation total</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: "#111827", marginTop: 8 }}>{fmtGBP(withInstallation ? installWithMarkup : 0)}</div>
              </div>
            </div>
          </StepShell>
        )}

        {stepKey === "items" && (
          <StepShell>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <NumericField label="Windows" value={itemsStr.windows} onChange={(v) => setItemsStr((i) => ({ ...i, windows: v }))} />
              <NumericField label="Doors" value={itemsStr.doors} onChange={(v) => setItemsStr((i) => ({ ...i, doors: v }))} />
              <NumericField label="Sliding doors < 2.5m" value={itemsStr.slidingBelow2_5m} onChange={(v) => setItemsStr((i) => ({ ...i, slidingBelow2_5m: v }))} />
              <NumericField label="Sliding doors ≥ 2.5m" value={itemsStr.slidingAbove2_5m} onChange={(v) => setItemsStr((i) => ({ ...i, slidingAbove2_5m: v }))} />
              <NumericField label="Bifolding doors" value={itemsStr.bifoldingDoors} onChange={(v) => setItemsStr((i) => ({ ...i, bifoldingDoors: v }))} />
              <NumericField label="Glass facades" value={itemsStr.glassFacades} onChange={(v) => setItemsStr((i) => ({ ...i, glassFacades: v }))} />
              <NumericField label="Other" value={itemsStr.other} onChange={(v) => setItemsStr((i) => ({ ...i, other: v }))} />
            </div>
            <div style={{ marginTop: 14, fontSize: 14, color: "#111827" }}>
              Total items: <span style={{ fontWeight: 800 }}>{totalItems}</span>
            </div>
          </StepShell>
        )}

        {stepKey === "review" && (
          <StepShell>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ maxWidth: 420 }}>
                <label style={labelStyle()}>Save name</label>
                <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder={`${estimateRef} quote snapshot`} style={inputStyle()} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(420px, 1.4fr) minmax(260px, 1fr)", gap: 20 }}>
              <div>
                <label style={labelStyle()}>Copy-ready summary</label>
                <textarea
                  ref={summaryRef}
                  value={summaryText}
                  readOnly
                  style={{
                    ...inputStyle({ minHeight: 320, fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", resize: "vertical" }),
                  }}
                />
                <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                  <button type="button" style={buttonStyle(false)} onClick={copySummary}>
                    Copy summary
                  </button>
                  <button type="button" style={buttonStyle(true)} onClick={saveCalculator}>
                    Save Calculator
                  </button>
                </div>
                {copyStatus && <div style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>{copyStatus}</div>}
              </div>

              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ ...cardStyle({ background: "#f3f4f6" }) }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>Grand total</div>
                  <div style={{ fontSize: 34, fontWeight: 900, color: "#111827", marginTop: 8 }}>{fmtGBP(grandTotal)}</div>

                  <div style={{ marginTop: 14, display: "grid", gap: 6, fontSize: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Supply only</span><span>{fmtGBP(supplyOnlyPriceWithMarkup)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Extras</span><span>{fmtGBP(extrasWithMarkupTotal)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Delivery</span><span>{fmtGBP(deliveryGBP)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Import/fees</span><span>{fmtGBP(importGBP)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Design</span><span>{fmtGBP(designGBP)}</span></div>
                    {withInstallation && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Installation</span><span>{fmtGBP(installWithMarkup)}</span></div>}
                  </div>
                </div>

                <div style={cardStyle()}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#111827", marginBottom: 10 }}>Profit analysis (internal)</div>
                  <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Supply gross profit</span><strong>{fmtGBP(supplyGrossGBP)}</strong></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Extras gross profit</span><strong>{fmtGBP(extrasGrossGBP)}</strong></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Installation gross profit</span><strong>{fmtGBP(installGrossGBP)}</strong></div>
                    <div style={{ borderTop: "1px solid #e4e4e7", margin: "6px 0" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}><span>Total estimated gross profit</span><span>{fmtGBP(totalGrossGBP)}</span></div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <label style={labelStyle()}>Operating costs to deduct (GBP)</label>
                    <input value={operatingCostsStr} onChange={(e) => setOperatingCostsStr(e.target.value)} placeholder="0.00" style={inputStyle()} />
                  </div>

                  <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 900 }}>
                    <span>Net profit after operating costs</span>
                    <span>{fmtGBP(netProfitGBP)}</span>
                  </div>

                  <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                    Supplier costs basis: supply cost = discounted supply-only before markup (+ min order if applicable); extras cost = entered extras before markup; installation cost = admin schedule without markup.
                  </div>
                </div>
              </div>
            </div>
            </div>
          </StepShell>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button type="button" style={buttonStyle(false, step === 0)} onClick={back} disabled={step === 0}>
            Back
          </button>
          <button type="button" style={buttonStyle(true, !canNext || step === steps.length - 1)} onClick={next} disabled={!canNext || step === steps.length - 1}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

try {
  console.assert(typeof fmtGBP(1) === "string", "fmtGBP returns string");
} catch {}

try {
  const p = calcInstallSubtotal("new", {
    windows: 2,
    doors: 1,
    slidingBelow2_5m: 0,
    slidingAbove2_5m: 0,
    bifoldingDoors: 0,
    glassFacades: 0,
    other: 0,
  });
  console.assert(p.window === 240 && p.door === 160, "install calc");
} catch {}
