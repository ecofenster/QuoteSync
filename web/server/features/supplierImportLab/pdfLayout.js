const clean = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();

function median(values) {
  const ordered = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!ordered.length) return 0;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function unionBox(items) {
  const left = Math.min(...items.map((item) => item.boundingBox.x));
  const bottom = Math.min(...items.map((item) => item.boundingBox.y));
  const right = Math.max(...items.map((item) => item.boundingBox.x + item.boundingBox.width));
  const top = Math.max(...items.map((item) => item.boundingBox.y + item.boundingBox.height));
  return { x: left, y: bottom, width: Math.max(right - left, 0.01), height: Math.max(top - bottom, 0.01) };
}

function joinRuns(runs) {
  let text = '';
  for (const [index, run] of runs.entries()) {
    const value = clean(run.text);
    if (!value) continue;
    if (!text) { text = value; continue; }
    const previous = runs[index - 1];
    const previousRight = previous.boundingBox.x + previous.boundingBox.width;
    const gap = run.boundingBox.x - previousRight;
    const typicalCharacter = Math.max(previous.fontSize * 0.45, 2);
    const punctuation = /^[,.;:!?%)\]}]/.test(value) || /[(\[{/-]$/.test(text);
    text += gap > typicalCharacter * 0.18 && !punctuation ? ` ${value}` : value;
  }
  return clean(text);
}

export function reconstructPdfPageLayout(content, pageNumber, viewport) {
  const styles = content.styles || {};
  const runs = content.items.flatMap((item, sourceIndex) => {
    if (typeof item.str !== 'string' || !clean(item.str)) return [];
    const fontSize = Math.max(Math.abs(Number(item.transform?.[3])) || Number(item.height) || 0.01, 0.01);
    const fontStyle = styles[item.fontName] || {};
    return [{
      id: `pdf-${pageNumber}-run-${sourceIndex}`,
      text: clean(item.str),
      pageNumber,
      boundingBox: {
        x: Number(item.transform?.[4]) || 0,
        y: Number(item.transform?.[5]) || 0,
        width: Math.max(Number(item.width) || 0.01, 0.01),
        height: Math.max(Number(item.height) || fontSize, 0.01),
      },
      fontName: item.fontName || null,
      fontFamily: fontStyle.fontFamily || null,
      fontSize,
      transform: Array.isArray(item.transform) ? item.transform.map(Number) : null,
      direction: item.dir || null,
      hasEol: Boolean(item.hasEOL),
      sourceIndex,
      sourceType: 'positioned_text_run',
    }];
  });
  const typicalHeight = median(runs.map((run) => run.fontSize)) || 10;
  const tolerance = Math.max(1.4, Math.min(4, typicalHeight * 0.36));
  const lineGroups = [];
  for (const run of [...runs].sort((left, right) => right.boundingBox.y - left.boundingBox.y || left.boundingBox.x - right.boundingBox.x || left.sourceIndex - right.sourceIndex)) {
    const matching = lineGroups.find((group) => Math.abs(group.baseline - run.boundingBox.y) <= tolerance);
    if (matching) {
      matching.runs.push(run);
      matching.baseline = median(matching.runs.map((item) => item.boundingBox.y));
    } else lineGroups.push({ baseline: run.boundingBox.y, runs: [run] });
  }
  const lines = lineGroups
    .sort((left, right) => right.baseline - left.baseline)
    .map((group, readingOrder) => {
      const lineRuns = group.runs.sort((left, right) => left.boundingBox.x - right.boundingBox.x || left.sourceIndex - right.sourceIndex);
      return {
        id: `pdf-${pageNumber}-line-${readingOrder}`,
        text: joinRuns(lineRuns),
        pageNumber,
        boundingBox: unionBox(lineRuns),
        readingOrder,
        sourceType: 'reconstructed_line',
        runIds: lineRuns.map((run) => run.id),
      };
    })
    .filter((line) => line.text);

  const lineHeight = median(lines.map((line) => line.boundingBox.height)) || typicalHeight;
  const regions = [];
  for (const line of lines) {
    const previous = regions.at(-1);
    const previousBottom = previous ? previous.lines.at(-1).boundingBox.y : null;
    const verticalGap = previousBottom == null ? Infinity : previousBottom - (line.boundingBox.y + line.boundingBox.height);
    const overlapsHorizontally = previous && line.boundingBox.x <= previous.boundingBox.x + previous.boundingBox.width + 24
      && previous.boundingBox.x <= line.boundingBox.x + line.boundingBox.width + 24;
    if (previous && verticalGap <= Math.max(12, lineHeight * 1.8) && overlapsHorizontally) {
      previous.lines.push(line);
      previous.boundingBox = unionBox(previous.lines);
      previous.text = previous.lines.map((item) => item.text).join('\n');
    } else regions.push({
      id: `pdf-${pageNumber}-region-${regions.length}`,
      pageNumber,
      text: line.text,
      boundingBox: { ...line.boundingBox },
      readingOrder: regions.length,
      sourceType: 'layout_region',
      lines: [line],
    });
  }
  return {
    pageNumber,
    pageLabel: String(pageNumber),
    width: viewport.width,
    height: viewport.height,
    text: lines.map((line) => line.text).join('\n'),
    blocks: runs.map((run, readingOrder) => ({ ...run, readingOrder })),
    runs,
    lines,
    regions: regions.map(({ lines: regionLines, ...region }) => ({ ...region, lineIds: regionLines.map((line) => line.id) })),
    tables: [],
  };
}

export function pdfReadingOrderBlocks(document) {
  return document.pages.flatMap((page) => (page.lines?.length ? page.lines : page.blocks)
    .map((block) => ({ ...block, pageNumber: page.pageNumber })))
    .filter((block) => clean(block.text));
}
