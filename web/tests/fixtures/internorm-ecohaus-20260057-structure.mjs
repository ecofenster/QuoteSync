let id = 0;

function block(text, x = 213, y = 600) {
  id += 1;
  return { id: `ecohaus-fixture-${id}`, text, boundingBox: { x, y: y - id * 0.01, width: Math.max(10, String(text).length * 5), height: 11 } };
}

function page(pageNumber, texts, { rasterImageCount = 0, vectorPathCount = 0 } = {}) {
  return { pageNumber, width: 595.2, height: 841.68, blocks: texts, contentEvidence: { rasterImageCount, vectorPathCount, hasVectorContent: vectorPathCount > 0 } };
}

function systemPage(pageNumber, system, family, values) {
  return page(pageNumber, [
    block('Offer number: 20260057'), block(system), block(family), block('CHARACTERISTICS'),
    ...Object.entries(values).flatMap(([label, value]) => [block(label), ...[].concat(value).map((part) => block(part))]),
    block('●'), block('Deviations to this information are listed in the positions descriptions!'),
  ], { rasterImageCount: 1, vectorPathCount: 8 });
}

function position(reference, quantity, product, unitPrice, totalPrice, width, height, details = []) {
  return [
    block(reference, 54), block(quantity, 139), block('Unit', 168), block(product), block(unitPrice, 445), block(totalPrice, 515),
    ...details, block('Width:'), block(`${width}mm`), block(', Height:'), block(`${height}mm`), block(','),
  ];
}

const defaults = {
  hf: {
    'Construction depth': '85 mm', 'Colour inside': 'Spruce FI501 (FI501)', 'External colour': 'Black grey RAL 7021 matt (HM721)',
    Locking: 'Fully concealed hardware', 'Handle inside': ['Designer handle G80 lockable in F1', '(36400)'], 'Handle outside': 'Long handleplate G80 in F1 (36368)',
    'Heat insulation*': '0.71 W/m²K', 'Sound protection*': '35 dB', Spacer: 'ISO spacer black', Coating: 'Low-Carbon iplus',
    Glazing: 'Triple 48mm coated clear glass 4b/18Ar/4/18Ar/b4 (0.5W/m²K, 34dB, g=53%, 3N2-IL_)',
  },
  kf: {
    'Construction depth': '93 mm', 'Colour inside': 'White (W)', 'External colour': 'Black grey RAL 7021 matt (HM721)',
    Locking: 'Fully concealed hardware', 'Handle inside': ['Designer handle G80 lockable in F1', '(36400)'],
    'Heat insulation*': '0.71 W/m²K', 'Sound protection*': '34 dB', Spacer: 'ISO spacer black', Coating: 'Low-Carbon iplus',
    Glazing: 'Triple 48mm coated clear glass 4b/18Ar/4/18Ar/b4 (0.5W/m²K, 34dB, g=53%, 3N2-IL_)',
  },
  hs: {
    'Construction depth': '209 mm', 'Colour inside': 'Spruce FI501 (FI501)', 'External colour': 'Black grey RAL 7021 matt (HM721)',
    'Handle inside': 'Designer handle Dallas in F1 (36419)', 'Handle outside': ['Recessed handle Dallas, chrome satined', '(36413)'],
    'Heat insulation*': '0.73 W/m²K', 'Sound protection*': '34 dB', Spacer: 'ISO spacer black', Coating: 'Low-Carbon iplus',
    Glazing: 'Triple 54mm coated clear glass 6btoughened/18Ar/6/18Ar/b6toughened (0.5W/m²K, 38dB, g=53%, 3FC-IL_)',
  },
};

export function internormEcohausStructureFixture() {
  id = 0;
  const header = [block('Pos.', 54), block('Quantity', 125), block('Description'), block('Price per unit', 407), block('Total price', 500), block('GBP', 452), block('GBP', 531)];
  const positionPage = (pageNumber, blocks) => page(pageNumber, blocks, { rasterImageCount: 4, vectorPathCount: 50 });
  return {
    attachmentId: 'internorm-ecohaus-structure-fixture',
    mediaType: 'application/pdf',
    textAvailable: true,
    pageCount: 14,
    pages: [
      page(1, [block('ecoHaus SW ltd.'), block('Mr Nick Corlett'), block('Offer number: 20260057'), block('Offer'), block('Date: 04.02.2026')]),
      systemPage(2, 'HF410', 'TIMBER/ALU WINDOW', defaults.hf),
      systemPage(3, 'KF410', 'UPVC/ALUMINIUM WINDOW', defaults.kf),
      systemPage(4, 'HS330', 'TIMBER/ALUMINIUM LIFT-SLIDING DOOR', defaults.hs),
      positionPage(5, [...header,
        ...position('A', '6,00', 'HF410 1-piece sash', '926,90', '5.561,40', 1000, 660, [block('Internorm timber/aluminium window – home pure'), block('Frame system: NR - frame 70mm,'), block('Installation fields:'), block('SF'), block('1st sash'), block('Turn/tilt sash, Opening direction: Right'), block('Accessories hardware: Tilt limiter,')]),
        ...position('A 2', '3,00', 'KF410 1-piece sash', '663,61', '1.990,83', 1000, 660, [block('Internorm UPVC/alu window – home pure'), block('Frame system: NR - frame 76mm,'), block('Installation fields:'), block('SF'), block('Turn/tilt sash, Opening direction: Right')]),
      ]),
      positionPage(6, [
        ...position('B', '2,00', 'HF410 2-piece master sash left', '1.606,79', '3.213,58', 2000, 660, [block('Internorm timber/aluminium window – home pure'), block('Vertical division: 1000/1000,'), block('Frame system: NR - frame 70mm,'), block('Installation fields:'), block('SFG/SFS'), block('Turn/tilt sash, Opening direction: Left'), block('Turn sash, Opening direction: Right')]),
        ...position('B 2', '1,00', 'KF410 2-piece master sash left', '1.284,45', '1.284,45', 2000, 660, [block('Internorm UPVC/alu window – home pure'), block('Vertical division: 1000/1000,'), block('Frame system: NR - frame 76mm,'), block('Installation fields:'), block('SFG/SFS'), block('Turn/tilt sash, Opening direction: Left'), block('Turn sash, Opening direction: Right')]),
      ]),
      positionPage(7, [
        ...position('C', '1,00', 'HF410 1-piece fixed element', '1.066,56', '1.066,56', 2000, 1300, [block('Internorm timber/aluminium window – home pure'), block('Frame system: NR - frame 70mm,'), block('Installation fields:'), block('FIX'), block('1st fixed element')]),
        ...position('D', '2,00', 'HF410 2-piece master sash left', '1.952,63', '3.905,26', 2300, 1000, [block('Internorm timber/aluminium window – home pure'), block('Frame system: NR - frame 70mm,'), block('Installation fields:'), block('SFG/SFS')]),
      ]),
      positionPage(8, [
        ...position('E', '1,00', 'HF410 1-piece fixed element', '1.066,56', '1.066,56', 2600, 1000, [block('Internorm timber/aluminium window – home pure'), block('Frame system: NR - frame 70mm,'), block('Installation fields:'), block('FIX')]),
        ...position('F', '1,00', 'Timber alu lift-sliding door HS330 2 pieces right', '8.450,82', '8.450,82', 2600, 2100, [block('Frame system: Normal frame,'), block('Installation fields:'), block('FIX/IF'), block('Lift-sliding door (HST), Handle side: Right')]),
      ]),
      positionPage(9, [
        ...position('G', '1,00', 'Timber alu lift-sliding door HS330 2 pieces right', '9.142,24', '9.142,24', 2600, 2500, [block('Frame system: Normal frame,'), block('Installation fields:'), block('FIX/IF'), block('Lift-sliding door (HST), Handle side: Right')]),
        ...position('H', '4,00', 'HF410 1-piece fixed element', '1.454,91', '5.819,64', 2900, 1300, [block('Internorm timber/aluminium window – home pure'), block('Frame system: NR - frame 70mm,'), block('Installation fields:'), block('FIX'), block('Glazing: Triple 48mm coated clear glass'), block('6btoughened/16Ar/6toughened/14Ar/b6toughened (0.6W/m²K, 36dB, g=51%)'), block('dB value (EN ISO 717-1): 39 dB'), block('Uw value (EN ISO 12567 / EN ISO 10077): 0.79 W/m²K')]),
      ]),
      positionPage(10, [
        ...position('I', '1,00', 'HF410 1-piece fixed element', '2.535,20', '2.535,20', 2900, 1900, [block('Internorm timber/aluminium window – home pure'), block('Frame system: NR - frame 70mm,'), block('Installation fields:'), block('FIX')]),
        ...position('K', '1,00', 'Timber alu lift-sliding door HS330 2 pieces left', '9.584,79', '9.584,79', 2900, 2500, [block('Frame system: Normal frame,'), block('Installation fields:'), block('IF/FIX'), block('Lift-sliding door (HST), Handle side: Left')]),
      ]),
      positionPage(11, [
        ...position('L', '1,00', 'HF410 1-piece fixed element', '2.830,62', '2.830,62', 4400, 1300, [block('Internorm timber/aluminium window – home pure'), block('Frame system: NR - frame 70mm,'), block('Installation fields:'), block('FIX')]),
        ...position('M.', '1,00', 'Timber alu lift-sliding door HS330 2 pieces right', '17.405,76', '17.405,76', 6900, 2500, [block('Width division on mullion centre: 4547/2353,'), block('Special version: Technical request necessary (TA),'), block('Frame system: Normal frame,'), block('Installation fields:'), block('FIX/IF'), block('Glazing 1: Triple 54mm coated clear glass'), block('44b.2(laminated)/18Ar/6/16Ar/b6toughened (0.5W/m²K, 39dB, g=54%)')]),
      ]),
      positionPage(12, [block('Glazing 2: Triple 54mm coated clear glass'), block('6btoughened/18Ar/6/18Ar/b6toughened (0.5W/m²K, 38dB, g=53%)'), block('IF sash:'), block('Lift-sliding door (HST), Handle side: Right'),
        ...position('N', '4,00', 'HF410 1-piece fixed element', '1.280,40', '5.121,60', 1000, 2200, [block('Internorm timber/aluminium window – home pure'), block('Frame system: NR - frame 70mm,'), block('Installation fields:'), block('FIX')]),
      ]),
      positionPage(13, [
        block('N couplers', 54), block('2,00', 139), block('Unit', 168), block('Timber/wood coupling profile'), block('18,57', 450), block('37,14', 530), block('System: HF410 Internorm timber/alu window - home pure'), block('Length:'), block('1000mm'), block('Colour: Black grey RAL 7021 matt (HM721)'), block('Type of coupling: Coupling profile'),
        ...position('P', '2,00', 'HF410 1-piece door with low threshold', '2.694,05', '5.388,10', 1010, 2440, [block('Internorm timber/aluminium window – home pure'), block('Frame system: NR - frame 70mm, Renovation threshold 35mm'), block('Installation fields:'), block('TIF'), block('1st door sash (low threshold)'), block('X hardware (3D-hinges), Turn door lockable multi-point lock, Opening direction: Right'), block('Cylinder: AZ profile 60/45 keyed to differ'), block('Handle inside: Long handleplate G80 in F1'), block('Glazing: Triple 48mm coated clear glass'), block('4btoughened/18Ar/4/18Ar/b4toughened (0.5W/m²K, 34dB, g=55%)'), block('Accessories hardware: Turn limiter,')]),
      ]),
      page(14, [block('SUPPLY & INSTALL PACKAGE'), block('List Price'), block('£84,404.55'), block('Discount %'), block('20.00'), block('98'), block('m2 of Windows & Doors'), block('£67,523.64'), block('Installation by ecoHaus'), block('£10,939.15'), block('Delivery to Site'), block('£3,145.71'), block('On site Survey or Virtual Survey'), block('£967.71'), block('52'), block('M External Aluminium Cills'), block('£2,245.47'), block('TOTAL EXC VAT'), block('£84,821.69')]),
    ],
    warnings: [],
  };
}
