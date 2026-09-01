const box = (index) => ({ x: 36 + (index % 3) * 8, y: 790 - index * 9, width: 260, height: 8 });

function page(pageNumber, values) {
  return {
    pageNumber, width: 595.2, height: 841.68,
    blocks: values.map((text, index) => ({ id: `gw-${pageNumber}-${index}`, text, pageNumber, boundingBox: box(index) })),
    contentEvidence: { textRunCount: values.length, imageObjectCount: pageNumber >= 5 ? 4 : 2, vectorPathCount: pageNumber >= 5 ? 48 : 20, hasText: true, hasRasterImages: true, hasVectorContent: true },
  };
}

const systemPage = (pageNumber, system, family, inside, outside, glazing) => page(pageNumber, [
  system, family, 'CHARACTERISTICS', 'Construction depth', system === 'HS330' ? '209 mm' : system === 'AT510' ? '93 mm' : '85 mm',
  'Colour inside', inside, 'External colour', outside, 'Locking', system === 'AT510' ? 'Multi-point lock' : 'Fully concealed hardware',
  'Handle inside', 'Designer handle G80', 'Handle outside', system === 'HS330' ? 'Recessed handle Dallas' : 'Bar handle',
  'Heat insulation*', '0.83 W/m²K', 'Sound protection*', '39 dB', 'Spacer', 'ISO spacer black', 'Coating', 'Low-Carbon iplus', 'Glazing', glazing,
]);

export function internormGlassWorxStructureFixture() {
  const pages = [
    page(1, ['Glass Worx Limited', 'Offer number: 20250172', '10.07.2025', '25 - 116 - Owain Parry - Schedule', 'Pos.', 'Quantity', 'Description', 'Internorm']),
    systemPage(2, 'HF510', 'TIMBER/ALU WINDOW', 'Wood H9016 (white) opaque (H9016)', 'Anthracite grey RAL 7016 matt (HM716)', 'Triple 48mm coated clear glass 6btoughened/16Ar/6toughened/14Ar/b6toughened (0.6W/m²K, 36dB, g=54%)'),
    systemPage(3, 'AT510', 'ALUMINIUM ENTRANCE DOOR', 'Traffic white RAL 9016 matt (M916)', 'Anthracite grey RAL 7016 matt (HM716)', 'Triple 48mm coated obscured glass 4#toughened/18Ar/b4toughened/16Ar/b33.2# (0.6W/m²K, 37dB)'),
    systemPage(4, 'HS330', 'TIMBER/ALUMINIUM LIFT-SLIDING DOOR', 'Wood H9016 (white) opaque (H9016)', 'Anthracite grey RAL 7016 matt (HM716)', 'Triple 48mm coated clear glass 6btoughened/16Ar/6toughened/14Ar/b6toughened (0.6W/m²K, 36dB, g=54%)'),
    systemPage(5, 'HF410', 'TIMBER/ALU WINDOW', 'Wood H9016 (white) opaque (H9016)', 'Anthracite grey RAL 7016 matt (HM716)', 'Triple 48mm coated clear glass 6btoughened/16Ar/6toughened/14Ar/b6toughened (0.6W/m²K, 36dB, g=54%)'),
    page(6, ['100', '1,00', 'Unit', 'GF-W-W1:', 'HF510 1-piece fixed element', 'Internorm timber/aluminium window – home pure', 'Width:', '3000mm', 'Height:', '420mm', 'Installation fields:', 'FIX', '1st fixed element', 'Specification:', 'Connection bead/building connection: 30 mm connection bead',
      '110', '1,00', 'Unit', 'GF-W-D1-B:', 'AT510 3-part internal sash middle', 'Element width: 3000mm, Element height: 2200mm', 'Installation for sash:', 'Inward-opening, Opening direction: DIN left', 'Glazing: Triple 48mm coated obscured glass 4#toughened/18Ar/b4toughened/16Ar/b33.2# (0.6W/m²K, 37dB)',
      '120', '1,00', 'Unit', 'GW-S-D2:', 'Timber alu lift-sliding door HS330 2 pieces left', 'Frame width:', '3100mm', 'Frame height:', '2100mm', 'Installation fields:', 'IF/FIX', 'IF sash:', 'Lift-sliding door (HST), Handle side: Left',
      '130', '1,00', 'Unit', 'GF-N-D5:', 'HF410 1-piece door with low threshold', 'Internorm timber/aluminium window – home pure', 'Width:', '900mm', 'Height:', '2100mm', 'Installation fields:', 'TIF', 'Turn door lockable multi-point lock, Opening direction: Right']),
  ];
  return { attachmentId: 'glass-worx-safe-fixture', sourceSha256: 'f'.repeat(64), mediaType: 'application/pdf', textAvailable: true, pages, pdfStructure: { pageCount: pages.length, textRunCount: pages.reduce((sum, item) => sum + item.blocks.length, 0), imageObjectCount: 24, vectorPathCount: 220, mixedContentPages: pages.length, runtimeVersion: 'pdfjs_node_native_v2' }, warnings: [] };
}
