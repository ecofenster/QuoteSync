const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const decimal = (value) => {
  const compact = clean(value).replace(/[\s\u00a0£€$]/g, '').replace(',', '.');
  return /^-?\d+(?:\.\d+)?$/.test(compact) ? compact : null;
};
const finiteBox = (block) => block?.boundingBox && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(Number(block.boundingBox[key])));

function unionBox(blocks) {
  const boxes = blocks.filter(finiteBox).map((block) => block.boundingBox);
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const top = Math.max(...boxes.map((box) => box.y + box.height));
  return { x, y, width: right - x, height: top - y };
}

function tableRows(page, positionBlocks) {
  const rows = [];
  const blocks = positionBlocks
    .filter((block) => block.pageNumber === page.pageNumber && finiteBox(block) && block.boundingBox.x >= page.width * 0.42 && block.boundingBox.y >= page.height * 0.07)
    .sort((left, right) => right.boundingBox.y - left.boundingBox.y || left.boundingBox.x - right.boundingBox.x);
  for (const block of blocks) {
    const row = rows.find((candidate) => Math.abs(candidate.y - block.boundingBox.y) <= 0.8);
    if (row) row.blocks.push(block);
    else rows.push({ y: block.boundingBox.y, blocks: [block] });
  }
  return rows.map((row) => {
    row.blocks.sort((left, right) => left.boundingBox.x - right.boundingBox.x);
    return { ...row, parts: row.blocks.map((block) => clean(block.text)).filter(Boolean), text: row.blocks.map((block) => clean(block.text)).filter(Boolean).join(' ') };
  });
}

const slug = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function field(section, label, rawValue, row, index, normalizedValue = null, extra = {}) {
  return {
    id: `${slug(section)}:${slug(label)}:${index}`,
    ordinal: index,
    section,
    label,
    rawValue: clean(rawValue),
    normalizedValue,
    sourcePage: row.blocks[0]?.pageNumber ?? null,
    boundingRegion: unionBox(row.blocks),
    coordinateSpace: 'pdf_points',
    evidenceClass: 'explicit',
    confidence: 'strong',
    reviewStatus: 'mapped_automatic',
    ...extra,
  };
}

function splitKnownField(text) {
  const patterns = [
    ['Outside colour', /^Outside colour\s+(.+)$/i],
    ['Inside colour', /^Inside colour\s+(.+)$/i],
    ['Wall configuration', /^Wall configuration\s+(.+)$/i],
    ['Dimensions', /^Dimensions\s+(.+)$/i],
    ['Veneer code for frame', /^Veneer code for frame\s+(.+)$/i],
    ['Veneer code for sash', /^Veneer code for sash\s+(.+)$/i],
    ['Drainage', /^DRAINAGE\s+(.+)$/i],
    ['Frame decompression', /^frame decompression(?:\s*-\s*up)?\s+(.+)$/i],
    ['Weld type', /^weld type\s+(.+)$/i],
    ['Colour facing', /^Colour facing:\s*(.+)$/i],
    ['Additional profile assembly', /^Additional profile assembly\s+(.+)$/i],
    ['Glazing bead', /^Glazing bead\s+(.+)$/i],
    ['Fitting', /^Fitting\s+(.+)$/i],
    ['Hardware type', /^Hardware type\s+(.+)$/i],
    ['Security class', /^Security class\s+(.+)$/i],
    ['Closing type', /^Closing type\s+(.+)$/i],
    ['Opening lock', /^Opening lock\s+(.+)$/i],
    ['Opening block', /^Opening block\s+(.+)$/i],
    ['Thermal coefficient', /^Thermal coefficient\s+(.+)$/i],
    ['Unit weight', /^Unit weight\s+(.+)$/i],
    ['Perimeter', /^Perimeter\s+(.+)$/i],
    ['Window price', /^Window price\s+(.+)$/i],
  ];
  for (const [label, pattern] of patterns) {
    const match = text.match(pattern);
    if (match) return { label, value: match[1] };
  }
  return null;
}

function canonicalFinish(rawValue, role, sourceFieldId) {
  const code = rawValue.match(/\bAP\d+\b/i)?.[0]?.toUpperCase() ?? null;
  const description = clean(rawValue.split('/').slice(1).join('/')) || rawValue;
  return { role, value: description, manufacturerCode: code, manufacturerSourceValue: rawValue, sourceFieldId };
}

function canonicalValue(value, sourceFieldId, extra = {}) {
  return { value, manufacturerSourceValue: value, sourceFieldId, ...extra };
}

function fieldBy(fields, section, label, occurrence = 0) {
  return fields.filter((item) => item.section === section && item.label === label)[occurrence] ?? null;
}

/**
 * Interpret WinPro's positioned, machine-readable EKO-OKNA table into the
 * supplier-neutral source-specification contract. Unmapped lines remain as
 * explicit Manufacturer detail evidence instead of being discarded.
 */
export function extractEkoOknaSourceSpecification(document, positionBlocks, sourcePage) {
  const page = document.pages.find((item) => item.pageNumber === sourcePage);
  if (!page) return null;
  const positionPages = new Set(positionBlocks.map((block) => block.pageNumber).filter((pageNumber) => Number.isInteger(pageNumber) && pageNumber >= sourcePage));
  const specificationPages = document.pages.filter((item) => positionPages.has(item.pageNumber) && (item.pageNumber === sourcePage || Number(item.contentEvidence?.vectorPathCount || 0) < 200));
  const rows = specificationPages.flatMap((item) => tableRows(item, positionBlocks));
  const fields = [];
  const sections = [];
  let section = 'Manufacturer details';
  let sashSection = null;
  const ensureSection = (name) => { section = name; if (!sections.includes(name)) sections.push(name); };
  const add = (label, value, row, normalizedValue = null, extra = {}) => {
    if (!clean(value)) return null;
    const item = field(section, label, value, row, fields.length, normalizedValue, extra);
    fields.push(item);
    return item;
  };

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (/^(?:Quotation\b|\d{2}\/\d{2}\/\d{4}$|Page\s+\d+\s*\/)/i.test(row.text)) continue;
    const heading = row.parts[0] ?? row.text;
    if (/^Outer frame$/i.test(heading)) { ensureSection('Outer frame'); add('Profile', row.parts.slice(1).join(' '), row); continue; }
    if (/^Peripheral profile$/i.test(heading)) { ensureSection('Peripheral profile'); add('Profile', row.parts.slice(1).join(' '), row); continue; }
    if (/^Transom(?:\s+\d+)?$/i.test(heading)) { ensureSection(heading); add('Profile', row.parts.slice(1).join(' '), row); continue; }
    if (/^Glazing required$/i.test(heading)) { ensureSection('Glazing'); add('Glazing required', row.parts.slice(1).join(' '), row); continue; }
    if (/^Sash(?:\s+\d+)?$/i.test(heading)) { sashSection = heading === 'Sash' ? 'Sash 1' : heading; ensureSection(sashSection); add('Profile', row.parts.slice(1).join(' '), row, null, { sourceElementReference: `${heading.match(/\d+/)?.[0] ?? 1}.01` }); continue; }
    if (/^Messages$/i.test(heading)) { ensureSection('Messages'); continue; }
    if (/^Thermal coefficient$/i.test(heading)) { ensureSection('Performance'); add('Thermal coefficient', row.parts.slice(1).join(' '), row, decimal(row.parts.slice(1).join(' ')?.match(/[\d,.]+/)?.[0])); continue; }
    if (/^Unit weight$/i.test(heading)) { ensureSection('Performance'); add('Unit weight', row.parts.slice(1).join(' '), row, decimal(row.parts.slice(1).join(' ')?.match(/[\d,.]+/)?.[0])); continue; }
    if (/^Perimeter$/i.test(heading)) { ensureSection('Performance'); add('Perimeter', row.parts.slice(1).join(' '), row, decimal(row.parts.slice(1).join(' ')?.match(/[\d,.]+/)?.[0])); continue; }
    if (/^Accessories$/i.test(heading)) { ensureSection('Accessories'); continue; }
    if (/^Glazing used$/i.test(heading)) { ensureSection('Glazing used'); continue; }
    if (/^Window price$/i.test(heading)) { ensureSection('Commercial'); add('Window price', row.parts.slice(1).join(' '), row, decimal(row.parts.slice(1).join(' '))); continue; }

    if (section === 'Glazing used' && /^\d+\.\d+$/.test(heading)) {
      const paneReference = heading;
      const value = row.parts.slice(1).find((part) => /\bUg\s*=|\d+Ar/i.test(part)) ?? row.parts[1] ?? '';
      const dimensions = row.parts.find((part) => /^\d+\s*x\s*\d+$/i.test(part)) ?? null;
      add('Glazing', value, row, null, { sourceElementReference: paneReference, paneDimensions: dimensions });
      continue;
    }
    if (section === 'Glazing used' && /^(?:ULTIMATE|Warm edge:|Solar gain\s*=|Light transmission\s*=)/i.test(row.text)) {
      const lastPane = [...fields].reverse().find((item) => item.section === 'Glazing used' && item.sourceElementReference);
      add(clean(row.text.split(/[:=]/)[0]), row.text, row, null, { sourceElementReference: lastPane?.sourceElementReference ?? null });
      continue;
    }
    if (section === 'Accessories' && !/^Window volume\b/i.test(row.text) && row.parts.length >= 2 && /\d[,.]\d{3}$/.test(row.parts.at(-1))) {
      add('Accessory', row.parts.slice(0, -1).join(' '), row, decimal(row.parts.at(-1)), { quantity: decimal(row.parts.at(-1)) });
      continue;
    }
    if (section === 'Messages') {
      const subject = row.parts[0]?.match(/^(.+?):\s*(.+)$/);
      if (subject && row.parts.length > 1) add(subject[1], `${subject[2]} — ${row.parts.slice(1).join(' ')}`, row);
      else add('Message', row.text, row);
      continue;
    }

    const known = splitKnownField(row.text);
    if (known) { add(known.label, known.value, row); continue; }
    if (/^Glazing bead$/i.test(heading)) { add('Glazing bead', row.parts.slice(1).join(' '), row); continue; }
    if (/^(?:Qty|Dimensions)$/i.test(row.text) || row.text === ')') continue;
    if (section === 'Manufacturer details' && /^Colour\s*:/i.test(row.text)) { add('Colour summary', row.text.replace(/^Colour\s*:\s*/i, ''), row); continue; }
    add(section === 'Accessories' ? 'Accessory detail' : section === 'Glazing used' ? 'Glazing detail' : 'Manufacturer detail', row.text, row);
  }

  if (!fields.some((item) => item.section === 'Commercial' && item.label === 'Window price')) {
    const labelIndex = positionBlocks.findIndex((block) => /^Window price$/i.test(clean(block.text)));
    const priceBlock = labelIndex >= 0 ? positionBlocks.slice(labelIndex + 1).find((block) => decimal(block.text) != null) : null;
    if (labelIndex >= 0 && priceBlock) {
      ensureSection('Commercial');
      add('Window price', priceBlock.text, { blocks: [positionBlocks[labelIndex], priceBlock] }, decimal(priceBlock.text));
    }
  }

  const external = fieldBy(fields, 'Outer frame', 'Outside colour');
  const internal = fieldBy(fields, 'Outer frame', 'Inside colour');
  const frame = fieldBy(fields, 'Outer frame', 'Profile');
  const wall = fieldBy(fields, 'Outer frame', 'Wall configuration');
  const frameVeneer = fieldBy(fields, 'Outer frame', 'Veneer code for frame');
  const sashVeneer = fieldBy(fields, 'Outer frame', 'Veneer code for sash');
  const drainage = fieldBy(fields, 'Outer frame', 'Drainage');
  const decompression = fieldBy(fields, 'Outer frame', 'Frame decompression');
  const weld = fieldBy(fields, 'Outer frame', 'Weld type');
  const peripheral = fieldBy(fields, 'Peripheral profile', 'Profile');
  const transoms = fields.filter((item) => /^Transom/.test(item.section) && item.label === 'Profile');
  const glazing = fieldBy(fields, 'Glazing', 'Glazing required');
  const bead = fieldBy(fields, 'Glazing', 'Glazing bead') ?? fields.find((item) => item.label === 'Glazing bead');
  const weight = fieldBy(fields, 'Performance', 'Unit weight');
  const perimeter = fieldBy(fields, 'Performance', 'Perimeter');
  const thermal = fieldBy(fields, 'Performance', 'Thermal coefficient');
  const price = fieldBy(fields, 'Commercial', 'Window price');
  const sashes = sections.filter((name) => /^Sash\s+\d+$/.test(name)).map((name) => {
    const items = fields.filter((item) => item.section === name);
    const sourceElementReference = items.find((item) => item.sourceElementReference)?.sourceElementReference ?? `${name.match(/\d+/)?.[0]}.01`;
    return {
      sourceElementReference,
      profile: items.find((item) => item.label === 'Profile')?.rawValue ?? null,
      fitting: items.find((item) => item.label === 'Fitting')?.rawValue ?? null,
      hardware: items.find((item) => item.label === 'Hardware type')?.rawValue ?? null,
      security: items.find((item) => item.label === 'Security class')?.rawValue ?? null,
      closing: items.find((item) => item.label === 'Closing type')?.rawValue ?? null,
      locking: items.find((item) => item.label === 'Opening lock')?.rawValue ?? items.find((item) => item.label === 'Opening block')?.rawValue ?? null,
      sourceFieldIds: items.map((item) => item.id),
    };
  });
  const glazingUnits = fields.filter((item) => item.section === 'Glazing used' && item.label === 'Glazing').map((item) => {
    const related = fields.filter((candidate) => candidate.section === 'Glazing used' && candidate.sourceElementReference === item.sourceElementReference);
    return {
      sourceElementReference: item.sourceElementReference,
      glassBuildUp: item.rawValue,
      ug: decimal(item.rawValue.match(/\bUg\s*=\s*([\d,.]+)/i)?.[1]),
      acousticRw: clean(item.rawValue.match(/\bRw\s*=\s*([^([]+)/i)?.[1]) || null,
      thicknessMm: Number(item.rawValue.match(/\((\d+)mm\)/i)?.[1] ?? 0) || null,
      dimensions: item.paneDimensions ?? null,
      warmEdge: related.find((candidate) => /^Warm edge$/i.test(candidate.label))?.rawValue ?? null,
      solarGainPercent: decimal(related.find((candidate) => /^Solar gain$/i.test(candidate.label))?.rawValue.match(/[\d,.]+/)?.[0]),
      lightTransmissionPercent: decimal(related.find((candidate) => /^Light transmission$/i.test(candidate.label))?.rawValue.match(/[\d,.]+/)?.[0]),
      sourceFieldIds: related.map((candidate) => candidate.id),
    };
  });
  return {
    version: 'manufacturer-source-specification-v1',
    supplierInterpretation: 'eko_okna_winpro_specification_v1',
    sourceAttachmentId: document.attachmentId,
    sourcePage,
    sourcePages: [...new Set(fields.map((item) => item.sourcePage).filter(Number.isInteger))],
    coordinateSpace: 'pdf_points',
    sections: sections.map((name) => ({ name, fields: fields.filter((item) => item.section === name) })),
    fieldCount: fields.length,
    canonical: {
      frameProfile: frame ? canonicalValue(frame.rawValue, frame.id) : null,
      externalFinish: external ? canonicalFinish(external.rawValue, 'outside', external.id) : null,
      internalFinish: internal ? canonicalFinish(internal.rawValue, 'inside', internal.id) : null,
      wallConfiguration: wall ? canonicalValue(wall.rawValue, wall.id) : null,
      frameVeneerCode: frameVeneer ? canonicalValue(frameVeneer.rawValue, frameVeneer.id) : null,
      sashVeneerCode: sashVeneer ? canonicalValue(sashVeneer.rawValue, sashVeneer.id) : null,
      drainage: drainage ? canonicalValue(drainage.rawValue, drainage.id) : null,
      frameDecompression: decompression ? canonicalValue(decompression.rawValue, decompression.id) : null,
      weldType: weld ? canonicalValue(weld.rawValue, weld.id) : null,
      peripheralProfiles: peripheral ? [canonicalValue(peripheral.rawValue.replace(/^Below:\s*/i, ''), peripheral.id, { manufacturerSourceValue: peripheral.rawValue })] : [],
      transoms: transoms.map((item) => canonicalValue(item.rawValue, item.id, { role: item.section })),
      glazing: glazing ? canonicalValue(glazing.rawValue, glazing.id) : null,
      glazingBead: bead ? canonicalValue(bead.rawValue.replace(/QUBE-\s+LINE/i, 'QUBE-LINE'), bead.id, { manufacturerSourceValue: bead.rawValue }) : null,
      sashes,
      glazingUnits,
      thermalUw: thermal ? canonicalValue(thermal.normalizedValue, thermal.id, { manufacturerSourceValue: thermal.rawValue }) : null,
      weightKg: weight ? canonicalValue(weight.normalizedValue, weight.id, { manufacturerSourceValue: weight.rawValue }) : null,
      perimeterMetres: perimeter ? canonicalValue(perimeter.normalizedValue, perimeter.id, { manufacturerSourceValue: perimeter.rawValue }) : null,
      accessories: fields.filter((item) => item.section === 'Accessories' && item.label === 'Accessory').map((item) => ({ description: item.rawValue, quantity: item.quantity, sourceFieldId: item.id })),
      messages: fields.filter((item) => item.section === 'Messages').map((item) => ({ label: item.label, value: item.rawValue, sourceFieldId: item.id })),
      sourcePrice: price ? canonicalValue(price.normalizedValue, price.id, { manufacturerSourceValue: price.rawValue, currency: /£/.test(price.rawValue) ? 'GBP' : null }) : null,
    },
  };
}
