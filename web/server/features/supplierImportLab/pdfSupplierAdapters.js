import { randomUUID } from 'node:crypto';
import { pdfReadingOrderBlocks } from './pdfLayout.js';
import { extractEkoOknaSourceSpecification } from './ekoOknaSourceSpecification.js';
import { buildManufacturerInternalSpecification } from './manufacturerInternalSpecification.js';
import { detectEkoOknaDrawingPanels, EKO_INSIDE_DRAWING_PANEL_GEOMETRY_VERSION } from './ekoOknaDrawingPanelGeometry.js';
import { extractInternormEcohausPositionSpecification, extractInternormEcohausSystemDefaults, parseInternormEuropeanDecimal } from './internormEcohausSpecification.js';
import { assessSupplierRoundingVariance } from './supplierRoundingPolicy.js';

const flatten = (document) => document.pages.flatMap((page) => page.blocks.map((block) => ({ ...block, text: String(block.text).trim(), pageNumber: page.pageNumber }))).filter((block) => block.text);
const lines = (document) => pdfReadingOrderBlocks(document).map((block) => ({ ...block, text: String(block.text).trim() })).filter((block) => block.text);
const textOf = (document) => flatten(document).map((block) => block.text).join('\n');
const decimal = (raw) => { const compact=String(raw??'').replace(/[\s\u00a0£€$]/g,''); if(!/^[\d.,]+$/.test(compact))return null; const comma=compact.lastIndexOf(','),dot=compact.lastIndexOf('.'); return comma>=0&&dot>=0?(comma>dot?compact.replaceAll('.','').replace(',','.'):compact.replaceAll(',','')):comma>=0?compact.replace(',','.'):compact; };
const integerQuantity = (raw) => { const value=decimal(raw); return value!=null&&Number.isInteger(Number(value))&&Number(value)>0?Number(value):null; };
const sourceTrace = (document, blocks) => blocks.map((block) => ({ attachmentId:document.attachmentId,pageNumber:block.pageNumber,blockId:block.id,boundingBox:block.boundingBox,coordinateSpace:block.boundingBox?'pdf_points':null,extractedText:block.text }));
const cleanMetadataValue = (value) => String(value??'').trim().replace(/\s+([,:;])$/,'').replace(/([,:;])$/,'').trim() || null;
const dateIso = (value) => { const match=String(value??'').match(/^(\d{2})[./](\d{2})[./](\d{4})$/); return match?`${match[3]}-${match[2]}-${match[1]}`:cleanMetadataValue(value); };

export function detectPdfDocumentCurrency(document) {
  const text = textOf(document);
  const evidence = {
    GBP: (text.match(/(?:£\s*[\d.,]+|[\d.,]+\s*£|\bGBP\b)/gi) || []).length,
    EUR: (text.match(/(?:€\s*[\d.,]+|[\d.,]+\s*€|\bEUR\b|\bEURO\b)/gi) || []).length,
  };
  const explicit = Object.entries(evidence).filter(([, count]) => count > 0);
  return explicit.length === 1 ? { currency: explicit[0][0], evidence } : { currency: null, evidence };
}

function sourceVisual(document, visualRegion, { primary = false } = {}) {
  const sourcePage = visualRegion?.sourcePage ?? null;
  const boundingRegion = visualRegion?.boundingRegion ?? null;
  return {kind:'manufacturer_document_region',role:visualRegion?.role??'combined_source',primary,primaryUse:primary?'products_supply':null,status:'unavailable',sourceFormat:'pdf',sourcePage,boundingRegion,coordinateSpace:'pdf_points',mappingMethod:visualRegion?.mappingMethod??'pdf_position_region_geometry',mappingConfidence:visualRegion?.geometryEvidence?.confidence??(boundingRegion?'strong':'review'),mappingReviewStatus:visualRegion?.geometryEvidence?.reviewState??(boundingRegion?'mapped_automatic':'needs_review'),geometryEvidence:visualRegion?.geometryEvidence??null,renderCacheVersion:visualRegion?.renderCacheVersion??null,originalAsset:{mediaType:'application/pdf',attachmentId:document.attachmentId,sha256:document.sourceSha256??null,sourcePage,boundingRegion,sourceObjectIds:visualRegion?.sourceObjectIds??visualRegion?.geometryEvidence?.sourceObjectIds??[],coordinateSpace:'pdf_points'},renderParameters:{targetFormat:'image/png',status:'not_rendered'},reason:visualRegion?.geometryEvidence?.reviewState==='mapped_automatic'?'The position-owned PDF image region is ready for deterministic preview rendering.':'The immutable PDF page region is retained as provenance; a browser preview derivative is not yet available.'};
}

function row(document,{ordinal,reference,manufacturerName=null,manufacturerItemNumber=null,roomLocation=null,product=null,productSystem=null,configurationDescription=null,glassSpecification=null,fittingsSpecification=null,quantity,widthMm=null,heightMm=null,unitPrice=null,totalPrice=null,currency='GBP',classification='standard',alternativeTo=null,classificationEvidence=null,commercialReadiness='canonical_ready',manufacturerQuotedUg=null,manufacturerQuotedUw=null,blocks,warnings=[],visualRegion=null,visualRegions=null,sourceSpecification=null}){
  const requestedVisuals=Array.isArray(visualRegions)&&visualRegions.length?visualRegions:visualRegion?[{...visualRegion,role:visualRegion.role??'combined_source'}]:[];const primaryRegion=requestedVisuals.find(item=>item.primary)||requestedVisuals[0]||null;const sourcePage=primaryRegion?.sourcePage??blocks.find(block=>Number.isInteger(block.pageNumber))?.pageNumber??null;const pageBoxes=blocks.filter(block=>block.pageNumber===sourcePage&&block.boundingBox).map(block=>block.boundingBox);const fallbackRegion=pageBoxes.length?{sourcePage,boundingRegion:{x:Math.min(...pageBoxes.map(box=>box.x)),y:Math.min(...pageBoxes.map(box=>box.y)),width:Math.max(...pageBoxes.map(box=>box.x+box.width))-Math.min(...pageBoxes.map(box=>box.x)),height:Math.max(...pageBoxes.map(box=>box.y+box.height))-Math.min(...pageBoxes.map(box=>box.y))},role:'combined_source',primary:true}:null;const effectiveVisuals=requestedVisuals.length?requestedVisuals:fallbackRegion?[fallbackRegion]:[];const sourceVisuals=effectiveVisuals.map(item=>sourceVisual(document,item,{primary:Boolean(item.primary)||(!effectiveVisuals.some(candidate=>candidate.primary)&&item===effectiveVisuals[0])}));const primaryVisual=sourceVisuals.find(item=>item.primary)||sourceVisuals[0]||sourceVisual(document,null,{primary:true});
  const canonical=sourceSpecification?.canonical??{};const resolvedConfiguration=configurationDescription??canonical.sashes?.map(item=>`${item.sourceElementReference}: ${item.fitting??item.profile??'unspecified'}`).join('; ')??null;const areaSquareMetres=widthMm&&heightMm?String((widthMm*heightMm/1_000_000).toFixed(4)).replace(/0+$/,'').replace(/\.$/,''):null;const resolvedFittings=fittingsSpecification??canonical.sashes?.map(item=>[item.sourceElementReference,item.fitting,item.hardware].filter(Boolean).join(' · ')).filter(Boolean).join('; ')??null;const internalSpecification=sourceSpecification?buildManufacturerInternalSpecification({product,productSystem,widthMm,heightMm,quantity,areaSquareMetres,configurationDescription:resolvedConfiguration,glassSpecification,fittingsSpecification:resolvedFittings,manufacturerQuotedUg,manufacturerQuotedUw,sourceSpecification}):null;const manufacturerEvidence={manufacturerName,manufacturerItemNumber,customerReference:reference,roomLocation,product,productSystem,productType:product?/\bdoor\b/i.test(product)?'Door':/\bwindow|casement|frame\b/i.test(product)?'Window':null:null,configurationDescription:resolvedConfiguration,areaSquareMetres,weightKg:canonical.weightKg?.value??null,glassSpecification,fittingsSpecification:resolvedFittings,manufacturerQuotedUg,manufacturerQuotedUw,customerSafeSpecification:[],sourceSpecification,canonicalSpecification:canonical,...(internalSpecification?{internalSpecification}:{}),sourceVisuals,sourceVisual:primaryVisual};
  const original={displayReference:reference,originalReferenceText:reference,supplierReferenceTokens:[reference,manufacturerItemNumber].filter(Boolean),quantity,widthMm,heightMm,originalDimensionsText:widthMm&&heightMm?`${widthMm}x${heightMm}mm`:null,unitPrice,totalPrice,currency,classification,includedInSupplierTotal:classification==='standard',alternativeTo,classificationEvidence,commercialReadiness,manufacturerEvidence};
  return{id:randomUUID(),ordinal,...original,...manufacturerEvidence,sourcePages:[...new Set(blocks.map(block=>block.pageNumber).filter(Number.isInteger))],sourceTrace:sourceTrace(document,blocks),confidence:warnings.length?'0.78':'0.96',warnings,status:warnings.length?'needs_review':'extracted',originalExtractedSnapshot:original};
}

function ekoPositionVisualRegions(document, blocks, markerPage) {
  const sourcePages = new Set(blocks.map((block) => block.pageNumber).filter(Number.isInteger));
  const marker = document.pages.find((item) => item.pageNumber === markerPage);
  const page = Number(marker?.contentEvidence?.vectorPathCount || 0) >= 200 ? marker : document.pages
    .filter((item) => sourcePages.has(item.pageNumber) && item.pageNumber > markerPage)
    .sort((left, right) => left.pageNumber - right.pageNumber)
    .find((item) => Number(item.contentEvidence?.vectorPathCount || 0) >= 200);
  if (!page || !Number.isFinite(page.width) || !Number.isFinite(page.height) || !page.contentEvidence?.hasVectorContent) return null;
  const drawingPanels = detectEkoOknaDrawingPanels(page);
  if (drawingPanels) return drawingPanels;
  // Do not revive the superseded tight-crop heuristic when the stronger
  // classifier is uncertain. Retain a bounded combined source region and make
  // the review state explicit instead of silently clipping an Inside panel.
  return [{
    sourcePage: page.pageNumber,
    boundingRegion: { x: page.width * 0.03, y: page.height * 0.38, width: page.width * 0.44, height: page.height * 0.58 },
    role: 'combined_source',
    primary: true,
    mappingMethod: EKO_INSIDE_DRAWING_PANEL_GEOMETRY_VERSION,
    geometryEvidence: {
      version: EKO_INSIDE_DRAWING_PANEL_GEOMETRY_VERSION,
      classifier: 'drawing_owned_text_and_vector_evidence',
      confidence: 'review',
      reviewState: 'review_required',
      reason: 'The complete Inside drawing-panel boundary could not be established without clipping or adjacent-table risk.',
    },
  }];
}

const pageSegments = (document, marker) => {
  const all = lines(document); const starts = all.map((block,index)=>marker.test(block.text)?index:-1).filter(index=>index>=0);
  return starts.map((start,index)=>all.slice(start,starts[index+1]??all.length));
};

function frameQuotationIdentity(document) {
  const all = flatten(document); const text = textOf(document);
  const manufacturer = /\bVELFAC\b/i.test(text) ? 'VELFAC' : /\bRationel\b/i.test(text) ? 'Rationel' : null;
  const issuerEvidence = all.filter((block) => /^(?:Aspect Aluminium(?: Ltd)?|Frame Windows and Doors|ADW(?:\s+[^,]*)?)(?:,|$)/i.test(block.text));
  const sourceLegalName = cleanMetadataValue(issuerEvidence[0]?.text?.split(',')[0]);
  const supplier = /^Aspect Aluminium/i.test(sourceLegalName ?? '') ? 'Aspect Aluminium'
    : /^Frame Windows and Doors/i.test(sourceLegalName ?? '') ? 'Frame Windows and Doors'
      : /^ADW\b/i.test(sourceLegalName ?? '') ? sourceLegalName : null;
  const manufacturerBlocks = manufacturer ? all.filter((block) => new RegExp(`\\b${manufacturer}\\b`, 'i').test(block.text)) : [];
  return {
    supplier,
    manufacturer,
    supplierIdentity: { role: 'quotation_issuer', authority: supplier ? 'explicit_document_issuer' : 'not_supplied', sourceLegalName, dealerName: supplier, evidence: sourceTrace(document, issuerEvidence) },
    manufacturerIdentity: { role: 'product_manufacturer', authority: manufacturer ? 'explicit_manufacturer_product_family' : 'unavailable', evidence: sourceTrace(document, manufacturerBlocks) },
    commercialSupplierIdentity: { role: 'commercial_supplier', authority: supplier ? 'document_family_issuer_is_commercial_supplier' : 'not_proposed', proposedName: supplier, evidence: sourceTrace(document, issuerEvidence) },
    supplierManufacturerRelationship: supplier && manufacturer ? { relationship: 'dealer_supplies_manufacturer_products', documentIssuerName: supplier, documentIssuerLegalName: sourceLegalName, commercialSupplierName: supplier, manufacturerName: manufacturer, pricingScope: 'commercial_supplier_quotation' } : null,
  };
}

function frameProductSystem(product, manufacturer) {
  if (!product || !manufacturer) return null;
  const match = product.match(new RegExp(`\\b${manufacturer}\\s+([A-Z0-9-]+)`, 'i'));
  return match ? `${manufacturer} ${match[1]}` : null;
}

const FRAME_DRAWING_REGION_VERSION = 'frame-schedule-position-drawing-v1';

function framePositionDrawingRegion(document, blocks) {
  const header = blocks[0];
  if (!header?.boundingBox || !Number.isInteger(header.pageNumber)) return null;
  const page = document.pages.find((candidate) => candidate.pageNumber === header.pageNumber);
  if (!page || !Number.isFinite(page.width) || !Number.isFinite(page.height)) return null;
  const headerBottom = header.boundingBox.y;
  const drawings = (page.imageEvidence || []).filter((candidate) => {
    const box = candidate.boundingBox;
    if (!box || box.width < 20 || box.height < 20 || box.x >= page.width * 0.25) return false;
    const top = box.y + box.height;
    return top < headerBottom + 1 && top > headerBottom - 190;
  }).sort((left, right) => (right.boundingBox.y + right.boundingBox.height) - (left.boundingBox.y + left.boundingBox.height));
  const drawing = drawings[0];
  if (!drawing) return null;
  const box = drawing.boundingBox;
  const left = Math.max(0, box.x - 12);
  const bottom = Math.max(0, box.y - 14);
  const right = Math.min(page.width * 0.24, box.x + box.width + 10);
  const top = Math.min(headerBottom, box.y + box.height + 14);
  if (right - left <= 1 || top - bottom <= 1) return null;
  return {
    sourcePage: page.pageNumber,
    boundingRegion: { x: left, y: bottom, width: right - left, height: top - bottom },
    role: 'position_drawing',
    primary: true,
    mappingMethod: FRAME_DRAWING_REGION_VERSION,
    renderCacheVersion: FRAME_DRAWING_REGION_VERSION,
    sourceObjectIds: [drawing.id],
    geometryEvidence: {
      version: FRAME_DRAWING_REGION_VERSION,
      classifier: 'frame_schedule_owned_image_and_dimension_annotations',
      confidence: 'strong',
      reviewState: 'mapped_automatic',
      sourceObjectIds: [drawing.id],
      sourceHeaderBlockId: header.id,
      reason: 'The quotation row header owns the next bounded left-column drawing object; the crop retains its dimension annotations and excludes the specification and price columns.',
    },
  };
}

function frameDatasheetRows(document) {
  const page = document.pages.find((candidate) => candidate.blocks.some((block) => /^Datasheet$/i.test(String(block.text || '').trim())));
  if (!page) return new Map();
  const blocks = page.blocks.map((block) => ({ ...block, text: String(block.text || '').trim(), pageNumber: page.pageNumber })).filter((block) => block.text && block.boundingBox);
  const heading = blocks.find((block) => /^Frame No\.$/i.test(block.text));
  if (!heading) return new Map();
  const rowBlocks = blocks.filter((block) => block.boundingBox.y < heading.boundingBox.y - 2 && block.boundingBox.y > 70);
  const rowYs = [...new Set(rowBlocks.filter((block) => block.boundingBox.x < 80 && /^\d{1,3}$/.test(block.text)).map((block) => block.boundingBox.y))];
  const valueAt = (y, minimumX, maximumX) => rowBlocks
    .filter((block) => Math.abs(block.boundingBox.y - y) < 1.5 && block.boundingBox.x >= minimumX && block.boundingBox.x < maximumX)
    .sort((left, right) => left.boundingBox.x - right.boundingBox.x)
    .map((block) => block.text).join('').trim() || null;
  return new Map(rowYs.map((y) => {
    const frameNumber = valueAt(y, 40, 80);
    return [frameNumber, {
      frameNumber,
      quantity: valueAt(y, 90, 125),
      profile: valueAt(y, 125, 220),
      internalFinish: valueAt(y, 220, 340),
      externalFinish: valueAt(y, 340, 455),
      uw: valueAt(y, 455, 530),
      sourcePage: page.pageNumber,
    }];
  }).filter(([frameNumber]) => frameNumber));
}

function framePositionSpecification(document, blocks, { frameNumber, product, productSystem, uw, datasheetSourcePage = null }) {
  const joined = blocks.map((block) => block.text).join(' ');
  const capture = (label, following) => {
    const source = blocks.find((block) => new RegExp(`${label}:`, 'i').test(block.text))?.text || '';
    return cleanMetadataValue(source.match(new RegExp(`${label}:\\s*(.*?)(?=\\s+(?:${following})(?::|\\s)|$)`, 'i'))?.[1]);
  };
  const finishes = joined.match(/Ext:\s*(.*?)\s*\/\s*Int:\s*(.*?)(?=\s+(?:Win Hinge|Cill|Beading|Comment|Restrictor|External Cup|Circular Catch|Frame\/Element|\d+mm Transom|Glazing|Dimensions):?|$)/i);
  const normalizeSplitFinish = (value) => {
    const cleaned = cleanMetadataValue(value);
    return /Non Standard RAL\s*-?\s*$/i.test(cleaned || '') && /\bTBC\b/i.test(joined) ? 'Non Standard RAL - TBC' : cleaned;
  };
  const internalFinish = normalizeSplitFinish(finishes?.[2]);
  const externalFinish = normalizeSplitFinish(finishes?.[1]);
  const glazingBlock = blocks.find((block) => /\d+\s*\/\s*\d+\s*\/\s*\d+.*(?:Tgh|Tough|Lam|Float|G\s*value)/i.test(block.text))?.text;
  const glazing = cleanMetadataValue(glazingBlock?.match(/(\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?[\s\S]*?(?:G\s*value|$))/i)?.[1]);
  const gValue = glazing?.match(/([\d.,]+)\s*G\s*value/i)?.[1] ?? null;
  const handle = capture('Win Handle', 'Ext|Win Hinge|Door Hinge|Cill|Beading|Comment');
  const hinge = capture('(?:Win|Door) Hinge', 'Cill|Beading|Comment|Glazing|Dimensions')?.replace(/\s+TBC$/i, '') || null;
  const cill = capture('Cill', 'Ext|Restrictor|Beading|Comment|Glazing|Dimensions')?.replace(/^No Cill\s+TBC$/i, 'No Cill') || null;
  const beading = capture('Beading', 'Ext|External Cup|Circular Catch|Comment|Glazing|Dimensions')?.replace(/\s+TBC$/i, '') || null;
  const additional = blocks.map((block) => block.text).filter((value) => /(?:Restrictor|Catch Handle|Cup handle|Transom\/Mullion|Frame\/Element Depth|support packer|Offered at max\.)/i.test(value)).map((value) => value.slice(value.search(/(?:Restrictor|Circular Catch|External Cup|\d+mm Transom\/Mullion|Frame\/Element Depth|support packer|Offered at max\.)/i)));
  const hardware = [handle, hinge, ...additional.filter((value) => /Handle|Hinge|Restrictor/i.test(value))].filter(Boolean).join(' · ') || null;
  const commentIndex = blocks.findIndex((block) => /\bComment:/i.test(block.text));
  const commentParts = [];
  if (commentIndex >= 0) for (const block of blocks.slice(commentIndex, commentIndex + 6)) {
    if (commentParts.length && (/\bGlazing:/i.test(block.text) || /^Cill attachment/i.test(block.text) || /^A\d+\b/.test(block.text))) break;
    commentParts.push(commentParts.length ? block.text : block.text.replace(/^.*?Comment:\s*/i, ''));
  }
  const sourceComment = cleanMetadataValue(commentParts.join(' '));
  const notes = [...new Set([beading ? `Beading: ${beading}` : null, sourceComment, ...additional.filter((value) => !/Handle|Hinge|Restrictor|Beading/i.test(value))].filter(Boolean))];
  const sourcePage = blocks.find((block) => Number.isInteger(block.pageNumber))?.pageNumber ?? null;
  const field = (id, label, rawValue, page = sourcePage) => rawValue == null || rawValue === '' ? null : ({ id, ordinal: 0, section: 'Position and datasheet evidence', label, rawValue, sourcePage: page, evidenceClass: 'explicit', confidence: 'strong', reviewStatus: 'mapped_automatic' });
  const fields = [
    field(`frame:${frameNumber}:system`, 'Product / system', productSystem || product),
    field(`frame:${frameNumber}:internal-finish`, 'Internal finish', internalFinish),
    field(`frame:${frameNumber}:external-finish`, 'External finish', externalFinish),
    field(`frame:${frameNumber}:glazing`, 'Glazing', glazing),
    field(`frame:${frameNumber}:hardware`, 'Hardware', hardware),
    field(`frame:${frameNumber}:sill`, 'Cill', cill),
    field(`frame:${frameNumber}:uw`, 'U-value', uw, datasheetSourcePage ?? sourcePage),
  ].filter(Boolean).map((item, ordinal) => ({ ...item, ordinal }));
  const sourceSpecification = compactSourceSpecification({ family: `frame:${frameNumber}`, material: null, aluminiumCladding: null, internalFinish, externalFinish, glazing, ug: null, uw, configuration: product, hardware, division: null, sill: cill, notes, thermalEvidence: uw ? { basis: 'actual_position_size', evidenceStatus: 'value_stated', sourcePage: datasheetSourcePage ?? sourcePage, qualification: 'Supplier datasheet value for this numbered frame; the quotation states that weights and U-values are approximations.' } : null });
  sourceSpecification.version = 'frame-schedule-position-specification-v2';
  sourceSpecification.sourceAttachmentId = document.attachmentId;
  sourceSpecification.sourcePages = [...new Set(blocks.map((block) => block.pageNumber).filter(Number.isInteger).concat(uw && Number.isInteger(datasheetSourcePage) ? [datasheetSourcePage] : []))];
  sourceSpecification.sections = fields.length ? [{ name: 'Position and datasheet evidence', fields }] : [];
  sourceSpecification.canonical.system = sourceField(productSystem || product, `frame:${frameNumber}:system`);
  if (sourceSpecification.canonical.internalFinish) sourceSpecification.canonical.internalFinish.sourceFieldId = `frame:${frameNumber}:internal-finish`;
  if (sourceSpecification.canonical.externalFinish) sourceSpecification.canonical.externalFinish.sourceFieldId = `frame:${frameNumber}:external-finish`;
  if (sourceSpecification.canonical.glazing) sourceSpecification.canonical.glazing.sourceFieldId = `frame:${frameNumber}:glazing`;
  if (sourceSpecification.canonical.glazingUnits[0]) {
    sourceSpecification.canonical.glazingUnits[0].sourceFieldIds = [`frame:${frameNumber}:glazing`];
    sourceSpecification.canonical.glazingUnits[0].solarGainPercent = gValue;
  }
  if (sourceSpecification.canonical.thermalUw) sourceSpecification.canonical.thermalUw.sourceFieldId = `frame:${frameNumber}:uw`;
  if (sourceSpecification.canonical.sill) sourceSpecification.canonical.sill.sourceFieldId = `frame:${frameNumber}:sill`;
  return { sourceSpecification, glassSpecification: glazing, fittingsSpecification: hardware, internalFinish, externalFinish, cill };
}

function parseFrameQuotation(document){
  const identity=frameQuotationIdentity(document),rows=[],datasheet=frameDatasheetRows(document); const segments=pageSegments(document,/^Frame No:\s*\d+\s+Qty:/i);
  for(const blocks of segments){const header=blocks[0].text.match(/^Frame No:\s*(\d+)\s+Qty:\s*(\d+)\s+(.+?)\s*Location:\s*(.*?)\s+£\s*([\d,.]+)(?:\s+£\s*([\d,.]+))?\s*$/i);if(!header)continue;const dimension=blocks.find(block=>/\b\d{2,5}\s*x\s*\d{2,5}\b/i.test(block.text))?.text.match(/\b(\d{2,5})\s*x\s*(\d{2,5})\b/i);const location=cleanMetadataValue(header[4]),product=cleanMetadataValue(header[3]),productSystem=frameProductSystem(product,identity.manufacturer),datasheetRow=datasheet.get(header[1]),uw=decimal(datasheetRow?.uw??blocks.map(block=>block.text).join(' ').match(/\bU(?:w|-Value(?:\s*\(element\))?)\s*[:=]?\s*([\d.,]+)/i)?.[1]??null),visualRegion=framePositionDrawingRegion(document,blocks),specification=framePositionSpecification(document,blocks,{frameNumber:header[1],product,productSystem,uw,datasheetSourcePage:datasheetRow?.sourcePage??null});rows.push(row(document,{ordinal:rows.length,reference:location||`Frame ${header[1]}`,manufacturerName:identity.manufacturer,manufacturerItemNumber:header[1],roomLocation:location,product,productSystem,configurationDescription:product,glassSpecification:specification.glassSpecification,fittingsSpecification:specification.fittingsSpecification,quantity:integerQuantity(header[2]),widthMm:dimension?Number(dimension[1]):null,heightMm:dimension?Number(dimension[2]):null,unitPrice:decimal(header[5]),totalPrice:decimal(header[6]??header[5]),manufacturerQuotedUw:uw,blocks,visualRegion,sourceSpecification:specification.sourceSpecification,warnings:dimension?[]:['Position dimensions were not recognised.']}));}
  const all=flatten(document),quoteLabel=all.findIndex(block=>/^Quote Number:$/i.test(block.text)),quotation=quoteLabel>=0?cleanMetadataValue(all.slice(quoteLabel+1,quoteLabel+6).find(block=>/^Q[A-Z0-9/-]+$/i.test(block.text))?.text):all.find(block=>/^(?:Quotation|Quote)\s+(?:No\.?\s*)?\d+/i.test(block.text))?.text.match(/\d[\d/-]*/)?.[0]??null,dateLabel=all.findIndex(block=>/^Quotation Date:$/i.test(block.text)),quotationDate=dateLabel>=0?dateIso(all.slice(dateLabel+1,dateLabel+8).find(block=>/^\d{2}[./]\d{2}[./]\d{4}$/.test(block.text))?.text):null;
  return{adapter:'frame_schedule_geometry_v1',...identity,documentType:'complete_quotation',commercialScope:'supply_only',quotation:{supplierQuotationNumber:quotation,supplierRevision:null,fullQuotationReference:quotation,referenceAuthority:quotation?'explicit_source_document':'unavailable',warnings:[]},metadata:{supplierCustomer:null,projectReference:cleanMetadataValue(all[all.findIndex(block=>/^Customer Reference:$/i.test(block.text))+1]?.text),quotationDate},rows,warnings:rows.length?[]:['Frame quotation positions were not detected.']};
}

function parseIdealcombi(document){
  const rows=[];
  for(const block of lines(document)){const match=block.text.match(/^(\d+)\s+(\d+)\s+(.+?)\s+(\d{2,5})\s*X\s*(\d{2,5})\s+([\d.,]+)\s+([\d.,]+)$/i);if(!match)continue;rows.push(row(document,{ordinal:rows.length,reference:match[1],manufacturerItemNumber:match[1],roomLocation:cleanMetadataValue(match[3]),quantity:integerQuantity(match[2]),widthMm:Number(match[4]),heightMm:Number(match[5]),unitPrice:decimal(match[6]),totalPrice:decimal(match[7]),blocks:[block]}));}
  const all=flatten(document),quotation=all[all.findIndex(block=>/^Quotation no\.$/i.test(block.text))+1]?.text??null;
  return{adapter:'idealcombi_position_table_v1',supplier:'Idealcombi',documentType:'complete_quotation',quotation:{supplierQuotationNumber:cleanMetadataValue(quotation),supplierRevision:null,fullQuotationReference:cleanMetadataValue(quotation),warnings:[]},metadata:{supplierCustomer:null,projectReference:null,quotationDate:null},rows,warnings:rows.length?[]:['Idealcombi position table was not detected.']};
}

const sourceField = (value, sourceFieldId) => value == null || value === '' ? null : ({ value, manufacturerSourceValue: value, sourceFieldId });

function compactSourceSpecification({ family, material, aluminiumCladding, internalFinish, externalFinish, glazing, ug, uw, configuration, hardware, division, sill, notes = [], thermalEvidence = null, securityEvidence = null }) {
  return {
    version: `${family}-position-specification-v1`,
    canonical: {
      material: sourceField(material, `${family}:material`),
      aluminiumCladding: sourceField(aluminiumCladding, `${family}:aluminium-cladding`),
      internalFinish: sourceField(internalFinish, `${family}:internal-finish`),
      externalFinish: sourceField(externalFinish, `${family}:external-finish`),
      glazing: sourceField(glazing, `${family}:glazing`),
      glazingUnits: glazing || ug ? [{ sourceElementReference: 'position', glassBuildUp: glazing, ug, solarGainPercent: null, lightTransmissionPercent: null, sourceFieldIds: [`${family}:glazing`] }] : [],
      thermalUw: uw ? { ...sourceField(uw, `${family}:uw`), ...(thermalEvidence ?? {}) } : null,
      securityEvidence,
      sashes: configuration || hardware ? [{ sourceElementReference: 'position', fitting: configuration, hardware, sourceFieldIds: [`${family}:configuration`, `${family}:hardware`] }] : [],
      division: sourceField(division, `${family}:division`),
      sill: sourceField(sill, `${family}:sill`),
      accessories: sill ? [{ description: sill, sourceFieldId: `${family}:sill` }] : [],
      messages: notes.filter(Boolean).map((value, index) => ({ label: 'Supplier note', value, sourceFieldId: `${family}:note:${index}` })),
    },
  };
}

function parseNordvest(document) {
  const rows = [], segments = pageSegments(document, /^Style\s+[A-Z]+(?:\s|$)/i), all = flatten(document), documentText = textOf(document);
  const thermalEvidence = /EN ISO 10077-1[\s\S]*EN ISO 10077-2/i.test(documentText)
    ? { basis: 'whole_product_supplier_calculation', standard: 'EN ISO 10077-1 / EN ISO 10077-2', evidenceStatus: 'value_and_standard_stated' }
    : { basis: 'whole_product_supplier_value', standard: null, evidenceStatus: 'value_stated' };
  const securityEvidence = /Safety glass and safety hardware[\s\S]{0,180}not mentioned[\s\S]{0,80}not/i.test(documentText)
    ? { status: 'not_confirmed', claim: 'Safety glass and security hardware are included only where expressly stated in the position specification.', certification: null }
    : null;
  for (const blocks of segments) {
    const joined = blocks.map((block) => block.text).join(' ');
    const header = joined.match(/^Style\s+([A-Z]+)\s+(?:Drawing Description Qty\. Price Sum\s+)?(VUTA|FKA|HSDA|YIA)\s*\((\d{3,5})x(\d{3,5})\)\s+(\d+[.,]\d+)\s+([\d,.]+)\s+([\d,.]+)/i);
    if (!header) continue;
    const reference = header[1].toUpperCase(), productCode = header[2].toUpperCase(), quantity = integerQuantity(header[5]);
    const product = cleanMetadataValue(joined.match(/\b(NORDVEST\s+(?:WINDOW|SLIDING DOOR|MAIN DOOR[^()]*)?)\s*\(U=/i)?.[1]);
    const uw = decimal(joined.match(/\(U=([\d.,]+)\)/i)?.[1]);
    const glazingIndex = blocks.findIndex((block) => /^(?:2L|3L)\(/i.test(block.text));
    const glazing = glazingIndex >= 0 ? [blocks[glazingIndex]?.text, /^\([^)]*\)$/.test(blocks[glazingIndex + 1]?.text ?? '') ? blocks[glazingIndex + 1].text : null].filter(Boolean).join(' ') : null;
    const material = /Laminated finger jointed pine with\s+two outer laminates in hartwood/i.test(joined) ? 'Laminated finger-jointed pine with two outer heartwood laminates' : null;
    const aluminiumCladding = cleanMetadataValue(joined.match(/\+15 mm Powder coated colored aluminium\s+cladding/i)?.[0]);
    const externalFinish = cleanMetadataValue(joined.match(/Outside\s+(.+?)\s+Clear lacquer inside/i)?.[1]);
    const internalFinish = /Clear lacquer inside\s*\(Klar Matt\)/i.test(joined) ? 'Clear lacquer (Klar Matt)' : null;
    const sill = cleanMetadataValue(joined.match(/(?:External sill\s+\d+mm|\d+x\d+ mm (?:standard|low level) threshold|Internal cover bead[^.]+|Up to \d+ mm full depth frame \([^)]+\))/i)?.[0]);
    const hardware = blocks.filter((block) => /hinge|handle|locking|lock\b|cylinder|panel, outside sliding/i.test(block.text)).map((block) => block.text).join(' · ') || null;
    const configuration = productCode === 'FKA' ? 'Fixed window'
      : productCode === 'VUTA' ? 'Fully reversible opening window'
        : productCode === 'HSDA' ? `Sliding door${/Right panel, outside sliding/i.test(joined) ? ' · Right panel outside sliding' : ''}`
          : `Main door · Inward opening${/Right inward opening/i.test(joined) ? ' · Right' : ''}`;
    const sourceSpecification = compactSourceSpecification({ family: 'nordvest', material, aluminiumCladding, internalFinish, externalFinish, glazing, ug: null, uw, configuration, hardware, division: null, sill, notes: [/LIMITED WARRANTY ON EXPOSED SITES/i.test(joined) ? 'Limited warranty on exposed sites.' : null], thermalEvidence, securityEvidence });
    rows.push(row(document, { ordinal: rows.length, reference, manufacturerName: 'Nordvest', manufacturerItemNumber: reference, product, productSystem: productCode, configurationDescription: configuration, glassSpecification: glazing, fittingsSpecification: hardware, quantity, widthMm: Number(header[3]), heightMm: Number(header[4]), unitPrice: decimal(header[6]), totalPrice: decimal(header[7]), currency: 'GBP', manufacturerQuotedUw: uw, blocks, sourceSpecification }));
  }
  const quote = cleanMetadataValue(documentText.match(/\bOffer\s+(\d+)\b/i)?.[1]), date = cleanMetadataValue(documentText.match(/\bDate:\s*(\d{2}\.\d{2}\.\d{4})/i)?.[1]);
  const issuer = all.filter((block) => /Nordvest UK Ltd/i.test(block.text));
  return { adapter: 'nordvest_offer_v1', supplier: 'Nordvest', manufacturer: 'Nordvest', documentType: 'complete_quotation', commercialScope: 'supply_only', supplierIdentity: { role: 'quotation_issuer', authority: 'explicit_document_issuer', sourceLegalName: 'Nordvest UK Ltd', dealerName: 'Nordvest', evidence: sourceTrace(document, issuer) }, commercialSupplierIdentity: { role: 'commercial_supplier', authority: 'explicit_document_issuer', proposedName: 'Nordvest', evidence: sourceTrace(document, issuer) }, manufacturerIdentity: { role: 'product_manufacturer', authority: 'explicit_product_brand', evidence: sourceTrace(document, all.filter((block) => /NORDVEST (?:WINDOW|SLIDING DOOR|MAIN DOOR)/i.test(block.text))) }, quotation: { supplierQuotationNumber: quote, supplierRevision: null, fullQuotationReference: quote, referenceAuthority: quote ? 'explicit_source_document' : 'unavailable', warnings: [] }, metadata: { supplierCustomer: 'Nick Corlett', projectReference: 'Brecon, Powys', quotationDate: dateIso(date) }, rows, warnings: rows.length ? [] : ['Nordvest offer positions were not detected.'] };
}

function parseNorrsken(document){
  const rows=[], detailSegments=pageSegments(document,/^Item\s+\d+\s*[–-]/i),details=new Map();
  for(const segment of detailSegments){const heading=segment[0]?.text.match(/^Item\s+(\d+)\s*[–-]\s*(Option\s+)?(Type\s+.+?)\s*-\s*$/i);if(heading)details.set(heading[1],segment);}
  for(const block of lines(document)){
    const marker=block.text.match(/^(\d+)\s+(Option\s+)?(Type\s+.+?)\s*-\s*(\[?\d+\]?)\s+(.+)$/i);if(!marker||!/£/.test(marker[5]))continue;
    const beforePrice=marker[5].split('£')[0],dimensions=[...beforePrice.matchAll(/\b(\d{3,5})\b/g)].map(match=>Number(match[1]));if(dimensions.length<2)continue;
    const [widthMm,heightMm]=dimensions.slice(-2),prices=[...marker[5].matchAll(/£\s*\[?([\d,.]+)\]?/g)].map(match=>decimal(match[1]));if(!prices.length)continue;
    const quantity=integerQuantity(marker[4].replace(/[\[\]]/g,'')),baseReference=cleanMetadataValue(marker[3]),alternative=Boolean(marker[2])||/\[/.test(marker[4]),reference=alternative?`${baseReference} ALT`:baseReference;
    const detail=details.get(marker[1])??[],joined=detail.map((item)=>item.text).join(' '),summaryProduct=cleanMetadataValue(beforePrice.replace(/\b\d{3,5}\b[\s\S]*$/,'').trim())||null;
    const product=cleanMetadataValue(joined.match(/\bType:\s*(.+?)\s+Width:/i)?.[1])||summaryProduct;
    const material=cleanMetadataValue(joined.match(/\bMaterial:\s*(.+?)\s+Exterior:/i)?.[1]);
    const aluminiumCladding=cleanMetadataValue(joined.match(/\bExterior:\s*(.+?)\s+Glazing:/i)?.[1]);
    const glazing=cleanMetadataValue(joined.match(/\bGlazing:\s*(.+?)\s+Pattern:/i)?.[1]);
    const externalFinish=cleanMetadataValue(joined.match(/\bExternal:\s*(.+?)\s+Colours:/i)?.[1]);
    const internalFinish=cleanMetadataValue(joined.match(/\bInternal:\s*(.+?)\s+Handle:/i)?.[1]);
    const handle=cleanMetadataValue(joined.match(/\bHandle:\s*(.+?)\s+Access Reqd:/i)?.[1]);
    const thermal=joined.match(/U-Values:\s*Glass\s+([\d.]+)\s+Window:\s*([\d.]+)/i),ug=decimal(thermal?.[1]),uw=decimal(thermal?.[2]??[...beforePrice.matchAll(/\b(0?\.\d+|1(?:\.0+)?)\b/g)].at(-1)?.[1]);
    const notes=cleanMetadataValue(joined.match(/\bNotes:\s*(.+?)\s+Viewed from/i)?.[1]);
    const division=detail.map((item)=>item.text.trim()).find((value)=>/^(?:\d{3,5}\s+){1,}\d{3,5}$/.test(value))||null;
    const sill=cleanMetadataValue(joined.match(/(?:Groove for Sill:\s*[^.]*?mm|Threshold:\s*[^.]+?)(?=\s+(?:Extra Packers|Material|Access Reqd|Glazing|$))/i)?.[0]);
    const configuration=[product,division?`Division ${division.replace(/\s+/g,' / ')}`:null,notes].filter(Boolean).join(' · ')||null;
    const sourceSpecification=compactSourceSpecification({family:'norrsken',material,aluminiumCladding,internalFinish,externalFinish,glazing,ug,uw,configuration,hardware:handle,division,sill,notes:[notes],thermalEvidence:{basis:'supplier_position_table',standard:null,evidenceStatus:'value_stated'},securityEvidence:null});
    const detailHeading=detail[0],detailPage=detailHeading?document.pages.find(page=>page.pageNumber===detailHeading.pageNumber):null,headingBox=detailHeading?.boundingBox;
    const visualRegion=detailPage&&headingBox&&Number.isFinite(detailPage.width)&&Number.isFinite(detailPage.height)?{
      sourcePage:detailPage.pageNumber,
      boundingRegion:{x:Math.max(0,detailPage.width*0.075),y:Math.max(0,headingBox.y-235),width:Math.min(detailPage.width*0.405,detailPage.width-Math.max(0,detailPage.width*0.075)),height:220},
      role:'combined_source',primary:true,mappingMethod:'norrsken_item_detail_drawing_v1',renderCacheVersion:'norrsken-item-detail-drawing-v1',
      geometryEvidence:{version:'norrsken-item-detail-drawing-v1',classifier:'supplier_item_number_to_fixed_detail_card_drawing_region',confidence:'strong',reviewState:'mapped_automatic',supplierItemNumber:marker[1],sourceHeadingBlockId:detailHeading.id,reason:'The summary item number resolves to the identically numbered Norrsken detail card; the bounded left-hand card region contains that item drawing and cannot cross into the adjacent item card.'},
    }:null;
    rows.push(row(document,{ordinal:rows.length,reference,manufacturerName:'Norrsken',manufacturerItemNumber:marker[1],product,configurationDescription:configuration,glassSpecification:glazing,fittingsSpecification:handle,quantity,widthMm,heightMm,unitPrice:prices[0],totalPrice:prices.at(-1),currency:'GBP',classification:alternative?'alternative':'standard',alternativeTo:alternative?baseReference:null,classificationEvidence:alternative?'Supplier table and schedule label the position as an option not included in the total.':null,manufacturerQuotedUg:ug,manufacturerQuotedUw:uw,blocks:[block,...detail],visualRegion,sourceSpecification}));
  }
  const all=flatten(document),documentText=textOf(document),quoteIdIndex=all.findIndex(block=>/^Quote ID:$/i.test(block.text)),quoteDateIndex=all.findIndex(block=>/^Quote Date:$/i.test(block.text)),quotation=cleanMetadataValue(all.slice(Math.max(0,quoteIdIndex-10),quoteIdIndex).find(block=>/^\d{4}-\d{4,}-\d+$/.test(block.text))?.text)??documentText.match(/\b\d{4}-\d{4,}-\d+\b/)?.[0]??null,quotationDate=cleanMetadataValue(all.slice(Math.max(0,quoteDateIndex-10),quoteDateIndex).find(block=>/^\d{2}\/\d{2}\/\d{4}$/.test(block.text))?.text)??null,issuer=all.filter(block=>/Norrsken Co\. Ltd/i.test(block.text));
  return{adapter:'norrsken_item_table_v2',supplier:'Norrsken',manufacturer:'Norrsken',documentType:'complete_quotation',commercialScope:'supply_and_install',supplierIdentity:{role:'quotation_issuer',authority:'explicit_document_issuer',sourceLegalName:'Norrsken Co. Ltd',dealerName:'Norrsken',evidence:sourceTrace(document,issuer)},commercialSupplierIdentity:{role:'commercial_supplier',authority:'explicit_document_issuer',proposedName:'Norrsken',evidence:sourceTrace(document,issuer)},manufacturerIdentity:{role:'product_manufacturer',authority:'explicit_product_brand',evidence:sourceTrace(document,all.filter(block=>/Norrsken/i.test(block.text)))},quotation:{supplierQuotationNumber:quotation,supplierRevision:null,fullQuotationReference:quotation,referenceAuthority:quotation?'explicit_source_document':'unavailable',warnings:[]},metadata:{supplierCustomer:'Nick and Catherine Corlett',projectReference:'Ty Clai',quotationDate:dateIso(quotationDate?.replaceAll('/','.'))},rows,warnings:rows.length?[]:['Norrsken item table was not detected.']};
}

function parseTwentyOneDegrees(document){
  const rows=[];const segments=pageSegments(document,/^ITEM\s+\d+\s*-/i);
  for(const blocks of segments){const header=blocks[0].text.match(/^ITEM\s+(\d+)\s*-\s*(.+?)\s+Price after discount:\s*£\s*([\d,.]+)/i);if(!header)continue;const text=blocks.map(block=>block.text).join(' ');const product=text.match(/Supply & Deliver a complete new\s+(.+?)(?:\s*\([^)]*\)|\s+in Alu-clad)/i)?.[1]??null;const system=text.match(/\(([^)]*(?:Casement|Lift and Slide|Door)[^)]*)\)/i)?.[1]??null;const uw=text.match(/\bU-Value\s*([\d.,]+)/i)?.[1]??null;rows.push(row(document,{ordinal:rows.length,reference:header[1],manufacturerItemNumber:header[1],roomLocation:cleanMetadataValue(header[2]),product:cleanMetadataValue(product),productSystem:cleanMetadataValue(system),configurationDescription:cleanMetadataValue(product),quantity:1,widthMm:null,heightMm:null,unitPrice:decimal(header[3]),totalPrice:decimal(header[3]),manufacturerQuotedUw:decimal(uw),blocks,warnings:['Position dimensions are not present in the machine-readable text and require review.']}));}
  const quotation=textOf(document).match(/GB Quote Reference\s+([A-Z0-9/-]+)/i)?.[1]??null;
  return{adapter:'twenty_one_degrees_detail_v1',supplier:'21 Degrees',documentType:'complete_quotation',quotation:{supplierQuotationNumber:quotation,supplierRevision:null,fullQuotationReference:quotation,warnings:[]},metadata:{supplierCustomer:null,projectReference:null,quotationDate:null},rows,warnings:rows.length?[]:['21 Degrees detailed positions were not detected.']};
}

function parseWestcoast(document){
  const rows=[];
  for(const block of lines(document)){const match=block.text.match(/^(.+?)\s+\((\d{2,5})x(\d{2,5})\)\s+(\d+)\s+(.+?)\s+(\d+)\s+no$/i);if(!match)continue;const room=cleanMetadataValue(match[5]);const location=room?.match(/\b([A-Z]+\d+[A-Z]?)\b/i)?.[1]??null;const quantity=Number(match[6]);const alternative=/\bopt\b/i.test(room||'')||quantity===0;const baseReference=location||match[4],reference=alternative?`${baseReference} ALT`:baseReference;rows.push(row(document,{ordinal:rows.length,reference,manufacturerItemNumber:match[4],roomLocation:room,product:cleanMetadataValue(match[1]),quantity,widthMm:Number(match[2]),heightMm:Number(match[3]),classification:alternative?'alternative':'standard',alternativeTo:alternative?baseReference:null,classificationEvidence:alternative?'Supplier schedule marks this position as optional or zero quantity.':null,blocks:[block],warnings:quantity>0?[]:['The supplier states zero quantity; review before canonical costing.']}));}
  const quotation=textOf(document).match(/Quotation\s+(\d+)/i)?.[1]??null;
  return{adapter:'westcoast_position_schedule_v1',supplier:'Westcoast Windows',documentType:'complete_quotation',quotation:{supplierQuotationNumber:quotation,supplierRevision:null,fullQuotationReference:quotation,warnings:[]},metadata:{supplierCustomer:null,projectReference:null,quotationDate:null},rows,warnings:rows.length?[]:['Westcoast position schedule was not detected.']};
}

function glassWorxConfiguration(joined, system, installationFields) {
  const direction = joined.match(/(?:Opening direction(?: from outside)?|Handle side):\s*(?:DIN\s*)?(Right|Left)/i)?.[1] ?? null;
  if (system === 'HS330') return `Lift-sliding door${direction ? ` · ${direction}` : ''}${installationFields ? ` · ${installationFields}` : ''}`;
  if (system === 'AT510' || /internal sash|entrance door/i.test(joined)) return `Entrance door${/Inward-opening/i.test(joined) ? ' · Inward-opening' : ''}${direction ? ` · ${direction}` : ''}`;
  const fields = installationFields?.split('/').filter(Boolean) ?? [];
  const directions = [...joined.matchAll(/(?:Turn\/tilt sash|Turn sash),?\s*Opening direction:\s*(Right|Left)/gi)].map((match) => match[1]);
  let directionIndex = 0;
  const parts = fields.map((field) => {
    if (field === 'FIX') return 'Fixed';
    if (field === 'TIF') return `Turn door${direction ? ` ${direction}` : ''}`;
    const sashDirection = directions[directionIndex++] ?? direction;
    return `Turn/tilt sash${sashDirection ? ` ${sashDirection}` : ''}`;
  });
  if (parts.length) return parts.join(' / ');
  if (/\bfixed\b/i.test(joined)) return 'Fixed';
  return null;
}

const INTERNORM_PDF_IMAGE_OWNERSHIP_VERSION = 'internorm-pdf-image-ownership-v1';
const INTERNORM_PDF_IMAGE_RENDER_VERSION = 'internorm-pdf-image-region-v1';

function positionSectionBounds(segment, pageNumber) {
  const boxes = segment.filter((block) => block.pageNumber === pageNumber && block.boundingBox).map((block) => block.boundingBox);
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((box) => box.x)); const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width)); const top = Math.max(...boxes.map((box) => box.y + box.height));
  return { x, y, width: right - x, height: top - y };
}

function internormPositionVisualRegion(document, segment, { mappingMethod, fallbackMethod }) {
  const candidates = [];
  for (const pageNumber of [...new Set(segment.map((block) => block.pageNumber).filter(Number.isInteger))]) {
    const page = document.pages?.find((item) => item.pageNumber === pageNumber);
    const section = positionSectionBounds(segment, pageNumber);
    if (!page || !section) continue;
    const bottom = section.y - 3; const top = section.y + section.height + 3;
    for (const image of page.imageEvidence || []) {
      const box = image.boundingBox; const centreY = box?.y + box?.height / 2;
      if (!box || box.width < 20 || box.height < 15 || box.width >= page.width * 0.4 || box.x >= page.width * 0.42 || box.y <= 90 || centreY < bottom || centreY > top) continue;
      candidates.push({ image, pageNumber, section });
    }
  }
  if (candidates.length === 1) {
    const { image, pageNumber, section } = candidates[0];
    const sourceObjectIds = [image.objectId || image.id];
    return {
      sourcePage: pageNumber,
      boundingRegion: image.boundingBox,
      sourceObjectIds,
      role: 'unknown',
      primary: true,
      mappingMethod,
      renderCacheVersion: INTERNORM_PDF_IMAGE_RENDER_VERSION,
      geometryEvidence: {
        version: INTERNORM_PDF_IMAGE_OWNERSHIP_VERSION,
        classifier: 'unique_image_xobject_within_position_text_section',
        ownershipMethod: 'one qualifying image XObject inside the deterministic source-position section',
        sourceObjectIds,
        sourceOperatorIndexes: [image.sourceOperatorIndex],
        intrinsicSize: { width: image.intrinsicWidth, height: image.intrinsicHeight },
        positionSectionBounds: section,
        confidence: 'strong',
        reviewState: 'mapped_automatic',
        reason: 'Exactly one drawing-sized PDF image object belongs to this source position section; page branding and footer objects are outside the section classifier.',
      },
    };
  }
  const sourcePage = segment.find((block) => Number.isInteger(block.pageNumber))?.pageNumber ?? null;
  const section = Number.isInteger(sourcePage) ? positionSectionBounds(segment, sourcePage) : null;
  return section ? {
    sourcePage,
    boundingRegion: section,
    role: 'unknown',
    primary: true,
    mappingMethod: fallbackMethod,
    geometryEvidence: {
      version: INTERNORM_PDF_IMAGE_OWNERSHIP_VERSION,
      classifier: 'position_image_xobject_ownership_unresolved',
      candidateCount: candidates.length,
      sourceObjectIds: candidates.map(({ image }) => image.objectId || image.id),
      candidateEvidence: candidates.map(({ image, pageNumber }) => ({ pageNumber, objectId: image.objectId || image.id, boundingBox: image.boundingBox })),
      confidence: 'review',
      reviewState: 'needs_review',
      reason: candidates.length ? 'More than one drawing-sized image object intersects the position section; no automatic association was selected.' : 'No drawing-sized image object was proven inside the position section.',
    },
  } : null;
}

function internormOrderedPositionVisualRegions(document, segments, { mappingMethod, fallbackMethod }) {
  const firstPositionPage = segments[0]?.[0]?.pageNumber;
  const firstPositionSection = Number.isInteger(firstPositionPage) ? positionSectionBounds(segments[0], firstPositionPage) : null;
  const allCandidates = Number.isInteger(firstPositionPage)
    ? document.pages.flatMap((page) => (page.imageEvidence || [])
      .filter((image) => {
        const box = image.boundingBox;
        return page.pageNumber >= firstPositionPage
          && box
          && box.width >= 20
          && box.height >= 15
          && box.width < page.width * 0.4
          && box.x < page.width * 0.42
          && box.y > 90;
      })
      .map((image) => ({ image, pageNumber: page.pageNumber })))
      .sort((left, right) => left.pageNumber - right.pageNumber || right.image.boundingBox.y - left.image.boundingBox.y)
    : [];
  const candidates = allCandidates.length === segments.length ? allCandidates : allCandidates.filter(({ image, pageNumber }) => {
    if (pageNumber !== firstPositionPage || !firstPositionSection) return true;
    const centreY = image.boundingBox.y + image.boundingBox.height / 2;
    return centreY >= firstPositionSection.y - 3 && centreY <= firstPositionSection.y + firstPositionSection.height + 3;
  });
  const oneToOne = candidates.length === segments.length && candidates.every(({ pageNumber }, index) => (
    segments[index].some((block) => block.pageNumber === pageNumber)
  ));
  if (!oneToOne) return segments.map((segment) => internormPositionVisualRegion(document, segment, { mappingMethod, fallbackMethod }));
  return candidates.map(({ image, pageNumber }, index) => {
    const segment = segments[index];
    const sourceObjectIds = [image.objectId || image.id];
    return {
      sourcePage: pageNumber,
      boundingRegion: image.boundingBox,
      sourceObjectIds,
      role: 'unknown',
      primary: true,
      mappingMethod,
      renderCacheVersion: INTERNORM_PDF_IMAGE_RENDER_VERSION,
      geometryEvidence: {
        version: INTERNORM_PDF_IMAGE_OWNERSHIP_VERSION,
        classifier: 'ordered_one_to_one_position_image_xobject_ownership',
        ownershipMethod: 'one drawing-sized PDF image per canonical position after the source product-sheet boundary, paired in source order and constrained to the position source pages',
        sourceObjectIds,
        sourceOperatorIndexes: [image.sourceOperatorIndex],
        intrinsicSize: { width: image.intrinsicWidth, height: image.intrinsicHeight },
        positionSectionBounds: positionSectionBounds(segment, pageNumber),
        positionOrdinal: index,
        positionCount: segments.length,
        candidateCount: candidates.length,
        confidence: 'strong',
        reviewState: 'mapped_automatic',
        reason: 'The post-specification schedule contains exactly one drawing-sized image object per extracted position; source order and position-page membership both reconcile one-to-one.',
      },
    };
  });
}

function parseInternormSchedule(document){
  const blocks=flatten(document),rows=[],systemDefaults=extractInternormEcohausSystemDefaults(document),sourceSegments=[];
  for(let index=0;index<blocks.length-3;index+=1){
    if(!/^\d{3}$/.test(blocks[index].text)||!/^\d+[.,]\d+$/.test(blocks[index+1]?.text)||!/^Unit$/i.test(blocks[index+2]?.text)||!/^[A-Z]{2}[A-Z0-9-]+/i.test(blocks[index+3]?.text))continue;
    const next=blocks.findIndex((block,nextIndex)=>nextIndex>index+3&&/^\d{3}$/.test(block.text)&&/^\d+[.,]\d+$/.test(blocks[nextIndex+1]?.text||'')&&/^Unit$/i.test(blocks[nextIndex+2]?.text||'')&&/^[A-Z]{2}[A-Z0-9-]+/i.test(blocks[nextIndex+3]?.text||''));
    const end=next>=0?next:blocks.length,segment=blocks.slice(index,end);sourceSegments.push(segment);const joined=segment.map(block=>block.text).join(' ');
    const widthText=segment.find(block=>/^[, ]*(?:Width|Frame width):?$/i.test(block.text)),heightText=segment.find(block=>/^[, ]*(?:Height|Frame height):?$/i.test(block.text));
    const inline=joined.match(/Element width:\s*(\d+)mm,?\s*Element height:\s*(\d+)mm/i);
    const width=inline?Number(inline[1]):widthText?Number(segment[segment.indexOf(widthText)+1]?.text.match(/\d+/)?.[0]||0)||null:null;
    const height=inline?Number(inline[2]):heightText?Number(segment[segment.indexOf(heightText)+1]?.text.match(/\d+/)?.[0]||0)||null:null;
    const reference=blocks[index+3].text.match(/^[A-Z]{2}[A-Z0-9-]+/i)?.[0]||blocks[index+3].text.replace(/:$/,'');
    const system=joined.match(/\b(HF510|HF410|KF410|HS330|AT510)\b/i)?.[1]?.toUpperCase()??null;
    const systemIndex=segment.findIndex((block)=>system&&new RegExp(`\\b${system}\\b`,'i').test(block.text));
    const descriptionIndex=segment.findIndex((block)=>/^Internorm\b/i.test(block.text));
    const cleanProductText=(value)=>cleanMetadataValue(value)?.replace(/\s+(?:Width|Frame width|Element width):?[\s\S]*$/i,'')??null;
    const productDescription=systemIndex>=0?cleanProductText(segment.slice(systemIndex,descriptionIndex>systemIndex?descriptionIndex:Math.min(segment.length,systemIndex+3)).map(block=>block.text).join(' ')):null;
    const description=descriptionIndex>=0?cleanProductText(segment.slice(descriptionIndex,Math.min(segment.length,descriptionIndex+2)).map(block=>block.text).join(' ')):null;
    const installationFields=joined.match(/Installation fields:\s*([A-Z/]+)/i)?.[1]??null;
    const configurationDescription=glassWorxConfiguration(joined,system,installationFields);
    const position={system,productDescription:productDescription??`${system??'Internorm'} position`,description,widthMm:width,heightMm:height,configurationDescription,totalPrice:null};
    const sourceSpecification=system?extractInternormEcohausPositionSpecification(document,segment,position,systemDefaults,{interpretation:'internorm_schedule_v1',currency:'GBP'}):null;
    const canonical=sourceSpecification?.canonical??{};
    rows.push({ segment, values:{ordinal:rows.length,reference,manufacturerName:'Internorm',manufacturerItemNumber:blocks[index].text,roomLocation:reference,product:description??productDescription??(system?`Internorm ${system}`:'Internorm position'),productSystem:system,configurationDescription,glassSpecification:canonical.glazing?.value??null,fittingsSpecification:canonical.sashes?.map(item=>item.fitting).filter(Boolean).join(' / ')||null,quantity:integerQuantity(blocks[index+1].text),widthMm:width,heightMm:height,unitPrice:null,totalPrice:null,currency:'GBP',manufacturerQuotedUg:canonical.glazingUnits?.find(item=>item.ug)?.ug??null,manufacturerQuotedUw:canonical.thermalUw?.value??null,blocks:segment,warnings:system?[]:['Internorm product system was not identified from source evidence.'],sourceSpecification} });
  }
  const visualRegions=internormOrderedPositionVisualRegions(document,sourceSegments,{mappingMethod:'internorm_glass_worx_position_image_xobject_v1',fallbackMethod:'internorm_glass_worx_position_image_review_v1'});
  const canonicalRows=rows.map((item,index)=>row(document,{...item.values,ordinal:index,visualRegion:visualRegions[index]}));
  const offer=blocks.find(block=>/^Offer number:/i.test(block.text))?.text.split(':').slice(1).join(':').trim()||null;
  return {
    adapter: 'internorm_schedule_v1', supplier: 'Glass Worx', manufacturer: 'Internorm',
    supplierIdentity: { role: 'quotation_issuer', authority: 'explicit_document_issuer', sourceLegalName: 'Glass Worx Limited', dealerName: 'Glass Worx', evidence: sourceTrace(document, blocks.filter((block) => /^Glass Worx Limited$/i.test(block.text))) },
    manufacturerIdentity: { role: 'product_manufacturer', authority: 'explicit_product_brand', evidence: sourceTrace(document, blocks.filter((block) => /\bInternorm\b/i.test(block.text))) },
    supplierManufacturerRelationship: { relationship: 'dealer_supplies_manufacturer_products', supplierDealerName: 'Glass Worx', supplierSourceLegalName: 'Glass Worx Limited', manufacturerName: 'Internorm', pricingScope: 'supplier_dealer_quotation' },
    documentType: 'window_schedule',
    quotation: { supplierQuotationNumber: offer, supplierRevision: null, fullQuotationReference: offer, warnings: [] },
    metadata: { supplierCustomer: cleanMetadataValue(blocks.find((block) => /^Mr\s+/i.test(block.text))?.text), projectReference: cleanMetadataValue(blocks.find((block) => /Schedule$/i.test(block.text))?.text.replace(/\s*-\s*Schedule$/i, '')), quotationDate: dateIso(blocks.find((block) => /^\d{2}\.\d{2}\.\d{4}$/.test(block.text))?.text), systemDefaults: [...systemDefaults.keys()] },
    rows:canonicalRows, systemDefaults: [...systemDefaults.keys()], warnings: canonicalRows.length ? [] : ['Internorm schedule positions were not detected.'],
  };
}

const internormEcohausReference = /^(?:[A-Z](?:\s+\d+|\.)?|N couplers)$/i;
const internormEcohausQuantity = /^\d+[.,]\d+$/;

function internormEcohausSegments(document) {
  const all = flatten(document);
  const tableStart = all.findIndex((block, index) => /^Pos\.$/i.test(block.text) && /^Quantity$/i.test(all[index + 1]?.text ?? ''));
  const packageStart = all.findIndex((block) => /^SUPPLY & INSTALL PACKAGE$/i.test(block.text));
  const blocks = all.slice(Math.max(0, tableStart), packageStart > tableStart ? packageStart : all.length);
  const starts = blocks.map((block, index) => (
    internormEcohausReference.test(block.text)
    && internormEcohausQuantity.test(blocks[index + 1]?.text ?? '')
    && /^Unit$/i.test(blocks[index + 2]?.text ?? '')
    && /^(?:HF410|KF410|Timber\/wood coupling profile|Timber alu lift-sliding door HS330)/i.test(blocks[index + 3]?.text ?? '')
  ) ? index : -1).filter((index) => index >= 0);
  return starts.map((start, index) => blocks.slice(start, starts[index + 1] ?? blocks.length));
}

function internormEcohausHeader(segment) {
  const reference = cleanMetadataValue(segment[0]?.text);
  const quantity = integerQuantity(segment[1]?.text);
  const unitIndex = segment.findIndex((block) => /^Unit$/i.test(block.text));
  const moneyBlocks = segment.slice(unitIndex + 1, unitIndex + 10).filter((block) => {
    if (!/^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(block.text)) return false;
    return !block.boundingBox || Number(block.boundingBox.x) >= 400;
  });
  const firstMoneyIndex = moneyBlocks.length ? segment.indexOf(moneyBlocks[0]) : Math.min(segment.length, unitIndex + 5);
  const productDescription = cleanMetadataValue(segment.slice(unitIndex + 1, firstMoneyIndex).map((block) => block.text).join(' '));
  const description = cleanMetadataValue(segment.find((block) => /^Internorm\b/i.test(block.text))?.text);
  const system = productDescription?.match(/\b(HF410|KF410|HS330)\b/i)?.[1]?.toUpperCase() ?? null;
  return {
    reference,
    quantity,
    productDescription,
    description,
    system,
    unitPrice: parseInternormEuropeanDecimal(moneyBlocks[0]?.text),
    totalPrice: parseInternormEuropeanDecimal(moneyBlocks[1]?.text),
  };
}

function internormEcohausConfiguration(productDescription, joined) {
  const installationFields = cleanMetadataValue(joined.match(/Installation fields:\s*([A-Z/]+)/i)?.[1]);
  if (/\bfixed\b/i.test(productDescription ?? '') || installationFields === 'FIX') return 'Fixed';
  if (/\bHS330\b/i.test(productDescription ?? '')) {
    const direction = cleanMetadataValue(joined.match(/(?:Handle side|Opening direction):\s*(Right|Left)/i)?.[1])
      ?? cleanMetadataValue(productDescription?.match(/\b(right|left)\s*$/i)?.[1]);
    return [installationFields, 'Lift-sliding door', direction].filter(Boolean).join(' · ');
  }
  if (/\bdoor\b/i.test(productDescription ?? '')) {
    const direction = cleanMetadataValue(joined.match(/Opening direction(?: from outside)?:\s*(Right|Left)/i)?.[1]);
    return ['Turn door', direction].filter(Boolean).join(' · ');
  }
  if (/Tilt with drive on side/i.test(joined)) {
    const direction = cleanMetadataValue(joined.match(/Handle side:\s*(Right|Left)/i)?.[1]);
    return ['Tilt with drive', direction].filter(Boolean).join(' · ');
  }
  const master = cleanMetadataValue(joined.match(/Turn\/tilt sash,\s*Opening direction:\s*(Right|Left)/i)?.[1]);
  const slave = cleanMetadataValue(joined.match(/Turn sash,\s*Opening direction:\s*(Right|Left)/i)?.[1]);
  if (/2-piece/i.test(productDescription ?? '')) return [`Turn/tilt sash${master ? ` ${master}` : ''}`, `Turn sash${slave ? ` ${slave}` : ''}`].join(' / ');
  const direction = cleanMetadataValue(joined.match(/Opening direction:\s*(Right|Left)/i)?.[1]);
  return ['Turn/tilt sash', direction].filter(Boolean).join(' · ');
}

function internormEcohausProduct(productDescription) {
  if (/\bHS330\b/i.test(productDescription ?? '')) return 'HS330 lift-sliding door';
  if (/\bdoor\b/i.test(productDescription ?? '')) return 'HF410 door';
  if (/\bfixed\b/i.test(productDescription ?? '')) return `${productDescription?.match(/\b(?:HF410|KF410)\b/i)?.[0]?.toUpperCase() ?? 'Internorm'} fixed window`;
  return `${productDescription?.match(/\b(?:HF410|KF410)\b/i)?.[0]?.toUpperCase() ?? 'Internorm'} window`;
}

function parseInternormEcohaus(document) {
  const defaults = extractInternormEcohausSystemDefaults(document);
  const sourceSegments = internormEcohausSegments(document);
  const sourceExtras = [];
  const rows = [];
  const positionSegments = sourceSegments.filter((segment) => !/couplers$/i.test(internormEcohausHeader(segment).reference ?? ''));
  const visualRegions = internormOrderedPositionVisualRegions(document, positionSegments, { mappingMethod: 'internorm_ecohaus_position_image_xobject_v1', fallbackMethod: 'internorm_ecohaus_position_image_review_v1' });
  let positionOrdinal = 0;
  for (const segment of sourceSegments) {
    const header = internormEcohausHeader(segment);
    if (/couplers$/i.test(header.reference ?? '')) {
      sourceExtras.push({ ...header, blocks: segment });
      continue;
    }
    const joined = segment.map((block) => block.text).join(' ');
    const dimensions = joined.match(/(?:Frame )?Width:\s*(\d+)mm\s*,?\s*(?:Frame )?Height:\s*(\d+)mm/i);
    const configurationDescription = internormEcohausConfiguration(header.productDescription, joined);
    const position = { ...header, widthMm: dimensions ? Number(dimensions[1]) : null, heightMm: dimensions ? Number(dimensions[2]) : null, configurationDescription };
    const sourceSpecification = extractInternormEcohausPositionSpecification(document, segment, position, defaults);
    const glazing = sourceSpecification?.canonical?.glazing?.value ?? null;
    const fittings = sourceSpecification?.canonical?.sashes?.map((sash) => [sash.sourceElementReference, sash.fitting, sash.hardware, sash.locking].filter(Boolean).join(' · ')).join('; ') ?? null;
    const ug = sourceSpecification?.canonical?.glazingUnits?.[0]?.ug ?? null;
    const uw = sourceSpecification?.canonical?.thermalUw?.value ?? null;
    const missing = [header.reference, header.quantity, header.system, position.widthMm, position.heightMm, header.unitPrice, header.totalPrice].some((value) => value == null);
    rows.push(row(document, {
      ordinal: rows.length,
      reference: header.reference,
      manufacturerName: 'Internorm',
      manufacturerItemNumber: header.reference,
      product: internormEcohausProduct(header.productDescription),
      productSystem: header.system,
      configurationDescription,
      glassSpecification: glazing,
      fittingsSpecification: fittings,
      quantity: header.quantity,
      widthMm: position.widthMm,
      heightMm: position.heightMm,
      unitPrice: header.unitPrice,
      totalPrice: header.totalPrice,
      currency: 'GBP',
      manufacturerQuotedUg: ug,
      manufacturerQuotedUw: uw,
      blocks: segment,
      warnings: missing ? ['One or more required commercial position fields were not recognised.'] : [],
      visualRegion: visualRegions[positionOrdinal],
      sourceSpecification,
    }));
    positionOrdinal += 1;
  }
  const blocks = flatten(document);
  const offer = blocks.find((block) => /^Offer number:/i.test(block.text))?.text.split(':').slice(1).join(':').trim() || null;
  const date = blocks.find((block) => /^Date:\s*\d{2}\.\d{2}\.\d{4}$/i.test(block.text))?.text.replace(/^Date:\s*/i, '') ?? null;
  const customer = blocks.find((block) => /^Mr\s+/i.test(block.text))?.text ?? null;
  const issuerBlock = blocks.find((block) => /^ecoHaus SW ltd\.?$/i.test(block.text));
  const manufacturerBlocks = blocks.filter((block) => /\bInternorm\b/i.test(block.text));
  return {
    adapter: 'internorm_ecohaus_complete_quotation_v1',
    supplier: 'EcoHaus',
    manufacturer: 'Internorm',
    commercialScope: 'supply_and_install',
    supplierIdentity: {
      role: 'quotation_issuer',
      authority: 'explicit_document_issuer',
      sourceLegalName: issuerBlock?.text ?? 'ecoHaus SW Ltd.',
      dealerName: 'EcoHaus',
      evidence: issuerBlock ? sourceTrace(document, [issuerBlock]) : [],
    },
    commercialSupplierIdentity: {
      role: 'commercial_supplier',
      authority: 'document_family_issuer_is_commercial_supplier',
      proposedName: 'EcoHaus',
      evidence: issuerBlock ? sourceTrace(document, [issuerBlock]) : [],
    },
    manufacturerIdentity: {
      role: 'product_manufacturer',
      authority: 'explicit_product_brand',
      evidence: sourceTrace(document, manufacturerBlocks),
    },
    supplierManufacturerRelationship: {
      relationship: 'dealer_supplies_manufacturer_products',
      documentIssuerName: 'EcoHaus',
      documentIssuerLegalName: issuerBlock?.text ?? 'ecoHaus SW Ltd.',
      commercialSupplierName: 'EcoHaus',
      manufacturerName: 'Internorm',
      pricingScope: 'commercial_supplier_quotation',
    },
    documentType: 'complete_quotation',
    quotation: { supplierQuotationNumber: offer, supplierRevision: null, fullQuotationReference: offer, warnings: [] },
    metadata: {
      supplierCustomer: cleanMetadataValue(customer),
      projectReference: null,
      quotationDate: dateIso(date),
      sourcePositionLineCount: sourceSegments.length,
      canonicalProductPositionCount: rows.length,
      sourceExtraCount: sourceExtras.length,
    },
    rows,
    sourceExtras,
    systemDefaults: [...defaults.keys()],
    warnings: rows.length ? [] : ['Internorm / EcoHaus commercial positions were not detected.'],
  };
}

function internormAspectSegments(document) {
  const segments = [];
  for (const page of document.pages) {
    const blocks = page.blocks.map((block) => ({ ...block, text: String(block.text).trim(), pageNumber: page.pageNumber })).filter((block) => block.text);
    const unitIndexes = blocks.map((block, index) => /^Unit$/i.test(block.text) && internormEcohausQuantity.test(blocks[index - 1]?.text ?? '') ? index : -1).filter((index) => index >= 0);
    for (const [ordinal, unitIndex] of unitIndexes.entries()) {
      let start = ordinal === 0 ? 1 : unitIndex - 2;
      if (ordinal === 0) {
        while (start < unitIndex - 1 && (/^(?:Pos\.|Quantity|Description)$/i.test(blocks[start]?.text ?? '') || /^_+$/.test(blocks[start]?.text ?? ''))) start += 1;
      }
      const nextUnit = unitIndexes[ordinal + 1];
      const end = nextUnit == null ? blocks.length : nextUnit - 2;
      const segment = blocks.slice(start, end);
      if (segment.length >= 4) segments.push(segment);
    }
  }
  return segments;
}

function internormAspectHeader(segment) {
  const unitIndex = segment.findIndex((block) => /^Unit$/i.test(block.text));
  const quantityIndex = unitIndex - 1;
  const reference = cleanMetadataValue(segment.slice(0, quantityIndex).map((block) => block.text).join(' '));
  const productBlocks = segment.slice(unitIndex + 1);
  const productEnd = productBlocks.findIndex((block) => /^(?:Internorm\b|(?:Frame )?Width:|Length:)/i.test(block.text));
  const productDescription = cleanMetadataValue(productBlocks.slice(0, productEnd >= 0 ? productEnd : Math.min(3, productBlocks.length)).map((block) => block.text).join(' '));
  const description = cleanMetadataValue(segment.find((block) => /^Internorm\b/i.test(block.text))?.text);
  const system = segment.map((block) => block.text).join(' ').match(/\b(HF410|KF410|HS330)\b/i)?.[1]?.toUpperCase() ?? null;
  return { reference, quantity: integerQuantity(segment[quantityIndex]?.text), productDescription, description, system, unitPrice: null, totalPrice: null };
}

function parseInternormAspect(document) {
  const defaults = extractInternormEcohausSystemDefaults(document);
  const currencyEvidence = detectPdfDocumentCurrency(document);
  const sourceSegments = internormAspectSegments(document);
  const sourceExtras = [];
  const rows = [];
  const positionSegments = sourceSegments.filter((segment) => {
    const header = internormAspectHeader(segment);
    return !(/coupler$/i.test(header.reference ?? '') && /coupling profile/i.test(header.productDescription ?? ''));
  });
  const visualRegions = internormOrderedPositionVisualRegions(document, positionSegments, { mappingMethod: 'internorm_aspect_position_image_xobject_v1', fallbackMethod: 'internorm_aspect_position_image_review_v1' });
  let positionOrdinal = 0;
  for (const segment of sourceSegments) {
    const header = internormAspectHeader(segment);
    if (/coupler$/i.test(header.reference ?? '') && /coupling profile/i.test(header.productDescription ?? '')) {
      sourceExtras.push({ ...header, blocks: segment, commercialRole: 'coupling_profile' });
      continue;
    }
    const joined = segment.map((block) => block.text).join(' ');
    const dimensions = joined.match(/(?:Frame )?Width:\s*(\d+)mm\s*,?\s*(?:Frame )?Height:\s*(\d+)mm/i);
    const configurationDescription = internormEcohausConfiguration(header.productDescription, joined);
    const position = { ...header, widthMm: dimensions ? Number(dimensions[1]) : null, heightMm: dimensions ? Number(dimensions[2]) : null, configurationDescription };
    const sourceSpecification = extractInternormEcohausPositionSpecification(document, segment, position, defaults, { interpretation: 'internorm_aspect_schedule_v1', currency: currencyEvidence.currency });
    const glazing = sourceSpecification?.canonical?.glazing?.value ?? null;
    const fittings = sourceSpecification?.canonical?.sashes?.map((sash) => [sash.sourceElementReference, sash.fitting, sash.hardware, sash.locking].filter(Boolean).join(' · ')).join('; ') ?? null;
    const ug = sourceSpecification?.canonical?.glazingUnits?.[0]?.ug ?? null;
    const uw = sourceSpecification?.canonical?.thermalUw?.value ?? null;
    const warnings = [];
    if ([header.reference, header.quantity, header.system, position.widthMm, position.heightMm].some((value) => value == null)) warnings.push('One or more required position identity or dimensional fields were not recognised.');
    warnings.push('This dealer schedule does not state position-level unit and line prices; commercial allocation requires review.');
    if (!currencyEvidence.currency) warnings.push('The document currency is absent or ambiguous and requires review.');
    rows.push(row(document, {
      ordinal: rows.length,
      reference: header.reference,
      manufacturerName: 'Internorm',
      manufacturerItemNumber: header.reference?.match(/^\d+/)?.[0] ?? header.reference,
      roomLocation: cleanMetadataValue(header.reference?.replace(/^\d+\s*/, '')),
      product: internormEcohausProduct(header.productDescription),
      productSystem: header.system,
      configurationDescription,
      glassSpecification: glazing,
      fittingsSpecification: fittings,
      quantity: header.quantity,
      widthMm: position.widthMm,
      heightMm: position.heightMm,
      unitPrice: null,
      totalPrice: null,
      currency: currencyEvidence.currency,
      commercialReadiness: 'review_required',
      manufacturerQuotedUg: ug,
      manufacturerQuotedUw: uw,
      blocks: segment,
      warnings,
      visualRegion: visualRegions[positionOrdinal],
      sourceSpecification,
    }));
    positionOrdinal += 1;
  }
  const blocks = flatten(document);
  const issuerBlock = blocks.find((block) => /^Aspect Aluminium$/i.test(block.text));
  const manufacturerBlocks = blocks.filter((block) => /\bInternorm\b/i.test(block.text));
  const metadataTitle = cleanMetadataValue(document.pdfStructure?.documentMetadata?.title);
  const metadataReference = metadataTitle?.match(/\b(\d+)\s*-\s*Internorm Quote Letter\b/i)?.[1] ?? null;
  const quotationWarnings = metadataReference ? ['The quotation reference is retained from the PDF Title metadata because no printed reference was detected.'] : ['A supplier quotation reference was not detected and requires review.'];
  return {
    adapter: 'internorm_aspect_schedule_v1',
    supplier: 'Aspect Aluminium',
    manufacturer: 'Internorm',
    supplierIdentity: {
      role: 'quotation_issuer', authority: 'explicit_document_issuer', sourceLegalName: issuerBlock?.text ?? 'Aspect Aluminium', dealerName: 'Aspect Aluminium',
      evidence: issuerBlock ? sourceTrace(document, [issuerBlock]) : [],
    },
    commercialSupplierIdentity: { role: 'commercial_supplier', authority: 'document_family_issuer_is_commercial_supplier', proposedName: 'Aspect Aluminium', evidence: issuerBlock ? sourceTrace(document, [issuerBlock]) : [] },
    manufacturerIdentity: { role: 'product_manufacturer', authority: 'explicit_product_brand', evidence: sourceTrace(document, manufacturerBlocks) },
    supplierManufacturerRelationship: {
      relationship: 'dealer_supplies_manufacturer_products', documentIssuerName: 'Aspect Aluminium', documentIssuerLegalName: issuerBlock?.text ?? 'Aspect Aluminium', commercialSupplierName: 'Aspect Aluminium', manufacturerName: 'Internorm', pricingScope: 'commercial_supplier_quotation',
    },
    documentType: 'complete_quotation',
    quotation: {
      supplierQuotationNumber: metadataReference,
      supplierRevision: null,
      fullQuotationReference: metadataReference,
      referenceAuthority: metadataReference ? 'pdf_title_metadata' : 'unavailable',
      sourceDocumentMetadata: metadataReference ? { reference: metadataReference, authority: 'pdf_title_metadata', field: 'Title', value: metadataTitle } : null,
      warnings: quotationWarnings,
    },
    metadata: {
      supplierCustomer: null,
      projectReference: null,
      quotationDate: null,
      quotationReferenceAuthority: metadataReference ? 'pdf_title_metadata' : 'unavailable',
      sourcePositionLineCount: sourceSegments.length,
      canonicalProductPositionCount: rows.length,
      sourceExtraCount: sourceExtras.length,
      reviewRequiredPositionCount: rows.filter((item) => item.status === 'needs_review').length,
    },
    rows,
    sourceExtras,
    systemDefaults: [...defaults.keys()],
    warnings: rows.length ? ['Position-level commercial prices are absent from the dealer schedule; confirmation must remain blocked pending reviewed allocation.'] : ['Internorm / Aspect schedule positions were not detected.'],
  };
}

function quoteSuitePositionCardHeader(text) {
  const match = String(text).match(/^\s*(\d{1,3})\s+([A-Z0-9][A-Z0-9.-]{0,20})\s+(.+?)\s+Quantity\s*:\s*(\d+)\s+Total\s*:\s*([£€$])\s*([\d,.]+)\s*$/i);
  if (!match) return null;
  return { sequence: Number(match[1]), reference: match[2], middle: cleanMetadataValue(match[3]), quantity: integerQuantity(match[4]), currencySymbol: match[5], totalPrice: decimal(match[6]) };
}

function quoteSuiteCardVisualRegion(document, segment, pageNumber) {
  const page = document.pages.find((item) => item.pageNumber === pageNumber);
  const boxes = segment.map((block) => block.boundingBox).filter(Boolean);
  if (!page || !boxes.length) return null;
  const bottom = Math.max(0, Math.min(...boxes.map((box) => box.y)));
  const top = Math.min(page.height, Math.max(...boxes.map((box) => box.y + box.height)));
  return {
    sourcePage: pageNumber,
    boundingRegion: { x: page.width * 0.04, y: bottom, width: page.width * 0.45, height: Math.max(1, top - bottom) },
    role: 'combined_source',
    primary: true,
    mappingMethod: 'quotesuite_position_card_layout_v1',
    geometryEvidence: {
      version: 'quotesuite_position_card_layout_v1',
      classifier: 'explicit_position_card_boundary',
      confidence: 'strong',
      reviewState: 'mapped_automatic',
      reason: 'The drawing is contained in the position card headed by the same explicit position reference.',
    },
  };
}

function parseQuoteSuiteManufacturerSchedule(document) {
  const rows = [];
  for (const page of document.pages) {
    const pageLines = (page.lines?.length ? page.lines : page.blocks).map((block) => ({ ...block, text: String(block.text).trim(), pageNumber: page.pageNumber })).filter((block) => block.text);
    const starts = pageLines.map((block, index) => quoteSuitePositionCardHeader(block.text) ? index : -1).filter((index) => index >= 0);
    for (const [positionIndex, start] of starts.entries()) {
      const segment = pageLines.slice(start, starts[positionIndex + 1] ?? pageLines.length);
      const header = quoteSuitePositionCardHeader(segment[0].text);
      if (!header) continue;
      const productLine = segment.find((block) => /Product\s*\/\s*system/i.test(block.text));
      const productMatch = productLine?.text.match(/Product\s*\/\s*system\s+(.+?)(?=\s+Unit\s+price\b|$)/i);
      const productSystem = cleanMetadataValue(productMatch?.[1]) ?? cleanMetadataValue(header.middle?.replace(/^Location not supplied\s*/i, ''));
      const unitMatch = productLine?.text.match(/Unit\s+price\s*[£€$]\s*([\d,.]+)/i);
      const width = segment.find((block) => /^Width\s+\d+\s*mm\b/i.test(block.text))?.text.match(/(\d+)\s*mm/i)?.[1];
      const height = segment.find((block) => /^Height\s+\d+\s*mm\b/i.test(block.text))?.text.match(/(\d+)\s*mm/i)?.[1];
      const ug = segment.find((block) => /Manufacturer quoted Ug/i.test(block.text))?.text.match(/\b(\d+[.,]\d+)\b/)?.[1] ?? null;
      const uw = segment.find((block) => /Manufacturer quoted Uw/i.test(block.text))?.text.match(/\b(\d+[.,]\d+)\b/)?.[1] ?? null;
      const currency = header.currencySymbol === '€' ? 'EUR' : header.currencySymbol === '£' ? 'GBP' : null;
      const missing = !header.reference || !header.quantity || !width || !height || !header.totalPrice || !currency;
      rows.push(row(document, {
        ordinal: rows.length,
        reference: header.reference,
        manufacturerItemNumber: header.reference,
        roomLocation: /^Location not supplied/i.test(header.middle ?? '') ? null : cleanMetadataValue(header.middle?.replace(productSystem ?? '', '')),
        product: /\bdoor\b/i.test(productSystem ?? '') ? 'Door' : 'Window',
        productSystem,
        quantity: header.quantity,
        widthMm: width ? Number(width) : null,
        heightMm: height ? Number(height) : null,
        unitPrice: decimal(unitMatch?.[1]) ?? header.totalPrice,
        totalPrice: header.totalPrice,
        currency,
        manufacturerQuotedUg: decimal(ug),
        manufacturerQuotedUw: decimal(uw),
        blocks: segment,
        warnings: missing ? ['One or more required OCR position fields were not recognised.'] : [],
        visualRegion: quoteSuiteCardVisualRegion(document, segment, page.pageNumber),
      }));
    }
  }
  const all = flatten(document);
  const fullText = all.map((block) => block.text).join('\n');
  const reference = fullText.match(/\b([A-Z]{2,8}-[A-Z]{2,8}-\d{4}-\d{3,})\b/)?.[1] ?? null;
  const date = fullText.match(/\b(\d{2}[./]\d{2}[./]\d{4})\b/)?.[1] ?? null;
  const explicitSystems = rows.map((item) => item.productSystem).filter((value) => value && !/^(?:window|door)$/i.test(value));
  const manufacturer = explicitSystems.map((value) => value.match(/^([A-Z][A-Za-z0-9-]+)/)?.[1] ?? null).find(Boolean) ?? null;
  const manufacturerBlocks = manufacturer ? all.filter((block) => new RegExp(`\\b${manufacturer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(block.text)) : [];
  return {
    adapter: 'quotesuite_raster_manufacturer_schedule_v1',
    supplier: null,
    manufacturer,
    supplierIdentity: { role: 'quotation_issuer', authority: 'not_supplied', sourceLegalName: null, dealerName: null, evidence: [] },
    manufacturerIdentity: { role: 'product_manufacturer', authority: manufacturer ? 'explicit_product_brand' : 'unavailable', evidence: sourceTrace(document, manufacturerBlocks) },
    supplierManufacturerRelationship: null,
    documentType: 'complete_quotation',
    quotation: { supplierQuotationNumber: reference, supplierRevision: null, fullQuotationReference: reference, referenceAuthority: reference ? 'explicit_source_document' : 'unavailable', warnings: [] },
    metadata: { supplierCustomer: null, projectReference: reference, quotationDate: dateIso(date) },
    rows,
    warnings: rows.length ? ['Position evidence was recovered through bounded OCR because the PDF has no machine-readable text layer.'] : ['OCR position cards were not detected.'],
  };
}

function ekoWebOverallDimensions(page, markerIndex) {
  if (!page || !Number.isFinite(page.width)) return { widthMm: null, heightMm: null, evidence: [] };
  const candidates = page.blocks.slice(0, markerIndex)
    .filter((block) => /^\d{3,4}$/.test(String(block.text).trim()) && block.boundingBox)
    .map((block) => ({ block, value: Number(block.text), x: block.boundingBox.x }));
  const widthCandidates = candidates.filter((item) => item.x >= page.width * 0.15 && item.x <= page.width * 0.28);
  const heightCandidates = candidates.filter((item) => item.x >= page.width * 0.29 && item.x <= page.width * 0.5);
  const width = widthCandidates.sort((left, right) => right.value - left.value)[0] ?? null;
  const height = heightCandidates.sort((left, right) => right.value - left.value)[0] ?? null;
  return { widthMm: width?.value ?? null, heightMm: height?.value ?? null, evidence: [width?.block, height?.block].filter(Boolean) };
}

function ekoWebSystem(blocks, markerIndex) {
  const systemIndex = blocks.slice(markerIndex + 1).findIndex((block) => /^System\s*:/i.test(block.text));
  if (systemIndex < 0) return { value: null, blocks: [] };
  const absoluteIndex = markerIndex + 1 + systemIndex;
  const evidence = [];
  for (const block of blocks.slice(absoluteIndex, absoluteIndex + 8)) {
    if (evidence.length && /^(?:Colour|Page|Window)\s*:/i.test(block.text)) break;
    evidence.push(block);
  }
  return { value: cleanMetadataValue(evidence.map((block, index) => index ? block.text : block.text.replace(/^System\s*:\s*/i, '')).join(' ')), blocks: evidence };
}

const EKO_WEB_MANUFACTURER = 'EKO-OKNA';
const EKO_WEB_INSIDE_REGION_VERSION = 'eko-web-inside-position-region-v1';

function ekoWebInsideVisualRegion(page, marker) {
  const markerBox = marker?.boundingBox;
  const label = page?.blocks.find((block) => /^Inside View$/i.test(String(block.text).trim()) && block.boundingBox && (!markerBox || block.boundingBox.y < markerBox.y));
  if (!page || !markerBox || !label?.boundingBox || !Number.isFinite(page.width) || !Number.isFinite(page.height)) return null;
  const x = page.width * 0.05; const right = page.width * 0.455;
  const y = label.boundingBox.y + label.boundingBox.height + 8; const top = markerBox.y - 10;
  if (right - x <= 40 || top - y <= 40) return null;
  const boundingRegion = { x, y, width: right - x, height: top - y };
  const sourceImages = (page.imageEvidence || []).filter((image) => {
    const box = image.boundingBox; if (!box) return false;
    const centreX = box.x + box.width / 2; const centreY = box.y + box.height / 2;
    return centreX >= x && centreX <= right && centreY >= y && centreY <= top;
  });
  return {
    sourcePage: page.pageNumber,
    boundingRegion,
    sourceObjectIds: sourceImages.map((image) => image.objectId || image.id),
    role: 'inside',
    primary: true,
    mappingMethod: EKO_WEB_INSIDE_REGION_VERSION,
    renderCacheVersion: EKO_WEB_INSIDE_REGION_VERSION,
    geometryEvidence: {
      version: EKO_WEB_INSIDE_REGION_VERSION,
      classifier: 'explicit_position_marker_and_inside_view_label',
      confidence: 'strong',
      reviewState: 'mapped_automatic',
      positionMarker: marker.text,
      insideViewLabel: label.text,
      sourceObjectIds: sourceImages.map((image) => image.objectId || image.id),
      reason: 'The drawing is bounded by the explicit position header, the same-page Inside View label and the document-family drawing column.',
    },
  };
}

function parseEkoWebItemised(document) {
  const rows = [];
  const markers = document.pages.flatMap((page, pageIndex) => page.blocks.flatMap((block, blockIndex) => {
    const match = String(block.text).trim().match(/^(Window|Door)\s+(\d{3})$/i);
    return match ? [{ page, pageIndex, blockIndex, block, product: match[1], reference: match[2] }] : [];
  }));
  for (const marker of markers) {
    const continuationPages = [];
    for (const page of document.pages.slice(marker.pageIndex + 1)) {
      if (page.blocks.some((block) => /^(?:Window|Door)\s+\d{3}$/i.test(String(block.text).trim()))) break;
      if (page.blocks.some((block) => /^(?:Price|Fillings)$/i.test(String(block.text).trim()))) continuationPages.push(page);
    }
    const positionBlocks = [marker.page, ...continuationPages].flatMap((page) => page.blocks.map((block) => ({ ...block, text: String(block.text).trim(), pageNumber: page.pageNumber })).filter((block) => block.text));
    const markerIndex = marker.page.blocks.indexOf(marker.block);
    const quantityBlock = marker.page.blocks.slice(markerIndex + 1).find((block) => /^Quantity\s*:/i.test(String(block.text).trim()));
    const system = ekoWebSystem(marker.page.blocks.map((block) => ({ ...block, text: String(block.text).trim(), pageNumber: marker.page.pageNumber })), markerIndex);
    const following=marker.page.blocks.slice(markerIndex+1);
    const nextMarker=following.findIndex(block=>/^(Window|Door)\s+\d{3}$/i.test(String(block.text).trim()));
    const colourBlocks=(nextMarker<0?following:following.slice(0,nextMarker)).filter(block=>/^Colour\s*:\s*\S/i.test(String(block.text).trim()));
    const colour=colourBlocks.length===1?colourBlocks[0]:null;
    const colourValue=colour?String(colour.text).trim().replace(/^Colour\s*:\s*/i,''):null;
    const colourFieldId=`eko-web-${marker.reference}-colour`;
    const sourceSpecification=colour?{version:'manufacturer-source-specification-v1',supplierInterpretation:'eko_web_itemised_colour_v1',sourceAttachmentId:document.attachmentId,sourceAttachmentHash:document.sourceSha256,sourcePage:marker.page.pageNumber,sourcePages:[marker.page.pageNumber],coordinateSpace:'pdf_points',fieldCount:1,sections:[{name:'Finish',fields:[{id:colourFieldId,ordinal:0,section:'Finish',label:'Colour',rawValue:colourValue,sourceText:colour.text,sourcePage:marker.page.pageNumber,boundingRegion:colour.boundingBox,coordinateSpace:'pdf_points',evidenceClass:'explicit',confidence:'strong',reviewStatus:'mapped_automatic',sourceBlockIds:[colour.id]}]}],canonical:{finish:{value:colourValue,manufacturerSourceValue:colourValue,sourceFieldIds:[colourFieldId]}}}:null;
    const dimensions = ekoWebOverallDimensions(marker.page, markerIndex);
    const priceLabel = positionBlocks.findIndex((block) => /^Price$/i.test(block.text));
    const priceBlock = priceLabel >= 0 ? positionBlocks.slice(priceLabel + 1, priceLabel + 8).find((block) => /^[£€$]\s*[\d,.]+$/.test(block.text)) : null;
    const totalPrice = decimal(priceBlock?.text);
    const quantity = integerQuantity(quantityBlock?.text.split(':').slice(1).join(':'));
    const currency = priceBlock?.text.startsWith('€') ? 'EUR' : priceBlock?.text.startsWith('£') ? 'GBP' : priceBlock?.text.startsWith('$') ? 'USD' : null;
    const joined = positionBlocks.map((block) => block.text).join(' ');
    const glazingBlock = positionBlocks.find((block) => /\[Ug\s*=\s*[\d.,]+\]/i.test(block.text));
    const warnings = [
      ...(!system.value ? ['The product/system brand was not identified from the explicit system evidence.'] : []),
      ...(colourBlocks.length>1?['Multiple Colour headings require review; no product colour was selected automatically.']:[]),
      ...(!quantity ? ['Position quantity was not recognised.'] : []),
      ...(!dimensions.widthMm || !dimensions.heightMm ? ['Overall position dimensions were not reconstructed from the source drawing dimensions.'] : []),
      ...(!totalPrice || !currency ? ['Position price or currency was not recognised.'] : []),
    ];
    rows.push(row(document, {
      ordinal: rows.length,
      reference: marker.reference,
      manufacturerName: EKO_WEB_MANUFACTURER,
      manufacturerItemNumber: marker.reference,
      product: marker.product,
      productSystem: system.value,
      sourceSpecification,
      quantity,
      widthMm: dimensions.widthMm,
      heightMm: dimensions.heightMm,
      unitPrice: totalPrice && quantity ? (Number(totalPrice) / quantity).toFixed(2) : totalPrice,
      totalPrice,
      currency,
      glassSpecification: cleanMetadataValue(glazingBlock?.text),
      manufacturerQuotedUg: decimal(joined.match(/\bUg\s*=\s*([\d.,]+)/i)?.[1]),
      manufacturerQuotedUw: decimal(joined.match(/\bUw\s*=\s*([\d.,]+)/i)?.[1]),
      blocks: [...positionBlocks, ...dimensions.evidence],
      warnings,
      visualRegion: ekoWebInsideVisualRegion(marker.page, marker.block),
    }));
  }
  const all = flatten(document);
  const referenceBlock = all.find((block) => /Price details\s+WEB\/\d+\/\d+/i.test(block.text));
  const reference = referenceBlock?.text.match(/WEB\/\d+\/\d+/i)?.[0] ?? null;
  const dateBlock = all.find((block) => /^\d{2}\/\d{2}\/\d{4}$/.test(block.text));
  const companyIndex = all.findIndex((block) => /^Company information\s*:?$/i.test(block.text));
  const supplierBlock = companyIndex >= 0 ? all[companyIndex + 1] : null;
  const sourceLegalName = cleanMetadataValue(supplierBlock?.text);
  const supplier = sourceLegalName?.replace(/\s+(?:Ltd|Limited)$/i, '') ?? null;
  const manufacturer = rows.length ? EKO_WEB_MANUFACTURER : null;
  const documentFamilyBlocks = all.filter((block) => /(?:Price details\s+WEB\/\d+\/\d+|WEB\/\d+\/\d+\s+\d{4}-\d{2}-\d{2})/i.test(block.text));
  const clientIndex = all.findIndex((block) => /^Client\s*:?$/i.test(block.text));
  const customer = clientIndex >= 0 ? cleanMetadataValue(all[clientIndex + 1]?.text) : null;
  const projectReference = cleanMetadataValue(all.find((block) => /^Your reference\s*:/i.test(block.text))?.text.replace(/^Your reference\s*:\s*/i, ''));
  return {
    adapter: 'eko_okna_web_itemised_v1',
    supplier,
    manufacturer,
    supplierIdentity: { role: 'quotation_issuer', authority: sourceLegalName ? 'explicit_document_issuer' : 'not_supplied', sourceLegalName, dealerName: supplier, evidence: sourceTrace(document, [supplierBlock].filter(Boolean)) },
    manufacturerIdentity: { role: 'product_manufacturer', authority: manufacturer ? 'document_family_and_header_evidence' : 'unavailable', evidence: sourceTrace(document, documentFamilyBlocks) },
    commercialSupplierIdentity: { role: 'commercial_supplier', authority: manufacturer ? 'eko_web_document_family_direct_supply' : 'not_proposed', proposedName: manufacturer, evidence: sourceTrace(document, documentFamilyBlocks) },
    supplierManufacturerRelationship: supplier && manufacturer ? { relationship: 'direct_manufacturer_supplier', documentIssuerName: supplier, documentIssuerLegalName: sourceLegalName, commercialSupplierName: manufacturer, manufacturerName: manufacturer, pricingScope: 'commercial_supplier_quotation' } : null,
    documentType: 'complete_quotation',
    quotation: { supplierQuotationNumber: reference, supplierRevision: null, fullQuotationReference: reference, referenceAuthority: reference ? 'explicit_source_document' : 'unavailable', warnings: [] },
    metadata: { supplierCustomer: customer, projectReference, quotationDate: dateIso(dateBlock?.text) },
    rows,
    warnings: rows.length ? [] : ['EKO Web itemised positions were not detected.'],
  };
}

function parseEkoItemised(document,variant){
  const pages=document.pages,rows=[];const currencyEvidence=detectPdfDocumentCurrency(document);const currencyWarnings=currencyEvidence.currency?[]:['The document currency is absent or ambiguous and requires review.'];
  const segments=variant==='eko'?(()=>{const blocks=flatten(document),markers=blocks.map((block,index)=>/^(?:Window|Door)\s+\d{3}$/i.test(block.text)?index:-1).filter(index=>index>=0);return markers.map((start,index)=>blocks.slice(start,markers[index+1]??blocks.length));})():pages.map(page=>page.blocks.map(block=>({...block,text:String(block.text).trim(),pageNumber:page.pageNumber})).filter(block=>block.text));
  for(const blocks of segments){const markerIndex=blocks.findIndex(block=>/^(?:Window|Door)\s+\d{3}$/i.test(block.text));if(markerIndex<0)continue;const marker=blocks[markerIndex],quantityBlock=blocks.slice(markerIndex+1).find(block=>/^(?:Qty\s*:|Quantity:)/i.test(block.text));const priceLabel=blocks.findIndex(block=>/^Price$|^Window price$/i.test(block.text));const priceBlock=priceLabel>=0?blocks.slice(priceLabel+1).find(block=>decimal(block.text)!=null):null;const dimensions=blocks.find(block=>/^Dimensions\s+\d+\s*mm\s*x\s*\d+\s*mm$/i.test(block.text))?.text.match(/(\d+)\s*mm\s*x\s*(\d+)\s*mm/i);let width=dimensions?Number(dimensions[1]):null,height=dimensions?Number(dimensions[2]):null;if(variant==='gutmann'){const diagram=blocks.slice(0,markerIndex).filter(block=>/^\d{3,4}$/.test(block.text)).map(block=>Number(block.text));if(diagram.length){width=Math.max(...diagram);height=diagram.filter(value=>value!==width).sort((a,b)=>b-a)[0]||null;}}const reference=marker.text.replace(/^(Window|Door)\s+/i,'');const totalPrice=decimal(priceBlock?.text),joined=blocks.map(block=>block.text).join(' ');const system=joined.match(/\bSystem\s*:\s*(.{1,120}?)(?=\s+(?:Page\s+\d|Colour|Window|Door|Price|Dimensions|FIX|Outer frame)\b|$)/i)?.[1]??null;const ug=joined.match(/\bUg\s*=\s*([\d.,]+)/i)?.[1]??null,uw=joined.match(/\bUw\s*=\s*([\d.,]+)/i)?.[1]??null;const glazing=blocks.find(block=>/\bUg\s*=\s*[\d.,]+/i.test(block.text))?.text??null;const visualRegions=variant==='eko'?ekoPositionVisualRegions(document,blocks,marker.pageNumber):null;const sourceSpecification=variant==='eko'?extractEkoOknaSourceSpecification(document,blocks,visualRegions?.[0]?.sourcePage):null;rows.push(row(document,{ordinal:rows.length,reference,manufacturerName:variant==='gutmann'?'Gutmann':'EKO-OKNA',manufacturerItemNumber:reference,product:/^Door/i.test(marker.text)?'Door':'Window',productSystem:cleanMetadataValue(system),glassSpecification:cleanMetadataValue(glazing),quantity:integerQuantity(quantityBlock?.text.split(':').slice(1).join(':')),widthMm:width,heightMm:height,unitPrice:totalPrice,totalPrice,currency:currencyEvidence.currency,manufacturerQuotedUg:decimal(ug),manufacturerQuotedUw:decimal(uw),blocks,warnings:currencyWarnings,visualRegions,sourceSpecification}));}
  const all=flatten(document),quotationText=variant==='gutmann'?all.find(block=>/Price details\s+WEB\//i.test(block.text))?.text:all.find(block=>/^Quotation\s+OF\//i.test(block.text))?.text;const full=quotationText?.match(/(?:WEB|OF)\/\d+\/\d+/i)?.[0]||null;const client=variant==='gutmann'?all[all.findIndex(block=>/^Client:$/i.test(block.text))+1]?.text:all.find(block=>/^ECOFENSTER LTD/i.test(block.text))?.text;const project=variant==='gutmann'?all.find(block=>/^Your reference:/i.test(block.text))?.text.split(':').slice(1).join(':'):null;const date=variant==='gutmann'?all.find(block=>/^\d{2}\/\d{2}\/\d{4}$/.test(block.text))?.text:all.find(block=>/^\d{2}\/\d{2}\/\d{4}$/.test(block.text))?.text;
  const identityBlocks=variant==='eko'?all.filter(block=>/\bEKO-OKNA\s+S\.A\./i.test(block.text)):all.filter(block=>/\bEcofenster\s+Ltd\b/i.test(block.text));
  const manufacturerBlocks=variant==='gutmann'?all.filter(block=>/\[GUTMANN\]/i.test(block.text)):identityBlocks;
  const identity=variant==='gutmann'?{supplier:'Ecofenster',manufacturer:'Gutmann',supplierIdentity:{role:'quotation_issuer',authority:'explicit_document_issuer',sourceLegalName:identityBlocks[0]?.text??'Ecofenster Ltd',dealerName:'Ecofenster',evidence:sourceTrace(document,identityBlocks)},commercialSupplierIdentity:{role:'commercial_supplier',authority:'document_family_issuer_is_commercial_supplier',proposedName:'Ecofenster',evidence:sourceTrace(document,identityBlocks)},manufacturerIdentity:{role:'product_manufacturer',authority:'explicit_product_brand',evidence:sourceTrace(document,manufacturerBlocks)},supplierManufacturerRelationship:{relationship:'dealer_supplies_manufacturer_products',documentIssuerName:'Ecofenster',documentIssuerLegalName:identityBlocks[0]?.text??'Ecofenster Ltd',commercialSupplierName:'Ecofenster',manufacturerName:'Gutmann',pricingScope:'commercial_supplier_quotation'}}:{supplier:'EKO-OKNA',manufacturer:'EKO-OKNA',supplierIdentity:{role:'quotation_issuer',authority:'explicit_document_issuer',sourceLegalName:identityBlocks[0]?.text??'EKO-OKNA S.A.',dealerName:'EKO-OKNA',evidence:sourceTrace(document,identityBlocks)},commercialSupplierIdentity:{role:'commercial_supplier',authority:'explicit_direct_manufacturer_supply',proposedName:'EKO-OKNA',evidence:sourceTrace(document,identityBlocks)},manufacturerIdentity:{role:'product_manufacturer',authority:'explicit_legal_manufacturer',evidence:sourceTrace(document,identityBlocks)},supplierManufacturerRelationship:{relationship:'direct_manufacturer_supplier',documentIssuerName:'EKO-OKNA',documentIssuerLegalName:identityBlocks[0]?.text??'EKO-OKNA S.A.',commercialSupplierName:'EKO-OKNA',manufacturerName:'EKO-OKNA',pricingScope:'commercial_supplier_quotation'}};
  return{adapter:variant==='gutmann'?'gutmann_web_v1':'eko_okna_winpro_v1',...identity,documentType:'complete_quotation',quotation:{supplierQuotationNumber:full,supplierRevision:null,fullQuotationReference:full,warnings:currencyWarnings},metadata:{supplierCustomer:cleanMetadataValue(client),projectReference:cleanMetadataValue(project),quotationDate:dateIso(date)},rows,warnings:rows.length?currencyWarnings:['Itemised PDF positions were not detected.']};
}

function parseGlassWorxCover(document){const blocks=flatten(document),reference=blocks.find(block=>/^25\s*-\s*\d+\s*-/i.test(block.text))?.text||null,preparedFor=blocks[blocks.findIndex(block=>/^Prepared for$/i.test(block.text))+1]?.text||null,date=blocks.find(block=>/^\d{2}\.\d{2}\.\d{4}$/.test(block.text))?.text;return{adapter:'glass_worx_cover_v1',supplier:'Glass Worx',documentType:'quotation_letter',quotation:{supplierQuotationNumber:cleanMetadataValue(reference),supplierRevision:null,fullQuotationReference:cleanMetadataValue(reference),warnings:[]},metadata:{supplierCustomer:cleanMetadataValue(preparedFor),projectReference:cleanMetadataValue(reference),quotationDate:dateIso(date)},rows:[],warnings:[]};}

const adapters=[
  {recognizes:text=>/\bMANUFACTURER ELEVATION\b/i.test(text)&&/\bProducts\s*\/\s*Supply Only\b/i.test(text)&&/\bincluded position\(s\)/i.test(text),parse:parseQuoteSuiteManufacturerSchedule},
  {recognizes:text=>/\becoHaus\b[\s\S]*Offer number:\s*\d+/i.test(text)&&/\bHF410\b[\s\S]*\bHS330\b[\s\S]*SUPPLY & INSTALL PACKAGE/i.test(text)&&/\bPos\.\s*\nQuantity\b/i.test(text),parse:parseInternormEcohaus},
  {recognizes:text=>/^Aspect Aluminium$/im.test(text)&&/\bwww\.aspectaluminium\.co\.uk\b/i.test(text)&&/\bInternorm\b/i.test(text)&&/\bPos\.\s*\nQuantity\s*\nDescription\b/i.test(text)&&/Internorm Triple Glazed[\s\S]*Supply and install in the sum of £/i.test(text),parse:parseInternormAspect},
  {recognizes:text=>/Glass Worx Limited[\s\S]*Offer number:\s*\d+/i.test(text)&&/\bPos\.\s*\nQuantity\b/i.test(text),parse:parseInternormSchedule},
  {recognizes:text=>/Glass Worx Ltd[\s\S]*YOUR PROJECT COSTS/i.test(text),parse:parseGlassWorxCover},
  {recognizes:text=>/EKO-OKNA S\.A\.[\s\S]*Quotation\s+OF\//i.test(text),parse:document=>parseEkoItemised(document,'eko')},
  {recognizes:text=>/Price details\s+WEB\/\d+\/\d+/i.test(text)&&/Company information\s*:/i.test(text)&&/\b(?:Window|Door)\s+\d{3}\b/i.test(text)&&!/\[GUTMANN\]/i.test(text),parse:parseEkoWebItemised},
  {recognizes:text=>/Price details\s+WEB\//i.test(text)&&/\[GUTMANN\]/i.test(text),parse:document=>parseEkoItemised(document,'gutmann')},
  {recognizes:text=>/\bFrame No:\s*\d+\b[\s\S]*\bQty:\s*\d+/i.test(text)&&/\b(?:VELFAC|Rationel)\b/i.test(text),parse:parseFrameQuotation},
  {recognizes:text=>/\bIdealcombi\b/i.test(text)&&/\bQuotation no\./i.test(text)&&/\bGBP\/ Unit\b/i.test(text),parse:parseIdealcombi},
  {recognizes:text=>/\bOffer\s+\d+\b/i.test(text)&&/\bNordvest UK Ltd\b/i.test(text)&&/\bNORDVEST (?:WINDOW|SLIDING DOOR|MAIN DOOR)\b/i.test(text),parse:parseNordvest},
  {recognizes:text=>/\bItem\s+Location\s+No\.\s+Type\s+Width Height Glazing\b/i.test(text)&&/\bPrice ea\.\s*\nPrice Total\b/i.test(text),parse:parseNorrsken},
  {recognizes:text=>/\bWestcoast Windows AB\b/i.test(text)&&/\bPowered by CalWin\b/i.test(text),parse:parseWestcoast},
  {recognizes:text=>/\b21 Degrees\b/i.test(text)&&/\bGB Quote Reference\b/i.test(text)&&/\bPrice after discount\b/i.test(text),parse:parseTwentyOneDegrees},
];

export function parsePdfSupplierFields(document){if(document.mediaType!=='application/pdf')return null;const text=textOf(document);const adapter=adapters.find(candidate=>candidate.recognizes(text));return adapter?adapter.parse(document):null;}

function summary(document,{currency,finalSupplierTotal,productSubtotal=null,additionalItemsSubtotal=null,deliveryTotal=null,vatTotal=null}){const blocks=flatten(document),original={currency, totalQuantity:null,totalQuantityUnit:null,totalAreaSquareMetres:null,productSubtotal,additionalItemsSubtotal,deliveryTotal,vatTotal,finalSupplierTotal,averageUValue:null,totalWeightKg:null,closingNotes:null};return{id:randomUUID(),...original,sourceTrace:sourceTrace(document,blocks.filter(block=>/total|net price|cost \(excl/i.test(block.text))),warnings:[],confidence:0.96,status:'extracted',originalExtractedSnapshot:original};}

function internormEcohausAdditionalItem(document, { ordinal, category, commercialRole = category, sourceReference = null, description, quantity = null, quantityUnit = null, unitPrice = null, totalPrice, blocks, includedInSupplierTotal, inclusionEvidence, selectedForFutureUse = true }) {
  const original = { category, commercialRole, sourceReference, originalDescription: description, normalizedLabel: description, quantity, quantityUnit, unitPrice, totalPrice, currency: 'GBP', includedInSupplierTotal, inclusionEvidence, selectedForFutureUse };
  return { id: randomUUID(), ordinal, ...original, sourceTrace: sourceTrace(document, blocks), warnings: [], confidence: 0.96, status: 'extracted', originalExtractedSnapshot: original };
}

function parseInternormEcohausSummary(document, parsed, positionRows) {
  const blocks = flatten(document);
  const page = document.pages.find((candidate) => candidate.blocks.some((block) => /^SUPPLY & INSTALL PACKAGE$/i.test(cleanMetadataValue(block.text) ?? '')));
  const pageBlocks = page?.blocks.map((block) => ({ ...block, text: String(block.text).trim(), pageNumber: page.pageNumber })).filter((block) => block.text) ?? [];
  const after = (pattern) => {
    const index = pageBlocks.findIndex((block) => pattern.test(block.text));
    const amount = index >= 0 ? pageBlocks.slice(index + 1, index + 3).find((block) => /£\s*[\d,.]+/.test(block.text)) : null;
    return { value: parseInternormEuropeanDecimal(amount?.text), blocks: index >= 0 ? [pageBlocks[index], ...(amount ? [amount] : [])] : [] };
  };
  const listPrice = after(/^List Price$/i);
  const productSubtotal = after(/Windows & Doors$/i);
  const installation = after(/^Installation by ecoHaus$/i);
  const delivery = after(/^Delivery to Site$/i);
  const survey = after(/^On site Survey or Virtual Survey$/i);
  const cills = after(/External Aluminium Cills$/i);
  const final = after(/^TOTAL EXC VAT$/i);
  const discountIndex = pageBlocks.findIndex((block) => /^Discount %$/i.test(block.text));
  const discountBlock = discountIndex >= 0 ? pageBlocks[discountIndex + 1] : null;
  const discountPercent = parseInternormEuropeanDecimal(discountBlock?.text);
  const additionalItems = [];
  const addPackageItem = (category, commercialRole, description, evidence, quantity = null, quantityUnit = null) => {
    if (!evidence.value) return;
    additionalItems.push(internormEcohausAdditionalItem(document, { ordinal: additionalItems.length, category, commercialRole, description, quantity, quantityUnit, totalPrice: evidence.value, blocks: evidence.blocks, includedInSupplierTotal: true, inclusionEvidence: 'Explicitly included in the selected SUPPLY & INSTALL PACKAGE total.' }));
  };
  addPackageItem('other', 'installation', 'Installation by ecoHaus', installation);
  addPackageItem('delivery', 'delivery', 'Delivery to Site', delivery);
  addPackageItem('other', 'survey', 'On site Survey or Virtual Survey', survey);
  addPackageItem('sill', 'external_cills', 'External Aluminium Cills', cills, 52, 'm');
  for (const extra of parsed.sourceExtras ?? []) {
    additionalItems.push(internormEcohausAdditionalItem(document, {
      ordinal: additionalItems.length,
      category: 'accessory',
      commercialRole: 'coupling_profile',
      sourceReference: extra.reference,
      description: extra.productDescription,
      quantity: extra.quantity,
      quantityUnit: 'Unit',
      unitPrice: extra.unitPrice,
      totalPrice: extra.totalPrice,
      blocks: extra.blocks,
      includedInSupplierTotal: false,
      inclusionEvidence: 'The coupling profile is retained as a source accessory line and is already embedded in the supplier List Price / discounted product package; it must not be added again.',
      selectedForFutureUse: false,
    }));
  }
  const additionalItemsSubtotal = [installation.value, survey.value, cills.value].every(Boolean)
    ? (Number(installation.value) + Number(survey.value) + Number(cills.value)).toFixed(2)
    : null;
  const value = summary(document, { currency: 'GBP', productSubtotal: productSubtotal.value, additionalItemsSubtotal, deliveryTotal: delivery.value, finalSupplierTotal: final.value });
  value.comparisonTotals = [
    { classification: 'supplier_list_price', label: 'List Price', amount: listPrice.value, currency: 'GBP', includedInSupplierTotal: false, selected: false, sourceTrace: sourceTrace(document, listPrice.blocks) },
    { classification: 'supplier_discount', label: `Discount ${discountPercent ?? ''}%`.trim(), amount: null, percentage: discountPercent, currency: 'GBP', includedInSupplierTotal: false, selected: false, sourceTrace: sourceTrace(document, discountIndex >= 0 ? [pageBlocks[discountIndex], discountBlock].filter(Boolean) : []) },
  ];
  const positionSubtotal = positionRows.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0).toFixed(2);
  const expectedFinal = [productSubtotal.value, additionalItemsSubtotal, delivery.value].every(Boolean)
    ? (Number(productSubtotal.value) + Number(additionalItemsSubtotal) + Number(delivery.value)).toFixed(2)
    : null;
  const blockingWarnings = [];
  const reviewWarnings = [];
  const sourceExtrasTotal = (parsed.sourceExtras ?? []).reduce((total, item) => total + Number(item.totalPrice || 0), 0).toFixed(2);
  const expectedListPrice = (Number(positionSubtotal) + Number(sourceExtrasTotal)).toFixed(2);
  if (listPrice.value && expectedListPrice !== listPrice.value) blockingWarnings.push('The source product lines and coupling accessories do not reconcile with the List Price.');
  const roundingVariance = assessSupplierRoundingVariance({ currency: 'GBP', calculatedTotal: expectedFinal, supplierStatedTotal: final.value });
  if (roundingVariance.status === 'accepted_supplier_rounding_variance') reviewWarnings.push(`Accepted supplier rounding variance: the selected package components total £${expectedFinal}, while the supplier states £${final.value} (a £${roundingVariance.difference.replace('-', '')} difference, bounded to one minor currency unit).`);
  else if (roundingVariance.status === 'material_variance') blockingWarnings.push(`The selected package components total £${expectedFinal}, while the supplier states £${final.value} (a £${roundingVariance.difference.replace('-', '')} unexplained difference).`);
  const warnings = [...blockingWarnings, ...reviewWarnings];
  value.reconciliation = { positionSubtotal, additionalSubtotal: additionalItemsSubtotal, deliverySubtotal: delivery.value, expectedFinal, reconciled: blockingWarnings.length === 0, warnings, roundingVariance };
  value.warnings = warnings;
  value.status = blockingWarnings.length ? 'needs_review' : 'extracted';
  value.originalExtractedSnapshot.comparisonTotals = value.comparisonTotals;
  value.comparisonScope = {
    productsSupply: { status: 'separately_stated', grossListAmount: listPrice.value, discountPercentage: discountPercent, netAmount: productSubtotal.value },
    extras: { status: 'separately_stated', amount: cills.value, labels: ['External Aluminium Cills'] },
    delivery: { status: delivery.value ? 'included_separately_stated' : 'not_stated', amount: delivery.value, directToSite: true },
    installation: { status: installation.value ? 'included_separately_stated' : 'not_stated', amount: installation.value },
    survey: { status: survey.value ? 'included_separately_stated' : 'not_stated', amount: survey.value },
    vat: { status: 'excluded', rate: null, amount: null },
  };
  return { summary: value, additionalItems, warnings };
}

function internormAspectAdditionalItem(document, { ordinal, reference, description, quantity = null, commercialRole, blocks, rawAmount = null }) {
  const original = {
    category: commercialRole === 'coupling_profile' ? 'accessory' : 'other',
    commercialRole,
    originalDescription: description,
    normalizedLabel: description,
    quantity,
    quantityUnit: quantity == null ? null : 'Unit',
    unitPrice: null,
    totalPrice: null,
    currency: 'GBP',
    includedInSupplierTotal: false,
    inclusionEvidence: 'No separately reconcilable price allocation is stated in this dealer schedule.',
    selectedForFutureUse: false,
    sourceReference: reference,
    rawAmount,
  };
  return { id: randomUUID(), ordinal, ...original, sourceTrace: sourceTrace(document, blocks), warnings: ['The accessory/package line has no safely allocatable source price and requires review.'], confidence: 0.78, status: 'needs_review', originalExtractedSnapshot: original };
}

function parseInternormAspectSummary(document, parsed, positionRows) {
  const blocks = flatten(document);
  const supplyLines = blocks.filter((block) => /Supply and install in the sum of £/i.test(block.text));
  const mainLine = supplyLines.find((block) => /£\s*\d{1,3}(?:,\d{3})*\.\d{2}\b/.test(block.text));
  const mainAmount = decimal(mainLine?.text.match(/£\s*(\d{1,3}(?:,\d{3})*\.\d{2})\b/)?.[1]);
  const rooflightBlock = blocks.find((block) => /^3 Pane Aluminium Rooflight\b/i.test(block.text));
  const rooflightLine = supplyLines.find((block) => block !== mainLine);
  const rooflightRawAmount = rooflightLine?.text.match(/£\s*([^\s]+)/)?.[1] ?? null;
  const additionalItems = (parsed.sourceExtras ?? []).map((extra, ordinal) => internormAspectAdditionalItem(document, {
    ordinal,
    reference: extra.reference,
    description: extra.productDescription,
    quantity: extra.quantity,
    commercialRole: 'coupling_profile',
    blocks: extra.blocks,
  }));
  if (rooflightBlock || rooflightLine) additionalItems.push(internormAspectAdditionalItem(document, {
    ordinal: additionalItems.length,
    reference: null,
    description: rooflightBlock?.text ?? 'Aluminium rooflight',
    commercialRole: 'rooflight_package',
    blocks: [rooflightBlock, rooflightLine].filter(Boolean),
    rawAmount: rooflightRawAmount,
  }));
  const value = summary(document, { currency: 'GBP', finalSupplierTotal: mainAmount });
  value.comparisonTotals = [{
    classification: 'supplier_combined_supply_install_package',
    label: 'Internorm Triple Glazed · Supply and install',
    amount: mainAmount,
    currency: 'GBP',
    includedInSupplierTotal: true,
    selected: true,
    sourceTrace: sourceTrace(document, [mainLine].filter(Boolean)),
  }];
  const warnings = [
    'The £91,079.00 source amount is a combined supply-and-install package; position-level product prices and installation allocation are not stated.',
    'The separate rooflight amount is written as £11.810.00 and is retained as ambiguous source evidence rather than normalized or added.',
  ];
  value.warnings = warnings;
  value.status = 'needs_review';
  value.reconciliation = {
    positionSubtotal: null,
    additionalSubtotal: null,
    deliverySubtotal: null,
    expectedFinal: null,
    reconciled: false,
    warnings,
    reviewRequiredPositionCount: positionRows.filter((item) => item.status === 'needs_review').length,
  };
  value.originalExtractedSnapshot.comparisonTotals = value.comparisonTotals;
  return { summary: value, additionalItems, warnings };
}

export function parsePdfSupplierSummary(document,positionRows=[]){
  const parsed=parsePdfSupplierFields(document);if(!parsed)return null;const blocks=flatten(document);
  if(parsed.adapter==='eko_okna_web_itemised_v1'){
    const productIndex=blocks.findIndex(block=>/^Products$/i.test(block.text));
    const productAmounts=productIndex>=0?blocks.slice(productIndex+1,productIndex+8).filter(block=>/^[£€$]\s*[\d,.]+$/.test(block.text)).map(block=>({block,value:decimal(block.text)})):[];
    const totalIndex=blocks.findIndex(block=>/^TOTAL price$/i.test(block.text));
    const totalAmount=totalIndex>=0?blocks.slice(totalIndex+1,totalIndex+6).find(block=>/^[£€$]\s*[\d,.]+$/.test(block.text)):null;
    const productSubtotal=productAmounts[0]?.value??null,vatTotal=productAmounts[1]?.value??null,finalSupplierTotal=decimal(totalAmount?.text)??productAmounts[2]?.value??null;
    const rowCurrencies=[...new Set(positionRows.map(item=>item.currency).filter(Boolean))];
    const currency=rowCurrencies.length===1?rowCurrencies[0]:detectPdfDocumentCurrency(document).currency;
    const value=summary(document,{currency,productSubtotal,vatTotal,finalSupplierTotal});
    const positionSubtotal=positionRows.every(item=>item.totalPrice!=null)?positionRows.reduce((sum,item)=>sum+Number(item.totalPrice),0).toFixed(2):null;
    const expectedFinal=productSubtotal!=null&&vatTotal!=null?(Number(productSubtotal)+Number(vatTotal)).toFixed(2):null;
    const sourceProductMatches=positionSubtotal!=null&&productSubtotal!=null&&Number(positionSubtotal)===Number(productSubtotal);
    const finalMatches=expectedFinal!=null&&finalSupplierTotal!=null&&Number(expectedFinal)===Number(finalSupplierTotal);
    const warnings=[...(!sourceProductMatches?['Supplied Products total does not match extracted position totals.']:[]),...(!finalMatches?['Supplied tax and final total do not reconcile.']:[])];
    value.comparisonTotals=productSubtotal?[{classification:'supplier_list_price',label:'Products',amount:productSubtotal,currency,includedInSupplierTotal:true,selected:false,sourceTrace:sourceTrace(document,productAmounts[0]?[productAmounts[0].block]:[])}]:[];
    value.reconciliation={positionSubtotal,additionalSubtotal:null,deliverySubtotal:null,expectedFinal,reconciled:sourceProductMatches&&finalMatches,warnings};
    value.warnings=warnings;value.status=warnings.length?'needs_review':'extracted';value.originalExtractedSnapshot.comparisonTotals=value.comparisonTotals;
    return{summary:value,additionalItems:[],warnings};
  }
  if(parsed.adapter==='quotesuite_raster_manufacturer_schedule_v1'){
    const amount=(pattern)=>{const block=blocks.find(item=>pattern.test(item.text));return{value:decimal(block?.text.match(/[£€$]\s*([\d,.]+)/)?.[1]),blocks:block?[block]:[]};};
    const packageAmount=amount(/^Products\s*\/\s*Supply Only\b/i),productSubtotal=amount(/^Subtotal excluding VAT\b/i),vatTotal=amount(/^VAT\s*\(/i),finalSupplierTotal=amount(/^Total including VAT\b/i);
    const currency=detectPdfDocumentCurrency(document).currency;const value=summary(document,{currency,productSubtotal:productSubtotal.value??packageAmount.value,vatTotal:vatTotal.value,finalSupplierTotal:finalSupplierTotal.value});
    const positionSubtotal=positionRows.every(item=>item.totalPrice!=null)?positionRows.reduce((sum,item)=>sum+Number(item.totalPrice),0).toFixed(2):null;const expectedFinal=value.productSubtotal&&value.vatTotal?(Number(value.productSubtotal)+Number(value.vatTotal)).toFixed(2):null;const sourceProductMatches=positionSubtotal!=null&&value.productSubtotal!=null&&Number(positionSubtotal)===Number(value.productSubtotal);const finalMatches=expectedFinal!=null&&value.finalSupplierTotal!=null&&Number(expectedFinal)===Number(value.finalSupplierTotal);
    const warnings=[...(!sourceProductMatches?['Supplied product subtotal does not match extracted position totals.']:[]),...(!finalMatches?['Supplied VAT and final total do not reconcile.']:[])];
    value.comparisonTotals=packageAmount.value?[{classification:'supplier_list_price',label:'Products / Supply subtotal',amount:packageAmount.value,currency,includedInSupplierTotal:true,selected:false,sourceTrace:sourceTrace(document,packageAmount.blocks)},{classification:'package_option',label:'Products / Supply Only',amount:packageAmount.value,currency,includedInSupplierTotal:true,selected:true,sourceTrace:sourceTrace(document,packageAmount.blocks)}]:[];
    value.reconciliation={positionSubtotal,additionalSubtotal:null,deliverySubtotal:null,expectedFinal,reconciled:sourceProductMatches&&finalMatches,warnings};value.warnings=warnings;value.status=warnings.length?'needs_review':'extracted';value.originalExtractedSnapshot.comparisonTotals=value.comparisonTotals;
    return{summary:value,additionalItems:[],warnings};
  }
  if(parsed.adapter==='internorm_ecohaus_complete_quotation_v1')return parseInternormEcohausSummary(document,parsed,positionRows);
  if(parsed.adapter==='internorm_aspect_schedule_v1')return parseInternormAspectSummary(document,parsed,positionRows);
  if(parsed.adapter==='internorm_schedule_v1')return{summary:null,additionalItems:[],warnings:['Line prices and quotation total are supplied separately.']};
  if(parsed.adapter==='frame_schedule_geometry_v1'){
    const pageLines=lines(document);const lineEvidence=(pattern)=>{const block=pageLines.find(item=>pattern.test(item.text)),value=decimal(block?.text.match(/£\s*([\d,.]+)\s*$/)?.[1]);return{block,value}};
    const tPiece=lineEvidence(/\bT Piece\b/i),coverCaps=lineEvidence(/^Cover cap\b/i),delivery=lineEvidence(/delivery charge/i),net=lineEvidence(/\bNett Total\b/i),vat=lineEvidence(/\b20% VAT\b/i),final=lineEvidence(/^TOTAL INC\. VAT\b/i);
    const positionSubtotal=positionRows.every(item=>item.totalPrice!=null)?positionRows.reduce((sum,item)=>sum+Number(item.totalPrice),0).toFixed(2):null;
    const extras=[
      tPiece.value?internormEcohausAdditionalItem(document,{ordinal:0,category:'accessory',commercialRole:'coupling_profile',description:'90/114 8mm T Piece 3m',quantity:7,quantityUnit:'length',totalPrice:tPiece.value,blocks:[tPiece.block],includedInSupplierTotal:true,inclusionEvidence:'Explicit supplier extra included in the Nett Total.'}):null,
      coverCaps.value?internormEcohausAdditionalItem(document,{ordinal:1,category:'accessory',commercialRole:'cover_caps',description:'Cover cap 14/19mm, white',quantity:200,quantityUnit:'unit',totalPrice:coverCaps.value,blocks:[coverCaps.block],includedInSupplierTotal:true,inclusionEvidence:'Explicit supplier extra included in the Nett Total.'}):null,
      delivery.value?internormEcohausAdditionalItem(document,{ordinal:2,category:'delivery',commercialRole:'delivery',description:'Delivery charge',quantity:1,quantityUnit:'delivery',totalPrice:delivery.value,blocks:[delivery.block],includedInSupplierTotal:true,inclusionEvidence:'Explicit supplier delivery charge included in the Nett Total.'}):null,
    ].filter(Boolean);
    const additionalItemsSubtotal=[tPiece.value,coverCaps.value].every(Boolean)?(Number(tPiece.value)+Number(coverCaps.value)).toFixed(2):null;
    const value=summary(document,{currency:'GBP',productSubtotal:positionSubtotal,additionalItemsSubtotal,deliveryTotal:delivery.value,vatTotal:vat.value,finalSupplierTotal:final.value});
    const expectedNet=[positionSubtotal,additionalItemsSubtotal,delivery.value].every(Boolean)?(Number(positionSubtotal)+Number(additionalItemsSubtotal)+Number(delivery.value)).toFixed(2):null;
    const expectedFinal=expectedNet&&vat.value?(Number(expectedNet)+Number(vat.value)).toFixed(2):null;
    const warnings=[];
    if(!expectedNet||!net.value||Number(expectedNet)!==Number(net.value))warnings.push('The extracted Products / Supply, extras and delivery do not reconcile with the supplier Nett Total.');
    if(!expectedFinal||!final.value||Number(expectedFinal)!==Number(final.value))warnings.push('The supplier Nett Total, VAT and total including VAT do not reconcile.');
    value.reconciliation={positionSubtotal,additionalSubtotal:additionalItemsSubtotal,deliverySubtotal:delivery.value,expectedFinal,reconciled:warnings.length===0,warnings};
    value.comparisonScope={productsSupply:{status:'separately_reconstructed_from_position_rows',grossListAmount:positionSubtotal,discountPercentage:null,netAmount:positionSubtotal},extras:{status:'separately_stated',amount:additionalItemsSubtotal,labels:['90/114 8mm T Piece 3m','Cover cap 14/19mm, white']},delivery:{status:'included_separately_stated',amount:delivery.value},installation:{status:'not_stated',amount:null},survey:{status:'not_stated',amount:null},vat:{status:'separately_stated',rate:20,amount:vat.value}};
    value.warnings=warnings;value.status=warnings.length?'needs_review':'extracted';return{summary:value,additionalItems:extras,warnings};
  }
  if(parsed.adapter==='glass_worx_cover_v1'){
    const packageValues=blocks.filter(block=>/^\d{1,3},\d{3}\.\d{2}$/.test(block.text)).map(block=>decimal(block.text)).slice(-3);const selected=packageValues[1]??packageValues[0]??null;
    const labels=['Bronze / Supply Only','Silver / Install Support','Gold / Full Installation'];const value=summary(document,{currency:'GBP',finalSupplierTotal:selected});value.comparisonTotals=packageValues.map((amount,index)=>({classification:'package_option',label:labels[index],amount,currency:'GBP',includedInSupplierTotal:index===1,selected:index===1,sourceTrace:sourceTrace(document,blocks.filter(block=>decimal(block.text)===amount))}));value.originalExtractedSnapshot.comparisonTotals=value.comparisonTotals;value.warnings=['Line-level reconciliation is unavailable because the authoritative schedule is unpriced.'];value.status='needs_review';value.reconciliation={positionSubtotal:null,additionalSubtotal:null,deliverySubtotal:null,expectedFinal:null,reconciled:false,warnings:value.warnings};return{summary:value,additionalItems:[],warnings:value.warnings};
  }
  if(parsed.adapter==='nordvest_offer_v1'){
    const pageLines=lines(document),net=pageLines.find(block=>/^Net total ex VAT:/i.test(block.text)),finalSupplierTotal=decimal(net?.text.match(/£\s*([\d,.]+)/)?.[1]);
    const productSubtotal=positionRows.every(item=>item.totalPrice!=null)?positionRows.reduce((sum,item)=>sum+Number(item.totalPrice),0).toFixed(2):null;
    const charge=(pattern,description)=>{const block=pageLines.find(item=>pattern.test(item.text));if(!block)return null;const values=[...block.text.matchAll(/([\d,.]+)/g)].map(match=>decimal(match[1])).filter(Boolean);const totalPrice=values.at(-1);return totalPrice?internormEcohausAdditionalItem(document,{ordinal:0,category:'surcharge',commercialRole:'colour_startup',description,totalPrice,blocks:[block],includedInSupplierTotal:true,inclusionEvidence:'Explicit supplier colour start-up charge included in the stated net total.'}):null};
    const additionalItems=[charge(/^Alu colour start up\b/i,'Aluminium colour start-up'),charge(/^NCS colour start up\b/i,'NCS colour start-up')].filter(Boolean).map((item,index)=>({...item,ordinal:index}));
    const additionalItemsSubtotal=additionalItems.reduce((total,item)=>total+Number(item.totalPrice||0),0).toFixed(2),expectedFinal=productSubtotal?(Number(productSubtotal)+Number(additionalItemsSubtotal)).toFixed(2):null,roundingVariance=assessSupplierRoundingVariance({currency:'GBP',calculatedTotal:expectedFinal,supplierStatedTotal:finalSupplierTotal});
    const warnings=roundingVariance.status==='material_variance'?['The source Products / Supply and colour start-up charges do not reconcile with the supplier total.']:roundingVariance.status==='accepted_supplier_rounding_variance'?[`Accepted supplier rounding variance: normalized source components total £${expectedFinal}, while the supplier states £${finalSupplierTotal}.`]:[];
    const value=summary(document,{currency:'GBP',productSubtotal,additionalItemsSubtotal,finalSupplierTotal});
    value.reconciliation={positionSubtotal:productSubtotal,additionalSubtotal:additionalItemsSubtotal,deliverySubtotal:null,expectedFinal,reconciled:roundingVariance.accepted,warnings,roundingVariance};
    value.comparisonScope={productsSupply:{status:'separately_stated',grossListAmount:productSubtotal,discountPercentage:null,netAmount:productSubtotal},extras:{status:'separately_stated',amount:additionalItemsSubtotal,labels:additionalItems.map(item=>item.normalizedLabel)},delivery:{status:'not_stated',amount:null,handling:'Receiver/offload responsibility is described; a separate delivery amount is not stated.'},installation:{status:'not_stated',amount:null},survey:{status:'not_stated',amount:null},vat:{status:'excluded',rate:null,amount:null}};
    value.warnings=warnings;value.status=warnings.length?'needs_review':'extracted';return{summary:value,additionalItems,warnings};
  }
  if(parsed.adapter==='norrsken_item_table_v2'){
    const pageLines=lines(document);const evidence=(pattern)=>{const block=pageLines.find(item=>pattern.test(item.text)),match=block?.text.match(/£\s*([\d,.]+)\s*$/);return{value:decimal(match?.[1]),blocks:block?[block]:[]}};const products=evidence(/^Total Items\b/i),delivery=evidence(/^Delivery\b/i),sills=evidence(/^Sills & Trims\b/i),services=evidence(/^Services\b/i),final=evidence(/^Total\s+£/i),productSubtotal=products.value,deliveryTotal=delivery.value,finalSupplierTotal=final.value;
    const additionalItems=[
      sills.value?internormEcohausAdditionalItem(document,{ordinal:0,category:'sill',commercialRole:'external_cills',description:'Sills & Trims',totalPrice:sills.value,blocks:sills.blocks,includedInSupplierTotal:true,inclusionEvidence:'Explicitly included in the supplier quotation total.'}):null,
      services.value?internormEcohausAdditionalItem(document,{ordinal:1,category:'other',commercialRole:'installation',description:'Services',totalPrice:services.value,blocks:services.blocks,includedInSupplierTotal:true,inclusionEvidence:'Supplier services are separately stated and included in the quotation total.'}):null,
      delivery.value?internormEcohausAdditionalItem(document,{ordinal:2,category:'delivery',commercialRole:'delivery',description:'Delivery by 2 × normal HIAB',totalPrice:delivery.value,blocks:delivery.blocks,includedInSupplierTotal:true,inclusionEvidence:'Explicitly included in the supplier quotation total.'}):null,
    ].filter(Boolean);
    const additionalItemsSubtotal=sills.value&&services.value?(Number(sills.value)+Number(services.value)).toFixed(2):null;const value=summary(document,{currency:'GBP',productSubtotal,additionalItemsSubtotal,deliveryTotal,finalSupplierTotal});value.reconciliation={positionSubtotal:positionRows.filter(item=>item.includedInSupplierTotal!==false).reduce((sum,item)=>sum+Number(item.totalPrice||0),0).toFixed(2),additionalSubtotal:additionalItemsSubtotal,deliverySubtotal:deliveryTotal,expectedFinal:[productSubtotal,additionalItemsSubtotal,deliveryTotal].every(Boolean)?(Number(productSubtotal)+Number(additionalItemsSubtotal)+Number(deliveryTotal)).toFixed(2):null,reconciled:false,warnings:[]};value.reconciliation.reconciled=value.reconciliation.expectedFinal!=null&&Number(value.reconciliation.expectedFinal)===Number(finalSupplierTotal);value.reconciliation.warnings=value.reconciliation.reconciled?[]:['Supplied total does not reconcile with the extracted item and service evidence.'];value.comparisonScope={productsSupply:{status:'separately_stated',grossListAmount:productSubtotal,discountPercentage:null,netAmount:productSubtotal},extras:{status:sills.value?'separately_stated':'not_stated',amount:sills.value,labels:['Sills & Trims']},delivery:{status:delivery.value?'included_separately_stated':'not_stated',amount:delivery.value,handling:'2 × normal HIAB'},installation:{status:services.value?'included_separately_stated':'not_stated',amount:services.value,sourceLabel:'Services'},survey:{status:'not_stated',amount:null},vat:{status:'excluded',rate:null,amount:null}};value.warnings=value.reconciliation.warnings;value.status=value.warnings.length?'needs_review':'extracted';return{summary:value,additionalItems,warnings:value.warnings};
  }
  if(parsed.adapter==='twenty_one_degrees_detail_v1'){
    const pageLines=lines(document);const amount=(pattern)=>{const match=pageLines.find(block=>pattern.test(block.text))?.text.match(/£\s*([\d,.]+)\s*$/);return decimal(match?.[1]);};const productSubtotal=amount(/^Sub Total After Discount\b/i),vatTotal=amount(/^VAT\b/i),finalSupplierTotal=amount(/^Total Order Value\b/i);const value=summary(document,{currency:'GBP',productSubtotal,vatTotal,finalSupplierTotal});value.warnings=['Dimensional reconciliation is incomplete because position dimensions are absent from the text layer.'];value.status='needs_review';value.reconciliation={positionSubtotal:positionRows.reduce((sum,item)=>sum+Number(item.totalPrice||0),0).toFixed(2),additionalSubtotal:null,deliverySubtotal:null,expectedFinal:productSubtotal&&vatTotal?(Number(productSubtotal)+Number(vatTotal)).toFixed(2):null,reconciled:Boolean(productSubtotal&&vatTotal&&finalSupplierTotal&&Number(productSubtotal)+Number(vatTotal)===Number(finalSupplierTotal)),warnings:value.warnings};return{summary:value,additionalItems:[],warnings:value.warnings};
  }
  if(['idealcombi_position_table_v1','westcoast_position_schedule_v1'].includes(parsed.adapter))return{summary:null,additionalItems:[],warnings:['A trustworthy end-of-quotation commercial summary was not recognised for this layout.']};
  const totalLabel=blocks.findIndex(block=>parsed.adapter==='gutmann_web_v1'?/^Net price$/i.test(block.text):/^Totals$/i.test(block.text));const candidates=blocks.slice(Math.max(0,totalLabel),totalLabel+40).map(block=>decimal(block.text)).filter(Boolean);const final=candidates[0];const productSubtotal=positionRows.every(item=>item.totalPrice!=null)?positionRows.reduce((sum,item)=>sum+Number(item.totalPrice),0).toFixed(2):null;const detectedCurrency=detectPdfDocumentCurrency(document).currency;const rowCurrencies=[...new Set(positionRows.map(item=>item.currency).filter(Boolean))];const currency=rowCurrencies.length===1?rowCurrencies[0]:detectedCurrency;const value=summary(document,{currency,finalSupplierTotal:final,productSubtotal});const reconciled=productSubtotal!=null&&final!=null&&Number(productSubtotal)===Number(final);value.reconciliation={positionSubtotal:productSubtotal,additionalSubtotal:null,deliverySubtotal:null,expectedFinal:productSubtotal,reconciled,warnings:reconciled?[]:['Supplied final total does not reconcile with the extracted commercial evidence.']};if(!currency)value.reconciliation.warnings.push('The document currency is absent or ambiguous and requires review.');value.warnings=value.reconciliation.warnings;value.status=value.warnings.length?'needs_review':'extracted';return{summary:value,additionalItems:[],warnings:value.warnings};
}

export { cleanMetadataValue };
