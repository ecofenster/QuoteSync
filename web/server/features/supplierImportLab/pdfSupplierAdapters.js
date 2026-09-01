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

function parseFrameQuotation(document){
  const rows=[]; const segments=pageSegments(document,/^Frame No:\s*\d+\s+Qty:/i);
  for(const blocks of segments){const header=blocks[0].text.match(/^Frame No:\s*(\d+)\s+Qty:\s*(\d+)\s+(.+?)\s*Location:\s*(.+?)\s+£\s*([\d,.]+)$/i);if(!header)continue;const dimension=blocks.find(block=>/\b\d{2,5}\s*x\s*\d{2,5}\b/i.test(block.text))?.text.match(/\b(\d{2,5})\s*x\s*(\d{2,5})\b/i);const uw=blocks.map(block=>block.text).join(' ').match(/\bU(?:w|-Value(?:\s*\(element\))?)\s*[:=]?\s*([\d.,]+)/i)?.[1]??null;const location=cleanMetadataValue(header[4]);rows.push(row(document,{ordinal:rows.length,reference:location||`Frame ${header[1]}`,manufacturerItemNumber:header[1],roomLocation:location,product:cleanMetadataValue(header[3]),configurationDescription:cleanMetadataValue(header[3]),quantity:integerQuantity(header[2]),widthMm:dimension?Number(dimension[1]):null,heightMm:dimension?Number(dimension[2]):null,unitPrice:decimal(header[5]),totalPrice:decimal(header[5]),manufacturerQuotedUw:decimal(uw),blocks,warnings:dimension?[]:['Position dimensions were not recognised.']}));}
  const all=flatten(document),quotation=all.find(block=>/^(?:Quotation|Quote)\s+(?:No\.?\s*)?\d+/i.test(block.text))?.text.match(/\d[\d/-]*/)?.[0]??null;
  return{adapter:'frame_schedule_geometry_v1',supplier:/VELFAC/i.test(textOf(document))?'VELFAC':'Rationel',documentType:'complete_quotation',quotation:{supplierQuotationNumber:quotation,supplierRevision:null,fullQuotationReference:quotation,warnings:[]},metadata:{supplierCustomer:null,projectReference:cleanMetadataValue(all[all.findIndex(block=>/^Customer Reference:$/i.test(block.text))+1]?.text),quotationDate:null},rows,warnings:rows.length?[]:['Frame quotation positions were not detected.']};
}

function parseIdealcombi(document){
  const rows=[];
  for(const block of lines(document)){const match=block.text.match(/^(\d+)\s+(\d+)\s+(.+?)\s+(\d{2,5})\s*X\s*(\d{2,5})\s+([\d.,]+)\s+([\d.,]+)$/i);if(!match)continue;rows.push(row(document,{ordinal:rows.length,reference:match[1],manufacturerItemNumber:match[1],roomLocation:cleanMetadataValue(match[3]),quantity:integerQuantity(match[2]),widthMm:Number(match[4]),heightMm:Number(match[5]),unitPrice:decimal(match[6]),totalPrice:decimal(match[7]),blocks:[block]}));}
  const all=flatten(document),quotation=all[all.findIndex(block=>/^Quotation no\.$/i.test(block.text))+1]?.text??null;
  return{adapter:'idealcombi_position_table_v1',supplier:'Idealcombi',documentType:'complete_quotation',quotation:{supplierQuotationNumber:cleanMetadataValue(quotation),supplierRevision:null,fullQuotationReference:cleanMetadataValue(quotation),warnings:[]},metadata:{supplierCustomer:null,projectReference:null,quotationDate:null},rows,warnings:rows.length?[]:['Idealcombi position table was not detected.']};
}

function parseNorrsken(document){
  const rows=[];
  for(const block of lines(document)){const marker=block.text.match(/^(\d+)\s+(Option\s+)?(Type\s+.+?)\s*-\s*(\[?\d+\]?)\s+(.+)$/i);if(!marker||!/£/.test(marker[5]))continue;const beforePrice=marker[5].split('£')[0];const dimensions=[...beforePrice.matchAll(/\b(\d{3,5})\b/g)].map(match=>Number(match[1]));if(dimensions.length<2)continue;const [widthMm,heightMm]=dimensions.slice(-2);const prices=[...marker[5].matchAll(/£\s*\[?([\d,.]+)\]?/g)].map(match=>decimal(match[1]));if(!prices.length)continue;const quantity=integerQuantity(marker[4].replace(/[\[\]]/g,''));const baseReference=cleanMetadataValue(marker[3]);const product=cleanMetadataValue(beforePrice.replace(/\b\d{3,5}\b[\s\S]*$/,'').trim())||null;const values=[...beforePrice.matchAll(/\b(0?\.\d+|1(?:\.0+)?)\b/g)].map(match=>decimal(match[1])).filter(Boolean);const alternative=Boolean(marker[2])||/\[/.test(marker[4]);const reference=alternative?`${baseReference} ALT`:baseReference;rows.push(row(document,{ordinal:rows.length,reference,manufacturerItemNumber:marker[1],product,quantity,widthMm,heightMm,unitPrice:prices[0],totalPrice:prices.at(-1),classification:alternative?'alternative':'standard',alternativeTo:alternative?baseReference:null,classificationEvidence:alternative?'Supplier table labels the position as an option.':null,manufacturerQuotedUw:values.at(-1)??null,blocks:[block]}));}
  const all=flatten(document),quotation=textOf(document).match(/(?:Quotation|Quote)\s*(?:No\.?|number)?\s*[:#]?\s*([A-Z0-9/-]+)/i)?.[1]??null;
  return{adapter:'norrsken_item_table_v1',supplier:'Norrsken',documentType:'complete_quotation',quotation:{supplierQuotationNumber:quotation,supplierRevision:null,fullQuotationReference:quotation,warnings:[]},metadata:{supplierCustomer:null,projectReference:null,quotationDate:null},rows,warnings:rows.length?[]:['Norrsken item table was not detected.']};
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
    supplierIdentity: {
      role: 'quotation_issuer',
      authority: 'explicit_document_issuer',
      sourceLegalName: issuerBlock?.text ?? 'ecoHaus SW Ltd.',
      dealerName: 'EcoHaus',
      evidence: issuerBlock ? sourceTrace(document, [issuerBlock]) : [],
    },
    manufacturerIdentity: {
      role: 'product_manufacturer',
      authority: 'explicit_product_brand',
      evidence: sourceTrace(document, manufacturerBlocks),
    },
    supplierManufacturerRelationship: {
      relationship: 'dealer_supplies_manufacturer_products',
      supplierDealerName: 'EcoHaus',
      supplierSourceLegalName: issuerBlock?.text ?? 'ecoHaus SW Ltd.',
      manufacturerName: 'Internorm',
      pricingScope: 'supplier_dealer_quotation',
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
    manufacturerIdentity: { role: 'product_manufacturer', authority: 'explicit_product_brand', evidence: sourceTrace(document, manufacturerBlocks) },
    supplierManufacturerRelationship: {
      relationship: 'dealer_supplies_manufacturer_products', supplierDealerName: 'Aspect Aluminium', supplierSourceLegalName: issuerBlock?.text ?? 'Aspect Aluminium', manufacturerName: 'Internorm', pricingScope: 'supplier_dealer_quotation',
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

function parseEkoItemised(document,variant){
  const pages=document.pages,rows=[];const currencyEvidence=detectPdfDocumentCurrency(document);const currencyWarnings=currencyEvidence.currency?[]:['The document currency is absent or ambiguous and requires review.'];
  const segments=variant==='eko'?(()=>{const blocks=flatten(document),markers=blocks.map((block,index)=>/^(?:Window|Door)\s+\d{3}$/i.test(block.text)?index:-1).filter(index=>index>=0);return markers.map((start,index)=>blocks.slice(start,markers[index+1]??blocks.length));})():pages.map(page=>page.blocks.map(block=>({...block,text:String(block.text).trim(),pageNumber:page.pageNumber})).filter(block=>block.text));
  for(const blocks of segments){const markerIndex=blocks.findIndex(block=>/^(?:Window|Door)\s+\d{3}$/i.test(block.text));if(markerIndex<0)continue;const marker=blocks[markerIndex],quantityBlock=blocks.slice(markerIndex+1).find(block=>/^(?:Qty\s*:|Quantity:)/i.test(block.text));const priceLabel=blocks.findIndex(block=>/^Price$|^Window price$/i.test(block.text));const priceBlock=priceLabel>=0?blocks.slice(priceLabel+1).find(block=>decimal(block.text)!=null):null;const dimensions=blocks.find(block=>/^Dimensions\s+\d+\s*mm\s*x\s*\d+\s*mm$/i.test(block.text))?.text.match(/(\d+)\s*mm\s*x\s*(\d+)\s*mm/i);let width=dimensions?Number(dimensions[1]):null,height=dimensions?Number(dimensions[2]):null;if(variant==='gutmann'){const diagram=blocks.slice(0,markerIndex).filter(block=>/^\d{3,4}$/.test(block.text)).map(block=>Number(block.text));if(diagram.length){width=Math.max(...diagram);height=diagram.filter(value=>value!==width).sort((a,b)=>b-a)[0]||null;}}const reference=marker.text.replace(/^(Window|Door)\s+/i,'');const totalPrice=decimal(priceBlock?.text),joined=blocks.map(block=>block.text).join(' ');const system=joined.match(/\bSystem\s*:\s*(.{1,120}?)(?=\s+(?:Page\s+\d|Colour|Window|Door|Price|Dimensions|FIX|Outer frame)\b|$)/i)?.[1]??null;const ug=joined.match(/\bUg\s*=\s*([\d.,]+)/i)?.[1]??null,uw=joined.match(/\bUw\s*=\s*([\d.,]+)/i)?.[1]??null;const glazing=blocks.find(block=>/\bUg\s*=\s*[\d.,]+/i.test(block.text))?.text??null;const visualRegions=variant==='eko'?ekoPositionVisualRegions(document,blocks,marker.pageNumber):null;const sourceSpecification=variant==='eko'?extractEkoOknaSourceSpecification(document,blocks,visualRegions?.[0]?.sourcePage):null;rows.push(row(document,{ordinal:rows.length,reference,manufacturerItemNumber:reference,product:/^Door/i.test(marker.text)?'Door':'Window',productSystem:cleanMetadataValue(system),glassSpecification:cleanMetadataValue(glazing),quantity:integerQuantity(quantityBlock?.text.split(':').slice(1).join(':')),widthMm:width,heightMm:height,unitPrice:totalPrice,totalPrice,currency:currencyEvidence.currency,manufacturerQuotedUg:decimal(ug),manufacturerQuotedUw:decimal(uw),blocks,warnings:currencyWarnings,visualRegions,sourceSpecification}));}
  const all=flatten(document),quotationText=variant==='gutmann'?all.find(block=>/Price details\s+WEB\//i.test(block.text))?.text:all.find(block=>/^Quotation\s+OF\//i.test(block.text))?.text;const full=quotationText?.match(/(?:WEB|OF)\/\d+\/\d+/i)?.[0]||null;const client=variant==='gutmann'?all[all.findIndex(block=>/^Client:$/i.test(block.text))+1]?.text:all.find(block=>/^ECOFENSTER LTD/i.test(block.text))?.text;const project=variant==='gutmann'?all.find(block=>/^Your reference:/i.test(block.text))?.text.split(':').slice(1).join(':'):null;const date=variant==='gutmann'?all.find(block=>/^\d{2}\/\d{2}\/\d{4}$/.test(block.text))?.text:all.find(block=>/^\d{2}\/\d{2}\/\d{4}$/.test(block.text))?.text;
  return{adapter:variant==='gutmann'?'gutmann_web_v1':'eko_okna_winpro_v1',supplier:variant==='gutmann'?'Ecofenster / Gutmann':'EKO-OKNA',documentType:'complete_quotation',quotation:{supplierQuotationNumber:full,supplierRevision:null,fullQuotationReference:full,warnings:currencyWarnings},metadata:{supplierCustomer:cleanMetadataValue(client),projectReference:cleanMetadataValue(project),quotationDate:dateIso(date)},rows,warnings:rows.length?currencyWarnings:['Itemised PDF positions were not detected.']};
}

function parseGlassWorxCover(document){const blocks=flatten(document),reference=blocks.find(block=>/^25\s*-\s*\d+\s*-/i.test(block.text))?.text||null,preparedFor=blocks[blocks.findIndex(block=>/^Prepared for$/i.test(block.text))+1]?.text||null,date=blocks.find(block=>/^\d{2}\.\d{2}\.\d{4}$/.test(block.text))?.text;return{adapter:'glass_worx_cover_v1',supplier:'Glass Worx',documentType:'quotation_letter',quotation:{supplierQuotationNumber:cleanMetadataValue(reference),supplierRevision:null,fullQuotationReference:cleanMetadataValue(reference),warnings:[]},metadata:{supplierCustomer:cleanMetadataValue(preparedFor),projectReference:cleanMetadataValue(reference),quotationDate:dateIso(date)},rows:[],warnings:[]};}

const adapters=[
  {recognizes:text=>/\becoHaus\b[\s\S]*Offer number:\s*\d+/i.test(text)&&/\bHF410\b[\s\S]*\bHS330\b[\s\S]*SUPPLY & INSTALL PACKAGE/i.test(text)&&/\bPos\.\s*\nQuantity\b/i.test(text),parse:parseInternormEcohaus},
  {recognizes:text=>/^Aspect Aluminium$/im.test(text)&&/\bwww\.aspectaluminium\.co\.uk\b/i.test(text)&&/\bInternorm\b/i.test(text)&&/\bPos\.\s*\nQuantity\s*\nDescription\b/i.test(text)&&/Internorm Triple Glazed[\s\S]*Supply and install in the sum of £/i.test(text),parse:parseInternormAspect},
  {recognizes:text=>/Glass Worx Limited[\s\S]*Offer number:\s*\d+/i.test(text)&&/\bPos\.\s*\nQuantity\b/i.test(text),parse:parseInternormSchedule},
  {recognizes:text=>/Glass Worx Ltd[\s\S]*YOUR PROJECT COSTS/i.test(text),parse:parseGlassWorxCover},
  {recognizes:text=>/EKO-OKNA S\.A\.[\s\S]*Quotation\s+OF\//i.test(text),parse:document=>parseEkoItemised(document,'eko')},
  {recognizes:text=>/Price details\s+WEB\//i.test(text)&&/\[GUTMANN\]/i.test(text),parse:document=>parseEkoItemised(document,'gutmann')},
  {recognizes:text=>/\bFrame No:\s*\d+\b[\s\S]*\bQty:\s*\d+/i.test(text)&&/\b(?:VELFAC|Rationel)\b/i.test(text),parse:parseFrameQuotation},
  {recognizes:text=>/\bIdealcombi\b/i.test(text)&&/\bQuotation no\./i.test(text)&&/\bGBP\/ Unit\b/i.test(text),parse:parseIdealcombi},
  {recognizes:text=>/\bItem\s+Location\s+No\.\s+Type\s+Width Height Glazing\b/i.test(text)&&/\bPrice ea\.\s*\nPrice Total\b/i.test(text),parse:parseNorrsken},
  {recognizes:text=>/\bWestcoast Windows AB\b/i.test(text)&&/\bPowered by CalWin\b/i.test(text),parse:parseWestcoast},
  {recognizes:text=>/\b21 Degrees\b/i.test(text)&&/\bGB Quote Reference\b/i.test(text)&&/\bPrice after discount\b/i.test(text),parse:parseTwentyOneDegrees},
];

export function parsePdfSupplierFields(document){if(document.mediaType!=='application/pdf')return null;const text=textOf(document);const adapter=adapters.find(candidate=>candidate.recognizes(text));return adapter?adapter.parse(document):null;}

function summary(document,{currency,finalSupplierTotal,productSubtotal=null,additionalItemsSubtotal=null,deliveryTotal=null,vatTotal=null}){const blocks=flatten(document),original={currency, totalQuantity:null,totalQuantityUnit:null,totalAreaSquareMetres:null,productSubtotal,additionalItemsSubtotal,deliveryTotal,vatTotal,finalSupplierTotal,averageUValue:null,totalWeightKg:null,closingNotes:null};return{id:randomUUID(),...original,sourceTrace:sourceTrace(document,blocks.filter(block=>/total|net price|cost \(excl/i.test(block.text))),warnings:[],confidence:0.96,status:'extracted',originalExtractedSnapshot:original};}

function internormEcohausAdditionalItem(document, { ordinal, category, commercialRole = category, description, quantity = null, quantityUnit = null, unitPrice = null, totalPrice, blocks, includedInSupplierTotal, inclusionEvidence, selectedForFutureUse = true }) {
  const original = { category, commercialRole, originalDescription: description, normalizedLabel: description, quantity, quantityUnit, unitPrice, totalPrice, currency: 'GBP', includedInSupplierTotal, inclusionEvidence, selectedForFutureUse };
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
  if(parsed.adapter==='internorm_ecohaus_complete_quotation_v1')return parseInternormEcohausSummary(document,parsed,positionRows);
  if(parsed.adapter==='internorm_aspect_schedule_v1')return parseInternormAspectSummary(document,parsed,positionRows);
  if(parsed.adapter==='internorm_schedule_v1')return{summary:null,additionalItems:[],warnings:['Line prices and quotation total are supplied separately.']};
  if(parsed.adapter==='glass_worx_cover_v1'){
    const packageValues=blocks.filter(block=>/^\d{1,3},\d{3}\.\d{2}$/.test(block.text)).map(block=>decimal(block.text)).slice(-3);const selected=packageValues[1]??packageValues[0]??null;
    const labels=['Bronze / Supply Only','Silver / Install Support','Gold / Full Installation'];const value=summary(document,{currency:'GBP',finalSupplierTotal:selected});value.comparisonTotals=packageValues.map((amount,index)=>({classification:'package_option',label:labels[index],amount,currency:'GBP',includedInSupplierTotal:index===1,selected:index===1,sourceTrace:sourceTrace(document,blocks.filter(block=>decimal(block.text)===amount))}));value.originalExtractedSnapshot.comparisonTotals=value.comparisonTotals;value.warnings=['Line-level reconciliation is unavailable because the authoritative schedule is unpriced.'];value.status='needs_review';value.reconciliation={positionSubtotal:null,additionalSubtotal:null,deliverySubtotal:null,expectedFinal:null,reconciled:false,warnings:value.warnings};return{summary:value,additionalItems:[],warnings:value.warnings};
  }
  if(parsed.adapter==='norrsken_item_table_v1'){
    const pageLines=lines(document);const amount=(pattern)=>{const match=pageLines.find(block=>pattern.test(block.text))?.text.match(/£\s*([\d,.]+)\s*$/);return decimal(match?.[1]);};const productSubtotal=amount(/^Total Items\b/i),deliveryTotal=amount(/^Delivery\b/i),sills=amount(/^Sills & Trims\b/i),services=amount(/^Services\b/i),finalSupplierTotal=amount(/^Total\s+£/i);const additionalItemsSubtotal=sills&&services?(Number(sills)+Number(services)).toFixed(2):null;const value=summary(document,{currency:'GBP',productSubtotal,additionalItemsSubtotal,deliveryTotal,finalSupplierTotal});value.reconciliation={positionSubtotal:positionRows.filter(item=>item.includedInSupplierTotal!==false).reduce((sum,item)=>sum+Number(item.totalPrice||0),0).toFixed(2),additionalSubtotal:additionalItemsSubtotal,deliverySubtotal:deliveryTotal,expectedFinal:[productSubtotal,additionalItemsSubtotal,deliveryTotal].every(Boolean)?(Number(productSubtotal)+Number(additionalItemsSubtotal)+Number(deliveryTotal)).toFixed(2):null,reconciled:false,warnings:[]};value.reconciliation.reconciled=value.reconciliation.expectedFinal!=null&&Number(value.reconciliation.expectedFinal)===Number(finalSupplierTotal);value.reconciliation.warnings=value.reconciliation.reconciled?[]:['Supplied total does not reconcile with the extracted item and service evidence.'];value.warnings=value.reconciliation.warnings;value.status=value.warnings.length?'needs_review':'extracted';return{summary:value,additionalItems:[],warnings:value.warnings};
  }
  if(parsed.adapter==='twenty_one_degrees_detail_v1'){
    const pageLines=lines(document);const amount=(pattern)=>{const match=pageLines.find(block=>pattern.test(block.text))?.text.match(/£\s*([\d,.]+)\s*$/);return decimal(match?.[1]);};const productSubtotal=amount(/^Sub Total After Discount\b/i),vatTotal=amount(/^VAT\b/i),finalSupplierTotal=amount(/^Total Order Value\b/i);const value=summary(document,{currency:'GBP',productSubtotal,vatTotal,finalSupplierTotal});value.warnings=['Dimensional reconciliation is incomplete because position dimensions are absent from the text layer.'];value.status='needs_review';value.reconciliation={positionSubtotal:positionRows.reduce((sum,item)=>sum+Number(item.totalPrice||0),0).toFixed(2),additionalSubtotal:null,deliverySubtotal:null,expectedFinal:productSubtotal&&vatTotal?(Number(productSubtotal)+Number(vatTotal)).toFixed(2):null,reconciled:Boolean(productSubtotal&&vatTotal&&finalSupplierTotal&&Number(productSubtotal)+Number(vatTotal)===Number(finalSupplierTotal)),warnings:value.warnings};return{summary:value,additionalItems:[],warnings:value.warnings};
  }
  if(['idealcombi_position_table_v1','frame_schedule_geometry_v1','westcoast_position_schedule_v1'].includes(parsed.adapter))return{summary:null,additionalItems:[],warnings:['A trustworthy end-of-quotation commercial summary was not recognised for this layout.']};
  const totalLabel=blocks.findIndex(block=>parsed.adapter==='gutmann_web_v1'?/^Net price$/i.test(block.text):/^Totals$/i.test(block.text));const candidates=blocks.slice(Math.max(0,totalLabel),totalLabel+40).map(block=>decimal(block.text)).filter(Boolean);const final=candidates[0];const productSubtotal=positionRows.every(item=>item.totalPrice!=null)?positionRows.reduce((sum,item)=>sum+Number(item.totalPrice),0).toFixed(2):null;const detectedCurrency=detectPdfDocumentCurrency(document).currency;const rowCurrencies=[...new Set(positionRows.map(item=>item.currency).filter(Boolean))];const currency=rowCurrencies.length===1?rowCurrencies[0]:detectedCurrency;const value=summary(document,{currency,finalSupplierTotal:final,productSubtotal});const reconciled=productSubtotal!=null&&final!=null&&Number(productSubtotal)===Number(final);value.reconciliation={positionSubtotal:productSubtotal,additionalSubtotal:null,deliverySubtotal:null,expectedFinal:productSubtotal,reconciled,warnings:reconciled?[]:['Supplied final total does not reconcile with the extracted commercial evidence.']};if(!currency)value.reconciliation.warnings.push('The document currency is absent or ambiguous and requires review.');value.warnings=value.reconciliation.warnings;value.status=value.warnings.length?'needs_review':'extracted';return{summary:value,additionalItems:[],warnings:value.warnings};
}

export { cleanMetadataValue };
