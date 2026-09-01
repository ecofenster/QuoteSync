let blockId = 0;

function block(text, pageNumber, index) {
  blockId += 1;
  return {
    id: `aspect-fixture-${blockId}`,
    text,
    pageNumber,
    boundingBox: { x: 48 + (index % 2) * 3, y: 790 - index * 16, width: Math.max(18, String(text).length * 4.8), height: 11 },
  };
}

function page(pageNumber, texts, { images = 3, vectors = 20 } = {}) {
  return {
    pageNumber,
    width: 595.2,
    height: 841.68,
    blocks: texts.map((text, index) => block(text, pageNumber, index)),
    contentEvidence: {
      textRunCount: texts.length,
      imageObjectCount: images,
      vectorPathCount: vectors,
      formObjectCount: 0,
      hasText: true,
      hasRasterImages: images > 0,
      hasVectorContent: vectors > 0,
    },
  };
}

const positions = [
  ['1 Utility', 1, 'HF410 1-piece sash', 610, 610, 'SF'],
  ['2 Pantry', 1, 'HF410 1-piece sash', 610, 610, 'SF'],
  ['3 Cinema', 1, 'HF410 1-piece fixed element', 1520, 610, 'FIX'],
  ['4 Gym', 1, 'HF410 1-piece sash', 1220, 610, 'SF'],
  ['5 Snug', 1, 'HF410 1-piece fixed element', 2130, 1220, 'FIX'],
  ['6 Door', 1, 'HF410 1-piece door with low threshold', 1000, 2130, 'TAF'],
  ['6 Side', 1, 'HF410 1-piece fixed element', 1420, 2130, 'FIX'],
  ['7 Living', 1, 'HF410 1-piece fixed element', 2900, 910, 'FIX'],
  ['8 Morning', 1, 'HF410 1-piece fixed element', 2900, 2440, 'FIX'],
  ['9 Door', 1, 'HF410 1-piece door with low threshold', 1000, 2440, 'TAF'],
  ['9 Side', 1, 'HF410 1-piece fixed element', 1720, 2440, 'FIX'],
  ['10 Morning', 2, 'HF410 1-piece fixed element', 1000, 2500, 'FIX'],
  ['11 Kitchen', 1, 'Timber alu lift-sliding door HS330 2 pieces right', 7060, 2440, 'FIX/IF'],
  ['12 Kitchen', 2, 'HF410 1-piece fixed element', 1000, 2500, 'FIX'],
  ['13 Games', 1, 'HF410 1-piece fixed element', 2440, 910, 'FIX'],
  ['14 Games', 1, 'Timber alu lift-sliding door HS330 2 pieces right', 3500, 2440, 'FIX/IF'],
  ['15 Games', 1, 'Timber alu lift-sliding door HS330 2 pieces right', 3500, 2440, 'FIX/IF'],
  ['16 Door', 1, 'HF410 1-piece door with low threshold', 1000, 2440, 'TAF'],
  ['16 Side', 1, 'HF410 1-piece fixed element', 2480, 2440, 'FIX'],
  ['17 Living', 1, 'HF410 1-piece fixed element', 3500, 1370, 'FIX'],
  ['18 Living', 1, 'HF410 1-piece fixed element', 3500, 1370, 'FIX'],
  ['19 Bed 4', 1, 'HF410 2-piece master sash left', 2130, 760, 'SFG/SFS'],
  ['20 Shower', 1, 'HF410 1-piece sash', 1070, 760, 'SF'],
  ['21 Bathroom', 1, 'HF410 1-piece sash', 1070, 760, 'SF'],
  ['22 Bathroom', 1, 'HF410 1-piece sash', 1070, 760, 'SF'],
  ['23 Laundry', 1, 'HF410 1-piece sash', 1070, 760, 'SF'],
  ['24 Ensuite', 1, 'HF410 1-piece sash', 1070, 760, 'SF'],
  ['25 Ensuite', 1, 'HF410 1-piece sash', 610, 760, 'SF'],
  ['26 Dressing', 1, 'HF410 1-piece fixed element', 1220, 760, 'FIX'],
  ['27 Bed 1', 1, 'HF410 1-piece sash', 1220, 760, 'SF'],
  ['28 Bed 1 Door', 1, 'HF410 1-piece door with low threshold', 1000, 2440, 'TAF'],
  ['28 Bed Side 1', 1, 'HF410 1-piece fixed element', 1720, 2440, 'FIX'],
  ['29 Bed 2', 1, 'HF410 2-piece master sash left', 2440, 910, 'SFG/SFS'],
  ['30 Bed 3', 1, 'HF410 2-piece master sash left', 2440, 910, 'SFG/SFS'],
  ['31 Study', 1, 'HF410 1-piece fixed element', 3500, 910, 'FIX'],
];

const splitReferences = new Map([
  ['21 Bathroom', ['21', 'Bathroom']],
  ['22 Bathroom', ['22', 'Bathroom']],
  ['26 Dressing', ['26', 'Dressing']],
  ['28 Bed 1 Door', ['28 Bed 1', 'Door']],
  ['28 Bed Side 1', ['28 Bed', 'Side 1']],
]);
const couplerPages = new Map([[9, '6 Coupler'], [13, '9 Coupler'], [21, '16 Coupler'], [34, '28 Coupler']]);

function systemPage(pageNumber, system, family, depth, glazing) {
  return page(pageNumber, [
    ...(pageNumber === 1 ? ['Aspect Aluminium', 'Unit 25C, Cwmdu Industrial Estate', 'W: www.aspectaluminium.co.uk', 'E: info@aspectaluminium.co.uk'] : []),
    `Page ${pageNumber} of 37`, system, family, 'CHARACTERISTICS', 'Construction depth', `${depth} mm`,
    'Colour inside', 'Wood H9016 (white) opaque (H9016)', 'External colour', 'Anthracite grey RAL 7016 matt (HM716)',
    'Locking', 'Fully concealed hardware', 'Handle inside', 'Designer handle G80 lockable in RAL 9010 (36397)',
    'Spacer', 'ISO spacer black', 'Coating', 'iplus', 'Glazing', glazing,
    'Internorm product characteristics', 'Deviations to this information are listed in the positions descriptions!',
  ], { images: 9, vectors: 31 });
}

function positionPage(position, pageNumber) {
  const [reference, quantity, product, width, height, installationFields] = position;
  const system = product.includes('HS330') ? 'HS330' : 'HF410';
  const referenceBlocks = splitReferences.get(reference) ?? [reference];
  const texts = [`Page ${pageNumber} of 37`];
  if (pageNumber === 3) texts.push('Pos.', 'Quantity', 'Description', '________________________________________________________________');
  texts.push(...referenceBlocks, `${quantity},00`, 'Unit', product);
  if (!product.includes('HS330')) texts.push('Internorm timber/aluminium window – home pure');
  texts.push(product.includes('HS330') ? 'Frame width:' : 'Width:', `${width}mm`, ', Height:', `${height}mm`, ',', 'Frame system: NR - frame 70mm,', 'Installation fields:', installationFields, ',');
  if (/fixed element/i.test(product)) texts.push('1st fixed element');
  else if (/HS330/i.test(product)) texts.push('Fixed element:', 'IF sash:', 'Lift-sliding door (HST), Handle side: Right,');
  else if (/door/i.test(product)) texts.push('1st door sash (low threshold, outward-opening)', 'Turn door lockable multi-point lock, Opening direction from outside: Left,');
  else if (/2-piece/i.test(product)) texts.push('1st master sash', 'Turn/tilt sash, Opening direction: Left,', '2nd slave sash', 'Turn sash, Opening direction: Right,');
  else if (reference === '4 Gym') texts.push('1st sash', 'Exposed hardware, Tilt with drive on side, Handle side: Right,');
  else texts.push('1st sash', 'Turn/tilt sash, Opening direction: Right,');
  texts.push('Glazing: Triple 48mm coated clear glass 4b/18Ar/4/18Ar/b4 (0.5W/m²K, 34dB, 3N2-IS_)', 'Accessories hardware: Tilt limiter,', 'Specification:', 'Connection bead/building connection: 30 mm connection bead PUR hard foam plate (30PU)', 'Extras: Drainage to the front, Element packaged', 'Altitude up to 700 m');
  const coupler = couplerPages.get(pageNumber);
  if (coupler) texts.push(coupler, '1,00', 'Unit', 'Timber/wood coupling profile', `System: ${system} Internorm timber/alu window - home pure`, 'Length:', `${height}mm`, 'Type of coupling: Coupling profile');
  if (pageNumber === 37) texts.push('________________________', 'Internorm Triple Glazed', 'Supply and install in the sum of £91,079.00 Plus Vat', '3 Pane Aluminium Rooflight @ 3200mm x 3200mm', 'Supply and install in the sum of £11.810.00 Plus Vat', 'PLEASE NOTE THAT ALL ITEMS SHOWN ARE VIEWED FROM INSIDE LOOKING OUTWARDS,');
  return page(pageNumber, texts);
}

export function internormAspectStructureFixture() {
  blockId = 0;
  return {
    attachmentId: 'internorm-aspect-6366-safe-fixture',
    sessionId: 'internorm-aspect-readonly',
    mediaType: 'application/pdf',
    extractorName: 'pdfjs-dist',
    extractorVersion: '1.3.0',
    pages: [
      systemPage(1, 'HF410', 'TIMBER/ALU WINDOW', 85, 'Triple 48mm coated clear glass 33b.2(laminated)/18Ar/4/15Ar/b4toughened (0.6W/m²K, 37dB)'),
      systemPage(2, 'HS330', 'TIMBER/ALUMINIUM LIFT-SLIDING DOOR', 209, 'Triple 54mm coated clear glass 44b.2(laminated)/18Ar/6/16Ar/b6toughened (0.5W/m²K, 39dB)'),
      ...positions.map((position, index) => positionPage(position, index + 3)),
    ],
    manufacturerVisualCandidates: [],
    pdfStructure: {
      pageCount: 37,
      imageObjectCount: 125,
      vectorPathCount: 753,
      mixedContentPages: 37,
      runtimeVersion: 'pdfjs_node_native_v2',
      documentMetadata: { title: 'Microsoft Word - 6366 - Internorm Quote Letter', creationDate: "D:20250214132036+00'00'", modificationDate: "D:20250214132036+00'00'", producer: 'Microsoft: Print To PDF' },
      encrypted: false,
      restricted: false,
      permissions: null,
    },
    warnings: [],
    textAvailable: true,
    extractionStatus: 'completed',
  };
}
