import { estimateTotals, estimateCostTotal } from "../../domain/estimates/estimateCalculations";
import { describePositionForOutput, getContractAwarePositionMetrics } from "../../features/configurator/configuredPositionContract.utils";

function estimateCostLine(
  e: any,
  p: any,
  itemPriceByPositionId: Record<string, string>
) {
  const raw = itemPriceByPositionId[p.id] ?? String(p.itemPrice ?? "");
  const itemPrice = Number(raw || 0);
  const quantityPrice = (Number.isFinite(itemPrice) ? itemPrice : 0) * Math.max(1, getContractAwarePositionMetrics(p).qty);
  return { itemPrice, quantityPrice };
}

export function estimateDocumentTitle(pickerClient: any, e: any) {
  return `Estimate ${e.estimateRef} - ${pickerClient.clientName}`;
}

export function buildEstimateHtml(args: {
  pickerClient: any;
  e: any;
  itemPriceByPositionId: Record<string, string>;
  formatMeasure: (n: number) => string;
  formatMoney: (n: number) => string;
  positionDescription: (p: any) => string;
}) {
  const totals = estimateTotals(args.e);
  const estimateCost = estimateCostTotal(args.e, args.itemPriceByPositionId);
  const rows = (args.e.positions ?? []).map((p: any) => {
    const pricing = estimateCostLine(args.e, p, args.itemPriceByPositionId);
    const metrics = getContractAwarePositionMetrics(p);
    const description = describePositionForOutput(p, args.positionDescription(p));
    return `
        <tr>
          <td style="padding:8px;border:1px solid #d4d4d8;">${p.positionRef}</td>
          <td style="padding:8px;border:1px solid #d4d4d8;">${p.roomName || ""}</td>
          <td style="padding:8px;border:1px solid #d4d4d8;">${description}</td>
          <td style="padding:8px;border:1px solid #d4d4d8;text-align:right;">${metrics.qty}</td>
          <td style="padding:8px;border:1px solid #d4d4d8;text-align:right;">${args.formatMoney(pricing.itemPrice)}</td>
          <td style="padding:8px;border:1px solid #d4d4d8;text-align:right;">${args.formatMoney(pricing.quantityPrice)}</td>
        </tr>
      `;
  }).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${estimateDocumentTitle(args.pickerClient, args.e)}</title>
  <style>
    body { font-family: Arial, sans-serif; color:#18181b; padding:32px; }
    h1, h2, h3 { margin:0 0 8px 0; }
    .muted { color:#52525b; font-size:12px; }
    .grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; margin:16px 0 24px; }
    .card { border:1px solid #d4d4d8; border-radius:12px; padding:12px; background:#fafafa; }
    table { width:100%; border-collapse:collapse; margin-top:16px; }
    th { text-align:left; background:#f4f4f5; }
    th, td { font-size:12px; }
    .note { margin-top:20px; padding:12px; border:1px dashed #d4d4d8; border-radius:12px; background:#fff; }
    @media print { body { padding: 12mm; } .no-print { display:none; } }
  </style>
</head>
<body>
  <h1>${estimateDocumentTitle(args.pickerClient, args.e)}</h1>
  <div class="muted">Client: ${args.pickerClient.clientName} • Ref: ${(args.pickerClient as any).clientRef ?? ""} • Estimate: ${args.e.estimateRef}</div>
  <div class="muted">This draft uses the uploaded estimate template as the basis for future positioning/layout work.</div>

  <div class="grid">
    <div class="card"><div class="muted">Total m²</div><div><strong>${args.formatMeasure(totals.totalSquareMetres)}</strong></div></div>
    <div class="card"><div class="muted">Linear metreage</div><div><strong>${args.formatMeasure(totals.totalLinearMetres)}</strong></div></div>
    <div class="card"><div class="muted">Total quantity</div><div><strong>${totals.totalQty}</strong></div></div>
    <div class="card"><div class="muted">Estimate total</div><div><strong>${args.formatMoney(estimateCost)}</strong></div></div>
  </div>

  <h2>Positions</h2>
  <table>
    <thead>
      <tr>
        <th style="padding:8px;border:1px solid #d4d4d8;">Reference</th>
        <th style="padding:8px;border:1px solid #d4d4d8;">Room</th>
        <th style="padding:8px;border:1px solid #d4d4d8;">Description</th>
        <th style="padding:8px;border:1px solid #d4d4d8;text-align:right;">Qty</th>
        <th style="padding:8px;border:1px solid #d4d4d8;text-align:right;">Item price</th>
        <th style="padding:8px;border:1px solid #d4d4d8;text-align:right;">Quantity price</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="note">
    <strong>Template note:</strong> final Word/PDF content positioning will be aligned to the uploaded estimate template in the next stage.
  </div>
</body>
</html>`;
}

export function openPrintWindow(html: string, alertFn?: (message: string) => void) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=1100,height=900");
  if (!win) {
    (alertFn ?? ((message: string) => window.alert(message)))("Popup blocked. Please allow popups and try again.");
    return null;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  return win;
}

export function printEstimatePdf(args: {
  pickerClient: any;
  e: any;
  itemPriceByPositionId: Record<string, string>;
  formatMeasure: (n: number) => string;
  formatMoney: (n: number) => string;
  positionDescription: (p: any) => string;
  alertFn?: (message: string) => void;
}) {
  const win = openPrintWindow(
    buildEstimateHtml(args),
    args.alertFn
  );
  if (!win) return;
  win.focus();
  setTimeout(() => win.print(), 250);
}

export function downloadEstimateWordDoc(args: {
  pickerClient: any;
  e: any;
  itemPriceByPositionId: Record<string, string>;
  formatMeasure: (n: number) => string;
  formatMoney: (n: number) => string;
  positionDescription: (p: any) => string;
}) {
  const html = buildEstimateHtml(args);
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${estimateDocumentTitle(args.pickerClient, args.e).replace(/[^a-z0-9-_]+/gi, "_")}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
