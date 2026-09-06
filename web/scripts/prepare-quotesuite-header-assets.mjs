import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const [wordmarkSource, iconSource, outputDirectory] = process.argv.slice(2);
if (!wordmarkSource || !iconSource || !outputDirectory) {
  throw new Error("Usage: node scripts/prepare-quotesuite-header-assets.mjs <transparent-wordmark.png> <transparent-icon.png> <output-directory>");
}

const alphaBounds = (data, width, height) => {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error("The supplied logo contains no visible pixels.");
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
};

async function cropTransparent(source) {
  const image = await loadImage(source);
  const sourceCanvas = createCanvas(image.width, image.height);
  const sourceContext = sourceCanvas.getContext("2d");
  sourceContext.drawImage(image, 0, 0);
  const pixels = sourceContext.getImageData(0, 0, image.width, image.height);
  const bounds = alphaBounds(pixels.data, image.width, image.height);
  const output = createCanvas(bounds.width, bounds.height);
  output.getContext("2d").drawImage(sourceCanvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
  return { output, source: { width: image.width, height: image.height }, bounds };
}

await mkdir(outputDirectory, { recursive: true });
const wordmark = await cropTransparent(wordmarkSource);
await writeFile(path.join(outputDirectory, "quotesuite-titlecase-light-transparent.png"), await wordmark.output.encode("png"));

const darkCanvas = createCanvas(wordmark.output.width, wordmark.output.height);
const darkContext = darkCanvas.getContext("2d");
darkContext.drawImage(wordmark.output, 0, 0);
const darkPixels = darkContext.getImageData(0, 0, darkCanvas.width, darkCanvas.height);
for (let index = 0; index < darkPixels.data.length; index += 4) {
  if (darkPixels.data[index] === 16 && darkPixels.data[index + 1] === 25 && darkPixels.data[index + 2] === 27) {
    darkPixels.data[index] = 255;
    darkPixels.data[index + 1] = 255;
    darkPixels.data[index + 2] = 255;
  }
}
darkContext.putImageData(darkPixels, 0, 0);
await writeFile(path.join(outputDirectory, "quotesuite-titlecase-dark-transparent.png"), await darkCanvas.encode("png"));

const icon = await cropTransparent(iconSource);
await writeFile(path.join(outputDirectory, "quotesuite-icon-circle-transparent.png"), await icon.output.encode("png"));

console.log(JSON.stringify({
  wordmark: { source: wordmark.source, visibleBounds: wordmark.bounds, output: { width: wordmark.output.width, height: wordmark.output.height } },
  icon: { source: icon.source, visibleBounds: icon.bounds, output: { width: icon.output.width, height: icon.output.height } },
  darkVariant: "Only approved #10191B word/tagline pixels changed to white; arc and Suite artwork were retained.",
}, null, 2));
