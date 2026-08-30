export const EKO_INSIDE_DRAWING_PANEL_GEOMETRY_VERSION = 'eko_winpro_inside_drawing_panel_geometry_v2';

const finiteBox = (item) => {
  const box = item?.boundingBox;
  return box && [box.x, box.y, box.width, box.height].every((value) => Number.isFinite(Number(value)))
    ? { x: Number(box.x), y: Number(box.y), width: Number(box.width), height: Number(box.height) }
    : null;
};
const right = (box) => box.x + box.width;
const top = (box) => box.y + box.height;
const rounded = (value) => Math.round(value * 1000) / 1000;
const roundedBox = (box) => ({ x: rounded(box.x), y: rounded(box.y), width: rounded(box.width), height: rounded(box.height) });
const union = (boxes) => boxes.length ? {
  x: Math.min(...boxes.map((box) => box.x)),
  y: Math.min(...boxes.map((box) => box.y)),
  width: Math.max(...boxes.map(right)) - Math.min(...boxes.map((box) => box.x)),
  height: Math.max(...boxes.map(top)) - Math.min(...boxes.map((box) => box.y)),
} : null;

const numericLabel = /^\d+(?:[.,]\d+)?$/;
const sashLabel = /^\d+\.\d{2}$/;
const roleLabel = /^(?:Above:\s*Inside view|Below:\s*Outside view)$/i;

function repeatedColumnBoundary(page) {
  const candidates = (page.blocks || [])
    .map((block) => ({ block, box: finiteBox(block) }))
    .filter(({ block, box }) => box && box.x >= page.width * 0.40 && box.x <= page.width * 0.62 && !numericLabel.test(String(block.text).trim()));
  const groups = new Map();
  for (const item of candidates) {
    const key = Math.round(item.box.x * 2) / 2;
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }
  const dense = [...groups.entries()].filter(([, items]) => items.length >= 5).sort((left, rightItem) => left[0] - rightItem[0])[0];
  if (!dense) return null;
  const vectorGroups = new Map();
  for (const vector of page.vectorEvidence || []) {
    const box = finiteBox(vector);
    if (!box || box.x < page.width * 0.40 || box.x > page.width * 0.62 || box.width > page.width * 0.002) continue;
    const key = Math.round(box.x * 4) / 4;
    vectorGroups.set(key, (vectorGroups.get(key) || 0) + 1);
  }
  const repeatedVectorBoundary = [...vectorGroups.entries()]
    .filter(([, count]) => count >= 8)
    .sort((left, rightItem) => left[0] - rightItem[0])[0];
  const vectorX = repeatedVectorBoundary?.[0] ?? dense[0];
  const x = Math.min(dense[0], vectorX);
  const crossingHorizontal = (page.vectorEvidence || []).map((vector) => ({ vector, box: finiteBox(vector) }))
    .filter(({ box }) => box && box.height <= page.height * 0.002 && box.x < x
      && (right(box) > x + page.width * 0.08 || box.width > page.width * 0.35))
    .sort((left, rightItem) => left.box.y - rightItem.box.y);
  return {
    x,
    textBoundaryX: dense[0],
    vectorBoundaryX: vectorX,
    evidenceCount: dense[1].length + (repeatedVectorBoundary?.[1] || 0),
    sampleLabels: dense[1].slice(0, 5).map(({ block }) => String(block.text).trim()),
    crossingHorizontal,
  };
}

function widthMarkerPair(page, specificationBoundaryX) {
  const xLimit = specificationBoundaryX * 0.78;
  const groups = new Map();
  for (const block of page.blocks || []) {
    const box = finiteBox(block); const text = String(block.text || '').trim();
    if (!box || !/^\d{3,4}$/.test(text) || box.x < page.width * 0.12 || right(box) > xLimit) continue;
    const group = groups.get(text) || [];
    group.push({ block, box }); groups.set(text, group);
  }
  return [...groups.entries()]
    .filter(([, items]) => items.length >= 2)
    .map(([text, items]) => ({ text, items: items.sort((a, b) => b.box.y - a.box.y).slice(0, 2) }))
    // The overall width marker is the topmost repeated horizontal dimension.
    // Internal height/field dimensions may also repeat between Inside and
    // Outside and can have the same vertical separation.
    .sort((a, b) => b.items[0].box.y - a.items[0].box.y)[0] || null;
}

const daylightLabel = /^±?\s*\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?$/i;

function drawingTextEvidence(page, band, specificationBoundaryX) {
  return (page.blocks || []).map((block) => {
    const box = finiteBox(block); const text = String(block.text || '').trim();
    const objectClass = sashLabel.test(text) ? 'field_reference'
      : daylightLabel.test(text) ? 'daylight_annotation'
        : numericLabel.test(text) ? 'dimension_text'
          : 'manufacturer_drawing_annotation';
    return { block, box, text, objectClass };
  }).filter(({ box, text }) => box && text && box.y >= band.bottom && top(box) <= band.top && box.x < specificationBoundaryX);
}

function specificationTableOwnership(page, specification, insideMarker) {
  const horizontal = specification.crossingHorizontal
    .filter((item) => item.box.y >= insideMarker.box.y)
    .sort((left, rightItem) => left.box.y - rightItem.box.y);
  const topBoundaryY = horizontal[0]?.box.y ?? page.height;
  const tolerance = Math.max(0.55, page.height * 0.0007);
  const topBoundaryPaths = (page.vectorEvidence || []).map((vector) => ({ vector, box: finiteBox(vector) }))
    .filter(({ box }) => box && box.height <= tolerance && box.width >= page.width * 0.025 && Math.abs(box.y - topBoundaryY) <= tolerance)
    .sort((left, rightItem) => left.box.x - rightItem.box.x);
  return { topBoundaryY, tolerance, topBoundaryPaths };
}

function drawingVectorEvidence(page, band, specificationBoundaryX, table) {
  return (page.vectorEvidence || []).map((vector) => {
    const box = finiteBox(vector);
    const edgeBand = page.height * 0.02;
    const objectClass = box && (box.y <= band.bottom + edgeBand || top(box) >= band.top - edgeBand || right(box) >= specificationBoundaryX - page.width * 0.04)
      ? 'dimension_line_arrow_or_extension'
      : box && Math.max(box.width, box.height) <= page.width * 0.018
        ? 'handle_or_small_drawing_mark'
        : 'frame_sash_or_opening_geometry';
    return { vector, box, objectClass };
  }).filter(({ box }) => box && box.y >= band.bottom && top(box) <= band.top
      // Long table strokes cross the specification boundary. Reject the path,
      // rather than painting over blue pixels after rendering.
      && right(box) < specificationBoundaryX && box.x < specificationBoundaryX
      && box.width <= page.width * 0.44 && box.height <= page.height * 0.23
      // Reject every segment in the connected specification-table top edge,
      // including segments which do not themselves cross the column boundary.
      && box.y < table.topBoundaryY - table.tolerance);
}

function regionFromEvidence(page, evidence, specification, table, outsideMarker) {
  const extent = union(evidence.map((item) => item.box));
  if (!extent) return null;
  const xMargin = page.width * 0.006;
  const yMargin = page.height * 0.0022;
  const outsideTop = top(outsideMarker.box);
  const bottom = Math.max(outsideTop + page.height * 0.0005, extent.y - yMargin);
  const left = Math.max(0, extent.x - xMargin);
  const regionRight = Math.min(specification.x - page.width * 0.001, right(extent) + page.width * 0.002);
  // Leave one full rendered-pixel safety gutter at the maximum production
  // scale so antialiasing from the excluded table stroke cannot bleed in.
  const regionTop = Math.min(page.height, table.topBoundaryY - page.height * 0.002, top(extent) + yMargin);
  return roundedBox({ x: left, y: bottom, width: regionRight - left, height: regionTop - bottom });
}

/**
 * Identifies the complete WinPro Inside drawing panel. The classifier is
 * supplier-specific, while its output is the supplier-neutral visual-role
 * contract consumed by the rest of QuoteSuite.
 */
export function detectEkoOknaDrawingPanels(page) {
  if (!page || !Number.isFinite(page.width) || !Number.isFinite(page.height) || !(page.vectorEvidence || []).length) return null;
  const specification = repeatedColumnBoundary(page);
  if (!specification) return null;
  const markerPair = widthMarkerPair(page, specification.x);
  if (!markerPair) return null;
  const [insideMarker, outsideMarker] = markerPair.items;
  const table = specificationTableOwnership(page, specification, insideMarker);
  const preliminaryBand = {
    bottom: top(outsideMarker.box) - page.height * 0.001,
    top: top(insideMarker.box) + page.height * 0.012,
  };
  const textEvidence = drawingTextEvidence(page, preliminaryBand, specification.x);
  const vectorEvidence = drawingVectorEvidence(page, preliminaryBand, specification.x, table);
  const evidence = [...textEvidence, ...vectorEvidence];
  const insideRegion = regionFromEvidence(page, evidence, specification, table, outsideMarker);
  if (!insideRegion) return null;

  const detectedLabels = [...new Set(textEvidence.map((item) => item.text))];
  const lowerDimensionLabels = textEvidence
    .filter((item) => numericLabel.test(item.text) && !sashLabel.test(item.text) && item.box.y < top(outsideMarker.box) + page.height * 0.05)
    .map((item) => item.text);
  const rightDimensionLabels = textEvidence
    .filter((item) => /^\d{3,4}$/.test(item.text) && item.box.x > insideMarker.box.x + insideMarker.box.width)
    .map((item) => item.text);
  const drawingExtent = union(evidence.map((item) => item.box));
  const separatorY = rounded((insideRegion.y + top(outsideMarker.box)) / 2);
  const diagnostics = {
    version: EKO_INSIDE_DRAWING_PANEL_GEOMETRY_VERSION,
    classifier: 'drawing_owned_text_and_vector_evidence',
    drawingOwnedExtent: roundedBox(drawingExtent),
    specificationTableBoundary: { x: rounded(specification.x), textBoundaryX: rounded(specification.textBoundaryX), vectorBoundaryX: rounded(specification.vectorBoundaryX), evidenceCount: specification.evidenceCount, sampleLabels: specification.sampleLabels },
    specificationTableTopBoundary: {
      y: rounded(table.topBoundaryY),
      relationship: 'connected_top_edge_of_specification_grid_crossing_drawing_column_boundary',
      paths: table.topBoundaryPaths.map(({ vector, box }) => ({ id: vector.id, sourceOperatorIndex: vector.sourceOperatorIndex, bounds: roundedBox(box), strokeColor: vector.strokeColor, fillColor: vector.fillColor, lineWidth: rounded(vector.lineWidth) })),
    },
    cropExclusion: { rightBeforeTableX: rounded(right(insideRegion)), topBeforeCrossingTableLineY: rounded(top(insideRegion)) },
    insideOutsideSeparator: { y: separatorY, method: 'repeated_overall_width_markers_and_lower_dimension_band' },
    overallWidthLabel: markerPair.text,
    detectedDimensionLabels: detectedLabels.filter((text) => numericLabel.test(text)),
    detectedDimensionRuns: textEvidence.filter((item) => item.objectClass === 'dimension_text').map((item) => item.text),
    detectedSashLabels: detectedLabels.filter((text) => sashLabel.test(text)),
    detectedDaylightLabels: detectedLabels.filter((text) => daylightLabel.test(text)),
    drawingAnnotations: detectedLabels.filter((text) => !numericLabel.test(text) && !sashLabel.test(text) && !daylightLabel.test(text)),
    lowerDimensionLabels,
    rightDimensionLabels,
    drawingTextEvidenceCount: textEvidence.length,
    drawingVectorEvidenceCount: vectorEvidence.length,
    drawingObjectClasses: [...new Set([...textEvidence, ...vectorEvidence].map((item) => item.objectClass))],
    excludedTablePathCount: table.topBoundaryPaths.length,
    confidence: lowerDimensionLabels.length && rightDimensionLabels.length ? 'strong' : 'review',
    reviewState: lowerDimensionLabels.length && rightDimensionLabels.length ? 'mapped_automatic' : 'review_required',
  };

  // Outside and combined regions remain retained evidence. Their legacy
  // bounds are intentionally independent from the new primary Inside panel;
  // the primary semantic is now explicitly the complete drawing panel.
  const labelBoxes = (page.blocks || []).filter((block) => finiteBox(block) && roleLabel.test(String(block.text).trim())).map(finiteBox);
  const outsideBottom = labelBoxes.length ? Math.max(page.height * 0.38, Math.min(...labelBoxes.map((box) => box.y)) - page.height * 0.008) : page.height * 0.38;
  const outsideTop = outsideMarker.box.y - page.height * 0.006;
  const outsideRegion = roundedBox({ x: insideRegion.x, y: outsideBottom, width: insideRegion.width, height: Math.max(1, outsideTop - outsideBottom) });
  const combinedRegion = roundedBox({ x: insideRegion.x, y: outsideBottom, width: insideRegion.width, height: top(insideRegion) - outsideBottom });
  const common = { sourcePage: page.pageNumber, mappingMethod: EKO_INSIDE_DRAWING_PANEL_GEOMETRY_VERSION, geometryEvidence: diagnostics };
  return [
    { ...common, role: 'inside', primary: true, boundingRegion: insideRegion },
    { ...common, role: 'outside', primary: false, boundingRegion: outsideRegion },
    { ...common, role: 'combined_source', primary: false, boundingRegion: combinedRegion },
  ];
}
