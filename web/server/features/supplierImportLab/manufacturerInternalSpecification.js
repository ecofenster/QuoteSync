const text = (value) => String(value ?? '').replace(/\s+/g, ' ').trim() || null;
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const canonicalValue = (canonical, key) => text(record(canonical[key]).value);
const sourceIds = (...values) => values.flatMap((value) => {
  const item = record(value);
  return [item.sourceFieldId, ...(Array.isArray(item.sourceFieldIds) ? item.sourceFieldIds : [])].filter(Boolean);
});

function item(label, value, sources = [], extra = {}) {
  const cleanValue = text(value);
  return cleanValue ? { label, value: cleanValue, sourceFieldIds: [...new Set(sources)], evidenceClass: 'manufacturer_derived', ...extra } : null;
}

function group(id, label, items) {
  const present = items.filter(Boolean);
  return present.length ? { id, label, items: present } : null;
}

/**
 * Build the supplier-neutral, internal-only technical projection from reviewed
 * manufacturer evidence. The complete source specification remains alongside
 * this projection and customer-safe specification remains a separate contract.
 */
export function buildManufacturerInternalSpecification({
  product,
  productSystem,
  widthMm,
  heightMm,
  quantity,
  areaSquareMetres,
  configurationDescription,
  glassSpecification,
  fittingsSpecification,
  manufacturerQuotedUg,
  manufacturerQuotedUw,
  sourceSpecification,
}) {
  const canonical = record(sourceSpecification?.canonical);
  const sashes = Array.isArray(canonical.sashes) ? canonical.sashes.map(record) : [];
  const panes = Array.isArray(canonical.glazingUnits) ? canonical.glazingUnits.map(record) : [];
  const profiles = Array.isArray(canonical.peripheralProfiles) ? canonical.peripheralProfiles.map(record) : [];
  const transoms = Array.isArray(canonical.transoms) ? canonical.transoms.map(record) : [];
  const accessories = Array.isArray(canonical.accessories) ? canonical.accessories.map(record) : [];
  const messages = Array.isArray(canonical.messages) ? canonical.messages.map(record) : [];
  const external = record(canonical.externalFinish);
  const internal = record(canonical.internalFinish);
  const overall = widthMm && heightMm ? `${widthMm} × ${heightMm} mm` : null;
  const groups = [
    group('product', 'Product', [
      item('System', productSystem ?? product),
      item('Frame / profile', canonicalValue(canonical, 'frameProfile'), sourceIds(canonical.frameProfile)),
    ]),
    group('dimensions', 'Dimensions', [
      item('Overall', overall),
      item('Quantity', quantity),
      item('Area', areaSquareMetres ? `${areaSquareMetres} m²` : null),
      item('Weight', canonicalValue(canonical, 'weightKg') ? `${canonicalValue(canonical, 'weightKg')} kg` : null, sourceIds(canonical.weightKg)),
      item('Perimeter', canonicalValue(canonical, 'perimeterMetres') ? `${canonicalValue(canonical, 'perimeterMetres')} m` : null, sourceIds(canonical.perimeterMetres)),
    ]),
    group('opening', 'Opening / configuration', [
      item('Configuration', configurationDescription),
      ...sashes.map((sash, index) => item(
        text(sash.sourceElementReference) ?? `Sash ${index + 1}`,
        [sash.fitting, sash.profile, sash.hardware, sash.security, sash.closing, sash.locking].map(text).filter(Boolean).join(' · '),
        sourceIds(sash),
      )),
    ]),
    group('finishes', 'Finishes', [
      item('Inside', internal.manufacturerSourceValue ?? internal.value, sourceIds(internal), { manufacturerCode: text(internal.manufacturerCode), role: 'inside' }),
      item('Outside', external.manufacturerSourceValue ?? external.value, sourceIds(external), { manufacturerCode: text(external.manufacturerCode), role: 'outside' }),
    ]),
    group('frame_profiles', 'Frame / profiles', [
      item('Frame', canonicalValue(canonical, 'frameProfile'), sourceIds(canonical.frameProfile)),
      item('Wall configuration', canonicalValue(canonical, 'wallConfiguration'), sourceIds(canonical.wallConfiguration)),
      item('Frame veneer', canonicalValue(canonical, 'frameVeneerCode'), sourceIds(canonical.frameVeneerCode)),
      item('Sash veneer', canonicalValue(canonical, 'sashVeneerCode'), sourceIds(canonical.sashVeneerCode)),
      item('Drainage', canonicalValue(canonical, 'drainage'), sourceIds(canonical.drainage)),
      item('Frame decompression', canonicalValue(canonical, 'frameDecompression'), sourceIds(canonical.frameDecompression)),
      item('Weld', canonicalValue(canonical, 'weldType'), sourceIds(canonical.weldType)),
      ...profiles.map((profile, index) => item(`Peripheral profile ${index + 1}`, profile.manufacturerSourceValue ?? profile.value, sourceIds(profile))),
      ...transoms.map((profile, index) => item(text(profile.role) ?? `Transom ${index + 1}`, profile.manufacturerSourceValue ?? profile.value, sourceIds(profile))),
    ]),
    group('glazing', 'Glazing', [
      item('Position glazing', canonicalValue(canonical, 'glazing') ?? glassSpecification, sourceIds(canonical.glazing)),
      item('Glazing bead', canonicalValue(canonical, 'glazingBead'), sourceIds(canonical.glazingBead)),
      ...panes.map((pane, index) => item(
        text(pane.sourceElementReference) ?? `Pane ${index + 1}`,
        [
          pane.glassBuildUp,
          pane.dimensions ? `${pane.dimensions} mm` : null,
          pane.ug ? `Ug ${pane.ug}` : null,
          pane.acousticRw ? `Rw ${pane.acousticRw}` : null,
          pane.thicknessMm ? `${pane.thicknessMm} mm` : null,
          pane.warmEdge,
          pane.solarGainPercent ? `Solar gain ${pane.solarGainPercent}%` : null,
          pane.lightTransmissionPercent ? `Light transmission ${pane.lightTransmissionPercent}%` : null,
        ].map(text).filter(Boolean).join(' · '),
        sourceIds(pane),
      )),
    ]),
    group('hardware', 'Hardware / fittings', [
      item('Summary', fittingsSpecification),
      ...sashes.map((sash, index) => item(
        text(sash.sourceElementReference) ?? `Sash ${index + 1}`,
        [sash.fitting, sash.hardware, sash.security, sash.closing, sash.locking].map(text).filter(Boolean).join(' · '),
        sourceIds(sash),
      )),
    ]),
    group('thermal', 'Thermal', [
      item('Ug', manufacturerQuotedUg),
      item('Uw', manufacturerQuotedUw ?? canonicalValue(canonical, 'thermalUw'), sourceIds(canonical.thermalUw)),
    ]),
    group('accessories', 'Accessories', accessories.map((accessory, index) => item(
      `Accessory ${index + 1}`,
      [accessory.description, accessory.quantity ? `Qty ${accessory.quantity}` : null].map(text).filter(Boolean).join(' · '),
      sourceIds(accessory),
    ))),
    group('manufacturer_notes', 'Manufacturer notes / warnings', messages.map((message, index) => item(
      text(message.label) ?? `Note ${index + 1}`,
      message.value,
      sourceIds(message),
    ))),
  ].filter(Boolean);
  return {
    version: 'manufacturer-internal-position-specification-v1',
    audience: 'internal',
    sourceSpecificationVersion: sourceSpecification?.version ?? null,
    groups,
    itemCount: groups.reduce((count, current) => count + current.items.length, 0),
  };
}
