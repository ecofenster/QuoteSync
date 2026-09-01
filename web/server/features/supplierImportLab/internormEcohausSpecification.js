const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
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

const slug = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const decimal = (value) => {
  const compact = clean(value).replace(/[\s\u00a0£€$]/g, '');
  if (!/^-?[\d.,]+$/.test(compact)) return null;
  const comma = compact.lastIndexOf(',');
  const dot = compact.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) return comma > dot ? compact.replaceAll('.', '').replace(',', '.') : compact.replaceAll(',', '');
  return comma >= 0 ? compact.replace(',', '.') : compact;
};

const globalLabels = new Set([
  'Construction depth', 'Colour inside', 'External colour', 'Locking', 'Handle inside', 'Handle outside',
  'Heat insulation*', 'Sound protection*', 'Spacer', 'Coating', 'Glazing',
]);

function blocksForLabel(pageBlocks, label) {
  const start = pageBlocks.findIndex((block) => clean(block.text) === label);
  if (start < 0) return [];
  const result = [];
  for (let index = start + 1; index < pageBlocks.length; index += 1) {
    const block = pageBlocks[index];
    const value = clean(block.text);
    if (globalLabels.has(value) || /^●$/.test(value) || /^Deviations to this information/i.test(value)) break;
    result.push(block);
  }
  return result;
}

function field({ section, label, rawValue, blocks, ordinal, evidenceClass = 'explicit', inheritedFromSystem = null }) {
  return {
    id: `${slug(section)}:${slug(label)}:${ordinal}`,
    ordinal,
    section,
    label,
    rawValue: clean(rawValue),
    normalizedValue: null,
    sourcePage: blocks[0]?.pageNumber ?? null,
    boundingRegion: unionBox(blocks),
    coordinateSpace: 'pdf_points',
    evidenceClass,
    confidence: 'strong',
    reviewStatus: 'mapped_automatic',
    ...(inheritedFromSystem ? { inheritedFromSystem } : {}),
  };
}

function finish(value, role, sourceFieldId) {
  const manufacturerCode = value.match(/\(([^()]+)\)\s*$/)?.[1] ?? null;
  return { role, value, manufacturerCode, manufacturerSourceValue: value, sourceFieldId };
}

function canonicalValue(value, sourceFieldId, extra = {}) {
  return value ? { value, manufacturerSourceValue: value, sourceFieldId, ...extra } : null;
}

function glazingEvidence(value, sourceFieldId) {
  const ug = decimal(value.match(/\(([\d,.]+)\s*W\/m(?:²|≤)K/i)?.[1]);
  const acousticRw = clean(value.match(/W\/m(?:²|≤)K,\s*([^,]+dB)/i)?.[1]) || null;
  const solarGainPercent = decimal(value.match(/\bg\s*=\s*([\d,.]+)%/i)?.[1]);
  const thicknessMm = Number(value.match(/\bTriple\s+(\d+)mm/i)?.[1] ?? 0) || null;
  return {
    sourceElementReference: 'position',
    glassBuildUp: value,
    ug,
    acousticRw,
    thicknessMm,
    warmEdge: null,
    solarGainPercent,
    lightTransmissionPercent: null,
    sourceFieldIds: [sourceFieldId].filter(Boolean),
  };
}

function systemFromPage(document, system, productFamily) {
  const page = document.pages.find((candidate) => candidate.blocks.some((block) => clean(block.text) === system));
  if (!page) return null;
  const pageBlocks = page.blocks.map((block) => ({ ...block, text: clean(block.text), pageNumber: page.pageNumber })).filter((block) => block.text);
  const values = {};
  const evidenceBlocks = {};
  for (const label of globalLabels) {
    const blocks = blocksForLabel(pageBlocks, label);
    values[label] = clean(blocks.map((block) => block.text).join(' ')) || null;
    evidenceBlocks[label] = blocks;
  }
  return { system, productFamily, sourcePage: page.pageNumber, values, evidenceBlocks };
}

export function extractInternormEcohausSystemDefaults(document) {
  return new Map([
    ['HF410', systemFromPage(document, 'HF410', 'timber_aluminium_window')],
    ['HF510', systemFromPage(document, 'HF510', 'timber_aluminium_window')],
    ['KF410', systemFromPage(document, 'KF410', 'upvc_aluminium_window')],
    ['HS330', systemFromPage(document, 'HS330', 'timber_aluminium_lift_sliding_door')],
    ['AT510', systemFromPage(document, 'AT510', 'aluminium_entrance_door')],
  ].filter(([, value]) => value));
}

function positionLines(blocks) {
  return blocks.map((block) => clean(block.text)).filter(Boolean);
}

function lineValue(joined, pattern) {
  return clean(joined.match(pattern)?.[1]) || null;
}

function explicitGlazings(lines) {
  const results = [];
  for (let start = 0; start < lines.length; start += 1) {
    const match = lines[start].match(/^(Glazing(?:\s+\d+)?):/i);
    if (!match) continue;
    const selected = [lines[start]];
    for (let index = start + 1; index < lines.length; index += 1) {
      if (/^(?:Glazing(?:\s+\d+)?:|Specification:|Extras:|Accessories hardware:|IF sash:|\d+(?:st|nd|rd|th)\s)/i.test(lines[index])) break;
      selected.push(lines[index]);
    }
    results.push({ label: match[1], value: clean(selected.join(' ')) });
  }
  return results;
}

function sashEvidence(joined, productDescription, installationFields, sourceFieldIds, systemHardware, system, configurationDescription) {
  const installationParts = installationFields?.split('/').filter(Boolean) ?? [];
  const direction = lineValue(joined, /(?:Opening direction(?: from outside)?|Handle side):\s*(Right|Left)/i)
    ?? lineValue(productDescription, /\b(right|left)\s*$/i);
  if ((/\bfixed\b/i.test(productDescription) && installationParts.length <= 1) || installationFields === 'FIX') {
    return [{ sourceElementReference: '1', profile: 'Fixed', fitting: 'Fixed', hardware: null, security: null, closing: 'Fixed', locking: null, sourceFieldIds }];
  }
  if (/\bHS330\b/i.test(productDescription)) {
    const fields = installationFields?.split('/') ?? [];
    return fields.map((value, index) => ({
      sourceElementReference: String(index + 1),
      profile: value === 'FIX' ? 'Fixed' : 'Lift-slide sash',
      fitting: value === 'FIX' ? 'Fixed' : `Lift-slide${direction ? ` ${direction}` : ''}`,
      hardware: value === 'FIX' ? null : systemHardware,
      security: null,
      closing: value === 'FIX' ? 'Fixed' : 'Lift-slide',
      locking: lineValue(joined, /Half cylinder:\s*([^,]+)/i),
      sourceFieldIds,
    }));
  }
  if (/\bdoor\b/i.test(productDescription) || system === 'AT510') {
    const hardware = [lineValue(joined, /(X hardware \([^)]*\))/i), lineValue(joined, /Handle inside:\s*(.+?)(?=\s+Glazing:|\s+Accessories hardware:|\s+Specification:|$)/i)].filter(Boolean).join(' · ');
    return [{
      sourceElementReference: '1', profile: 'Entrance door sash', fitting: configurationDescription || `Turn door${direction ? ` ${direction}` : ''}`,
      hardware: hardware || systemHardware, security: null, closing: /inward/i.test(configurationDescription || '') ? 'Inward-opening' : 'Turn door',
      locking: lineValue(joined, /(lockable multi-point lock)/i), sourceFieldIds,
    }];
  }
  if (installationParts.length > 1 && (!/2-piece/i.test(productDescription) || installationParts.includes('FIX'))) {
    const directions = [...joined.matchAll(/(?:Turn\/tilt sash|Turn sash),?\s*Opening direction:\s*(Right|Left)/gi)].map((match) => match[1]);
    let directionIndex = 0;
    return installationParts.map((value, index) => {
      if (value === 'FIX') return { sourceElementReference: String(index + 1), profile: 'Fixed', fitting: 'Fixed', hardware: null, security: null, closing: 'Fixed', locking: null, sourceFieldIds };
      const sashDirection = directions[directionIndex++] ?? null;
      return { sourceElementReference: String(index + 1), profile: 'Sash', fitting: `Turn/tilt sash${sashDirection ? ` ${sashDirection}` : ''}`, hardware: systemHardware, security: null, closing: 'Turn/tilt', locking: null, sourceFieldIds };
    });
  }
  const masterDirection = lineValue(joined, /Turn\/tilt sash,\s*Opening direction:\s*(Right|Left)/i);
  const slaveDirection = lineValue(joined, /Turn sash,\s*Opening direction:\s*(Right|Left)/i);
  if (/2-piece/i.test(productDescription)) return [
    { sourceElementReference: '1', profile: 'Master sash', fitting: `Turn/tilt sash${masterDirection ? ` ${masterDirection}` : ''}`, hardware: systemHardware, security: null, closing: 'Turn/tilt', locking: null, sourceFieldIds },
    { sourceElementReference: '2', profile: 'Slave sash', fitting: `Turn sash${slaveDirection ? ` ${slaveDirection}` : ''}`, hardware: systemHardware, security: null, closing: 'Turn', locking: null, sourceFieldIds },
  ];
  return [{
    sourceElementReference: '1', profile: 'Sash', fitting: `Turn/tilt sash${direction ? ` ${direction}` : ''}`,
    hardware: systemHardware, security: null, closing: 'Turn/tilt', locking: null, sourceFieldIds,
  }];
}

export function extractInternormEcohausPositionSpecification(document, blocks, position, systemDefaults, { interpretation = 'internorm_ecohaus_complete_quotation_v1', currency = 'GBP' } = {}) {
  const system = systemDefaults.get(position.system);
  if (!system) return null;
  const lines = positionLines(blocks);
  const joined = clean(lines.join(' '));
  const fields = [];
  const add = (section, label, rawValue, sourceBlocks, extra = {}) => {
    if (!clean(rawValue)) return null;
    const item = field({ section, label, rawValue, blocks: sourceBlocks, ordinal: fields.length, ...extra });
    fields.push(item);
    return item;
  };
  const systemFields = {};
  for (const [label, value] of Object.entries(system.values)) {
    if (!value) continue;
    systemFields[label] = add('System defaults', label, value, system.evidenceBlocks[label], { evidenceClass: 'inherited_system_default', inheritedFromSystem: position.system });
  }
  const headerBlocks = blocks.slice(0, Math.min(blocks.length, 8));
  const productField = add('Position', 'Product', position.productDescription, headerBlocks);
  add('Position', 'Description', position.description, blocks.filter((block) => clean(block.text) === position.description));
  const dimensionsField = add('Position', 'Dimensions', `${position.widthMm} × ${position.heightMm} mm`, blocks.filter((block) => /(?:Width|Height|\d+mm)/i.test(block.text)));
  const frameValue = lineValue(joined, /Frame system:\s*(.+?)(?=\s+(?:Encased\b|Installation fields:|\d+(?:st|nd|rd|th)\b|Glazing:|Specification:|Extras:|Offer number:|Page\s+\d+\b))/i);
  const frameField = add('Frame / profiles', 'Frame system', frameValue, blocks.filter((block) => /Frame system:|Normal frame|threshold/i.test(block.text)));
  const divisionFields = lines.filter((line) => /^(?:Vertical division|Width division on mullion centre|Installation counter profile\/sash transom|\d+ vertical division|Transom)/i.test(line))
    .map((value) => add('Frame / profiles', /transom/i.test(value) ? 'Transom' : 'Division', value, blocks.filter((block) => clean(block.text) === value)));
  const installationFields = lineValue(joined, /Installation fields:\s*([A-Z/]+)/i);
  const installationField = add('Opening / configuration', 'Installation fields', installationFields, blocks.filter((block) => /Installation fields:|^(?:FIX|SF|SFG\/SFS|FIX\/IF|IF\/FIX|TIF)$/i.test(clean(block.text))));
  const configurationField = add('Opening / configuration', 'Configuration', position.configurationDescription, blocks.filter((block) => /sash|fixed element|Lift-sliding|Opening direction|Handle side|transom/i.test(block.text)));
  const explicitGlass = explicitGlazings(lines);
  const glazingValues = explicitGlass.length ? explicitGlass : [{ label: 'Glazing', value: system.values.Glazing }];
  const glazingFields = glazingValues.map((item) => add(
    'Glazing', item.label, item.value,
    explicitGlass.length ? blocks.filter((block) => item.value.includes(clean(block.text)) && /Glazing|Ar\/|W\/m²K|g=/i.test(block.text)) : system.evidenceBlocks.Glazing,
    explicitGlass.length ? {} : { evidenceClass: 'inherited_system_default', inheritedFromSystem: position.system },
  ));
  const glazingValue = glazingValues.map((item) => item.value).join(' / ');
  const acousticValue = lineValue(joined, /dB value \(EN ISO 717-1\):\s*([\d,.]+\s*dB)/i) ?? system.values['Sound protection*'];
  const acousticField = add('Performance', 'Acoustic', acousticValue, blocks.filter((block) => /dB value/i.test(block.text)).length ? blocks.filter((block) => /dB value/i.test(block.text)) : system.evidenceBlocks['Sound protection*'], /dB value/i.test(joined) ? {} : { evidenceClass: 'inherited_system_default', inheritedFromSystem: position.system });
  const uwValue = lineValue(joined, /Uw value \([^)]*\):\s*([\d,.]+)/i);
  const uwField = add('Performance', 'Uw', uwValue, blocks.filter((block) => /Uw value/i.test(block.text)));
  const accessoryLines = lines.filter((line) => /^Accessories hardware:|^Connection bead\/building connection:|^Extras:|^Cylinder:|^Handle inside:/i.test(line));
  const accessoryFields = accessoryLines.map((value) => add('Accessories', /^Accessories hardware:/i.test(value) ? 'Hardware accessory' : 'Position detail', value.replace(/^[^:]+:\s*/, ''), blocks.filter((block) => clean(block.text) === value)));
  const messageLines = lines.filter((line) => /Technical request necessary|Altitude up to|Packaging of separate|pre-drilled/i.test(line));
  const messageFields = messageLines.map((value) => add('Manufacturer notes', 'Manufacturer note', value, blocks.filter((block) => clean(block.text) === value)));
  const positionSourceIds = [configurationField?.id, installationField?.id, systemFields.Locking?.id, systemFields['Handle inside']?.id].filter(Boolean);
  const systemHardware = [system.values.Locking, system.values['Handle inside']].filter(Boolean).join(' · ') || null;
  const sashes = sashEvidence(joined, position.productDescription, installationFields, positionSourceIds, systemHardware, position.system, position.configurationDescription);
  const glazingUnits = glazingValues.map((item, index) => {
    const unit = glazingEvidence(item.value, glazingFields[index]?.id);
    unit.sourceElementReference = explicitGlass.length > 1 ? String(index + 1) : 'position';
    unit.warmEdge = system.values.Spacer;
    unit.acousticRw = acousticValue ?? unit.acousticRw;
    if (acousticField?.id) unit.sourceFieldIds.push(acousticField.id);
    return unit;
  });
  const internal = systemFields['Colour inside'];
  const external = systemFields['External colour'];
  const sourcePages = [...new Set(fields.map((item) => item.sourcePage).filter(Number.isInteger))];
  return {
    version: 'manufacturer-source-specification-v1',
    supplierInterpretation: interpretation,
    sourceAttachmentId: document.attachmentId,
    sourcePage: blocks[0]?.pageNumber ?? null,
    sourcePages,
    coordinateSpace: 'pdf_points',
    sections: [...new Set(fields.map((item) => item.section))].map((name) => ({ name, fields: fields.filter((item) => item.section === name) })),
    fieldCount: fields.length,
    inheritance: { system: position.system, sourcePage: system.sourcePage, rule: 'Position-specific evidence overrides system defaults.' },
    canonical: {
      system: canonicalValue(position.system, productField?.id),
      productFamily: canonicalValue(system.productFamily, productField?.id),
      constructionDepthMm: canonicalValue(decimal(system.values['Construction depth']?.match(/[\d,.]+/)?.[0]), systemFields['Construction depth']?.id),
      frameProfile: canonicalValue(frameValue, frameField?.id),
      transoms: divisionFields.filter(Boolean).map((item) => canonicalValue(item.rawValue, item.id, { role: item.label })),
      externalFinish: external ? finish(external.rawValue, 'outside', external.id) : null,
      internalFinish: internal ? finish(internal.rawValue, 'inside', internal.id) : null,
      installationFields: canonicalValue(installationFields, installationField?.id),
      dimensions: canonicalValue(`${position.widthMm} × ${position.heightMm} mm`, dimensionsField?.id),
      glazing: canonicalValue(glazingValue, glazingFields[0]?.id),
      glazingUnits,
      spacer: canonicalValue(system.values.Spacer, systemFields.Spacer?.id),
      coating: canonicalValue(system.values.Coating, systemFields.Coating?.id),
      sashes,
      thermalUw: canonicalValue(uwValue, uwField?.id),
      systemThermalPerformance: canonicalValue(decimal(system.values['Heat insulation*']?.match(/[\d,.]+/)?.[0]), systemFields['Heat insulation*']?.id, { basis: 'system standard test window' }),
      accessories: accessoryFields.filter(Boolean).map((item) => ({ description: item.rawValue, customerFacing: /^Hardware accessory$/i.test(item.label), sourceFieldId: item.id })),
      messages: messageFields.filter(Boolean).map((item) => ({ label: item.label, value: item.rawValue, sourceFieldId: item.id })),
      sourcePrice: canonicalValue(position.totalPrice, productField?.id, { currency }),
    },
  };
}

export { decimal as parseInternormEuropeanDecimal };
