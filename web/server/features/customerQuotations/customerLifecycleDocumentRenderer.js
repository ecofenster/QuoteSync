import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import { resolveAttachmentRoot, resolveManagedPath } from "../supplierQuotes/managedAttachmentStorage.js";

pdfMake.addVirtualFileSystem(pdfFonts);

const WEB_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const KNOWN_DOCUMENT_ASSETS = new Map([
  ["4da9b264-6a74-4357-956b-9f1763966a4f.png", path.join(WEB_ROOT, "docs", "QuoteSuite - PDF Print Out", "New", "4da9b264-6a74-4357-956b-9f1763966a4f.png")],
  ["f60e06e3-7b52-45e0-9fad-3a190c0704bb.png", path.join(WEB_ROOT, "docs", "QuoteSuite - PDF Print Out", "New", "f60e06e3-7b52-45e0-9fad-3a190c0704bb.png")],
  ["PHOTO-2020-08-29-07-54-57.jpg", path.join(WEB_ROOT, "docs", "QuoteSuite - PDF Print Out", "New", "PHOTO-2020-08-29-07-54-57.jpg")],
]);

const clean = (value) => String(value ?? "").trim();
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const money = (value) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(number(value));
const formatDate = (value) => {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.valueOf()) ? clean(value) : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric" }).format(date);
};
const mimeFromName = (fileName) => /\.jpe?g$/i.test(fileName) ? "image/jpeg" : /\.png$/i.test(fileName) ? "image/png" : null;

async function imageDataUrl(value, attachmentRoot) {
  if (!value) return null;
  let pathname;
  try { pathname = new URL(String(value), "http://quotesuite.local").pathname; } catch { return null; }
  const visualMatch = pathname.match(/^\/api\/manufacturer-position-visuals\/([a-f0-9]{40})\/([A-Za-z0-9._-]+)$/i);
  let fileName;
  let target;
  if (visualMatch) {
    fileName = visualMatch[2];
    target = resolveManagedPath(`manufacturer-position-visuals/${visualMatch[1]}/${fileName}`, attachmentRoot);
  } else {
    fileName = decodeURIComponent(pathname.split("/").pop() || "");
    target = KNOWN_DOCUMENT_ASSETS.get(fileName);
  }
  const mime = mimeFromName(fileName);
  if (!target || !mime) return null;
  try { return `data:${mime};base64,${(await readFile(target)).toString("base64")}`; } catch { return null; }
}

function brandOf(projection) {
  const brand = projection?.brand || {};
  return {
    name: clean(brand.companyName || brand.name || "Ecofenster"),
    primary: clean(brand.primaryColour) || "#55B948",
    accent: clean(brand.accentColour) || "#85C76D",
    dark: clean(brand.darkColour) || "#17211D",
  };
}

function pageHeader(title, reference, brand) {
  return { columns: [{ stack: [{ text: brand.name.toUpperCase(), style: "eyebrow" }, { text: title, style: "pageTitle" }] }, { text: reference, alignment: "right", style: "reference" }], margin: [0, 0, 0, 13] };
}

function labelled(label, value) {
  return { columns: [{ width: 166, stack: [{ text: label.toUpperCase(), style: "fieldLabel" }, { text: clean(value) || "Not supplied", style: "coverBody" }] }], margin: [24, 0, 0, 7] };
}

function positionContent(position, drawing, brand, { includeChecks = false, checkByPosition = new Map() } = {}) {
  const reference = clean(position.customerReference || position.reference || "Position");
  const specification = Array.isArray(position.specification) ? position.specification : [];
  const thermal = position.thermal || {};
  const price = position.classification === "alternative" ? `${money(position.totalSellingPriceGbp)} · alternative, excluded from total` : money(position.totalSellingPriceGbp);
  const checks = checkByPosition.get(clean(position.id)) || [];
  const detailRows = [
    ["Product / system", clean(position.productSystem || position.description) || "Not supplied"],
    ["Configuration", clean(position.configurationDescription) || "Not supplied"],
    ...specification.map((item) => [clean(item.label), clean(item.value)]),
    ...(thermal.manufacturerQuotedUw || thermal.calculatedUw ? [["Uw", `${clean(thermal.manufacturerQuotedUw || thermal.calculatedUw)} W/m²K`]] : []),
    ...(thermal.ug ? [["Ug", `${clean(thermal.ug)} W/m²K`]] : []),
  ];
  return {
    unbreakable: true,
    stack: [{
      table: { widths: [130, "*"], body: [[
        { stack: [drawing ? { image: drawing, fit: [118, 155], alignment: "center", margin: [0, 3, 0, 6] } : { text: "Drawing unavailable\nNo reliable source image exists.", alignment: "center", color: "#68736D", margin: [0, 52, 0, 52] }, { text: position.drawing?.source === "manufacturer" ? "Source-owned manufacturer drawing" : position.drawing?.available ? "Canonical configured drawing" : "No drawing substituted", style: "caption", alignment: "center" }], fillColor: "#F4F6F3" },
        { stack: [
          { columns: [{ text: `POSITION ${reference}`, style: "positionTitle" }, { text: price, style: "positionPrice", alignment: "right" }] },
          { text: `${number(position.quantity)} × ${number(position.widthMm)} × ${number(position.heightMm)} mm${position.roomName ? ` · ${clean(position.roomName)}` : ""}`, style: "positionMeta", margin: [0, 3, 0, 8] },
          { table: { widths: [105, "*"], body: detailRows.map(([label, value]) => [{ text: label, style: "fieldLabel" }, { text: value, style: "body" }]) }, layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 3, paddingTop: () => 1.5, paddingBottom: () => 1.5 } },
          ...(position.classification === "alternative" ? [{ text: `Alternative to ${clean(position.alternativeToReference) || "the preceding included Position"}. This option is not included in the Estimate total.`, style: "alternative", margin: [0, 8, 0, 0] }] : []),
          ...(includeChecks ? [{ text: checks.length ? "POSITION CHECKS" : "POSITION CHECK REQUIRED", style: "fieldLabel", margin: [0, 9, 0, 3] }, ...(checks.length ? checks.map((check) => ({ text: `${check.status === "no_change" || check.status === "approved_difference" ? "MATCH" : "REVIEW"} · ${clean(check.fieldKey).replaceAll("_", " ")} · ${clean(check.status).replaceAll("_", " ")}${check.confirmedValue ? ` · ${clean(check.confirmedValue)}` : ""}`, style: check.status === "no_change" || check.status === "approved_difference" ? "checkOk" : "checkWarn" })) : [{ text: "Staff must verify this Position against returned source evidence before release.", style: "checkWarn" }])] : []),
        ] },
      ]] },
      layout: { hLineColor: () => "#CAD2CC", vLineColor: () => "#CAD2CC", paddingLeft: () => 9, paddingRight: () => 9, paddingTop: () => 9, paddingBottom: () => 9 },
    }, { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: brand.accent }] }], margin: [0, 0, 0, 12],
  };
}

function summaryTable(projection) {
  const rows = (projection.charges || []).map((charge) => [{ text: clean(charge.label), style: "body" }, { text: money(charge.amountGbp), alignment: "right", style: "bodyStrong" }]);
  rows.push([{ text: "Subtotal excluding VAT", style: "bodyStrong" }, { text: money(projection.subtotalExVatGbp), alignment: "right", style: "bodyStrong" }], [{ text: `VAT (${clean(projection.vatRatePercent)}%)`, style: "body" }, { text: money(projection.vatGbp), alignment: "right", style: "bodyStrong" }], [{ text: "TOTAL INCLUDING VAT", style: "totalLabel" }, { text: money(projection.totalIncVatGbp), alignment: "right", style: "totalValue" }]);
  return { table: { widths: ["*", 130], body: rows }, layout: { fillColor: (row) => row === rows.length - 1 ? "#E8F2E2" : null, hLineColor: () => "#D7DDD9", vLineWidth: () => 0, paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 7, paddingBottom: () => 7 } };
}

async function projectionAssets(projection, attachmentRoot) {
  const drawings = new Map();
  for (const position of projection.positions || []) drawings.set(clean(position.id), await imageDataUrl(position.drawing?.imageUrl, attachmentRoot));
  const showcases = new Map();
  for (const item of projection.productShowcases || []) showcases.set(clean(item.id), await imageDataUrl(item.imageUrl, attachmentRoot));
  return { drawings, showcases, architectural: await imageDataUrl(projection.architecturalDetailUrl, attachmentRoot), cover: await imageDataUrl(projection.coverPhotoUrl, attachmentRoot) };
}

function documentDefinition({ kind, projection, context, assets }) {
  const brand = brandOf(projection);
  const title = kind === "estimate" ? "Estimate" : kind === "order" ? "Order" : "Final Confirmation";
  const reference = clean(context.reference || projection.estimateReference);
  const positions = projection.positions || [];
  const checks = Array.isArray(context.positionChecks) ? context.positionChecks : [];
  const checkByPosition = new Map();
  for (const check of checks) checkByPosition.set(clean(check.estimatePositionId), [...(checkByPosition.get(clean(check.estimatePositionId)) || []), check]);
  const content = [{
    stack: [
      assets.cover ? { image: assets.cover, absolutePosition: { x: 0, y: 0 }, width: 595, height: 842 } : { canvas: [{ type: "rect", x: 0, y: 0, w: 595, h: 842, color: "#F2F3EF" }], absolutePosition: { x: 0, y: 0 } },
      { canvas: [{ type: "rect", x: 0, y: 0, w: 218, h: 842, color: brand.dark, opacity: 0.92 }, { type: "rect", x: 0, y: 0, w: 9, h: 842, color: brand.primary }], absolutePosition: { x: 0, y: 0 } },
      { text: brand.name.toUpperCase(), color: "#FFFFFF", bold: true, fontSize: 11, characterSpacing: 1.8, margin: [24, 62, 0, 0] },
      { columns: [{ width: 166, text: kind === "final_confirmation" ? "Final\nConfirmation" : title, color: "#FFFFFF", bold: true, fontSize: kind === "final_confirmation" ? 18 : 34, lineHeight: 0.98 }], margin: [24, 84, 0, 6] },
      { columns: [{ width: 166, text: clean(projection.documentSubtitle || "Windows & Doors"), color: brand.accent, fontSize: 15 }], margin: [24, 0, 0, 60] },
      labelled("Client", projection.clientName), labelled("Project", projection.projectName), labelled(`${title} reference`, reference), labelled("Revision", context.revision ?? projection.commercialRevision), labelled("Document date", formatDate(context.documentDate || projection.previewDate)),
      ...(!assets.cover ? [{ text: "Approved cover photograph pending", color: "#68736D", fontSize: 9, italics: true, margin: [260, 150, 25, 0], alignment: "right" }] : []),
      ...(assets.architectural ? [{ image: assets.architectural, fit: [260, 230], absolutePosition: { x: 300, y: 540 }, opacity: 0.75 }] : []),
    ], pageBreak: "after",
  }];

  if (projection.productShowcases?.length) {
    content.push(pageHeader("Products in your Estimate", reference, brand));
    for (const showcase of projection.productShowcases) content.push({ columns: [assets.showcases.get(clean(showcase.id)) ? { image: assets.showcases.get(clean(showcase.id)), width: 205, fit: [205, 150] } : { text: "Product image unavailable", width: 205, color: "#68736D" }, { width: "*", stack: [{ text: clean(showcase.name), style: "sectionTitle" }, { text: `Included for Position${showcase.positionReferences.length === 1 ? "" : "s"} ${showcase.positionReferences.join(", ")}`, style: "body" }, { text: clean(showcase.sourceLabel), style: "caption", margin: [0, 7, 0, 0] }] }], columnGap: 18, margin: [0, 0, 0, 20] });
    content.push({ text: "", pageBreak: "after" });
  }
  content.push(pageHeader("Your specification at a glance", reference, brand));
  for (const system of projection.specificationOverview || []) content.push({ stack: [{ text: clean(system.productSystem), style: "sectionTitle" }, { text: `Positions ${system.positionReferences.join(", ")}`, style: "caption", margin: [0, 0, 0, 6] }, { ul: (system.items || []).map((item) => `${clean(item.label)}: ${(item.values || []).map(clean).join("; ")}`), style: "body" }], margin: [0, 0, 0, 14] });
  content.push({ text: "Customer-facing specifications are drawn from reviewed Position and supplier evidence. Position-specific evidence overrides product defaults.", style: "notice" }, { text: "", pageBreak: "after" });
  positions.forEach((position, index) => {
    if (index === 0 || index % 2 === 0) content.push(pageHeader(kind === "estimate" ? "Your Position schedule" : kind === "order" ? "Accepted Position schedule" : "Factory confirmation checks", reference, brand));
    content.push(positionContent(position, assets.drawings.get(clean(position.id)), brand, { includeChecks: kind === "final_confirmation", checkByPosition }));
    if (index % 2 === 1 && index < positions.length - 1) content.push({ text: "", pageBreak: "after" });
  });
  content.push({ text: "", pageBreak: "after" }, pageHeader(kind === "estimate" ? "Estimate Summary" : kind === "order" ? "Order Summary" : "Final Confirmation Summary", reference, brand));
  content.push({ text: `${positions.filter((position) => position.includedInQuotationTotal !== false).length} included Position(s) and ${positions.filter((position) => position.classification === "alternative").length} alternative option(s).`, style: "body", margin: [0, 0, 0, 12] }, summaryTable(projection));
  if (kind === "order") content.push({ text: "Customer acceptance", style: "sectionTitle", margin: [0, 22, 0, 7] }, { text: `Accepted ${formatDate(context.acceptedAt)} against immutable Estimate ${clean(context.estimateReference || projection.estimateReference)} revision ${number(context.estimateRevision)}.`, style: "body" }, { text: `Staff approval: ${context.staffApprovedAt ? `recorded ${formatDate(context.staffApprovedAt)}` : "Pending"}`, style: context.staffApprovedAt ? "checkOk" : "checkWarn", margin: [0, 6, 0, 0] });
  if (kind === "final_confirmation") content.push({ text: "Customer Position approval", style: "sectionTitle", margin: [0, 22, 0, 7] }, { text: "Each Position shown above must be explicitly approved against this exact confirmation revision. Any changed confirmation invalidates this sign-off and requires renewed review.", style: "notice" }, { table: { widths: ["*", 80], body: [[{ text: "POSITION", style: "fieldLabel" }, { text: "APPROVED", style: "fieldLabel" }], ...positions.filter((position) => position.includedInQuotationTotal !== false).map((position) => [{ text: clean(position.customerReference || position.reference), style: "body" }, { text: "[  ]", alignment: "center", fontSize: 11 }])] }, layout: { hLineColor: () => "#D7DDD9", vLineWidth: () => 0, paddingTop: () => 6, paddingBottom: () => 6 } }, { columns: [{ text: "Overall approval:  [  ]", style: "bodyStrong" }, { text: "Signature: ____________________", style: "bodyStrong" }, { text: "Date: ____________", style: "bodyStrong" }], margin: [0, 18, 0, 0] });
  return {
    pageSize: "A4", pageOrientation: "portrait", pageMargins: [40, 34, 40, 42],
    info: { title: `${title} ${reference}`, subject: `${projection.projectName} · immutable QuoteSuite customer document`, author: brand.name },
    defaultStyle: { font: "Roboto", fontSize: 9.5, color: "#17211D", lineHeight: 1.18 },
    styles: { eyebrow: { fontSize: 7.5, bold: true, color: brand.primary, characterSpacing: 1.1 }, pageTitle: { fontSize: 20, bold: true, color: brand.dark }, reference: { fontSize: 9, bold: true, color: "#53615A" }, sectionTitle: { fontSize: 14, bold: true, color: brand.dark }, positionTitle: { fontSize: 13, bold: true, color: brand.dark }, positionPrice: { fontSize: 10.5, bold: true, color: brand.primary }, positionMeta: { fontSize: 8.5, color: "#53615A" }, fieldLabel: { fontSize: 7.6, bold: true, color: "#5C6861", characterSpacing: 0.35 }, coverBody: { fontSize: 9.3, color: "#FFFFFF" }, body: { fontSize: 9.3, color: "#17211D" }, bodyStrong: { fontSize: 9.5, bold: true, color: brand.dark }, caption: { fontSize: 7.5, color: "#68736D" }, alternative: { fontSize: 8.5, bold: true, color: "#8A5B00" }, checkOk: { fontSize: 8.5, color: "#2F6F2F" }, checkWarn: { fontSize: 8.5, color: "#9A6300" }, notice: { fontSize: 8.8, color: "#44514A", fillColor: "#F1F4F1", margin: [8, 8, 8, 8] }, totalLabel: { fontSize: 11, bold: true, color: brand.dark }, totalValue: { fontSize: 13, bold: true, color: brand.primary } },
    footer: (currentPage, pageCount) => ({ columns: [{ text: `${title} · ${reference}` }, { text: `Page ${currentPage} of ${pageCount}`, alignment: "right" }], margin: [40, 12, 40, 0], fontSize: 7.5, color: "#68736D" }), content,
  };
}

export async function renderCustomerLifecyclePdf({ kind = "estimate", projection, context = {}, attachmentRoot = resolveAttachmentRoot() }) {
  if (!projection || typeof projection !== "object") throw Object.assign(new Error("Customer document projection is required."), { status: 400 });
  const assets = await projectionAssets(projection, attachmentRoot);
  return new Promise((resolve, reject) => { try { pdfMake.createPdf(documentDefinition({ kind, projection, context, assets })).getBuffer((buffer) => resolve(Buffer.from(buffer))); } catch (error) { reject(error); } });
}

export const customerLifecycleDocumentRendererInternals = { imageDataUrl, documentDefinition, projectionAssets };
