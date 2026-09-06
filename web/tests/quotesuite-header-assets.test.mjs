import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const asset = (name) => new URL(`../src/assets/brands/quotesuite/${name}`, import.meta.url);

async function inspectPng(url) {
  const image = await loadImage(fileURLToPath(url));
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  const colours = new Map();
  let transparentPixels = 0;
  let left = image.width, top = image.height, right = -1, bottom = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = (y * image.width + x) * 4;
      if (pixels[index + 3] === 0) { transparentPixels += 1; continue; }
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      const key = `${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`;
      colours.set(key, (colours.get(key) || 0) + 1);
    }
  }
  return { width: image.width, height: image.height, transparentPixels, bounds: { left, top, right, bottom }, colours };
}

test("QuoteSuite header wordmarks are tightly cropped transparent approved variants", async () => {
  const light = await inspectPng(asset("quotesuite-titlecase-light-transparent.png"));
  const dark = await inspectPng(asset("quotesuite-titlecase-dark-transparent.png"));
  for (const image of [light, dark]) {
    assert.deepEqual([image.width, image.height], [2493, 724]);
    assert.ok(image.transparentPixels > 0, "header artwork must retain transparency");
    assert.deepEqual(image.bounds, { left: 0, top: 0, right: image.width - 1, bottom: image.height - 1 });
    assert.ok((image.colours.get("132,169,86") || 0) > 100_000, "approved #84A956 artwork must be retained");
  }
  assert.ok((light.colours.get("16,25,27") || 0) > 100_000, "Light must retain approved #10191B Quote/tagline artwork");
  assert.ok((dark.colours.get("255,255,255") || 0) > 100_000, "Dark must use white Quote/tagline artwork");
  assert.equal(dark.colours.get("16,25,27") || 0, 0, "Dark must not retain unreadable #10191B word/tagline pixels");
});

test("header lockup renders the selected company instead of stacking every brand mark", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("../src/components/QuoteSyncLogo.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/layout/AppShell.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /companyLogos\[theme\.brand\]/);
  assert.match(component, /company && companySource \? <>/);
  assert.match(component, /data-company-brand=\{theme\.brand\}/);
  assert.match(component, /quotesuite-titlecase-light-transparent\.png/);
  assert.match(component, /quotesuite-titlecase-dark-transparent\.png/);
  assert.doesNotMatch(component, /quotesuite-titlecase-(?:black|white)\.png/);
  assert.match(css, /\.quotesync-logo\s*\{[\s\S]*display:\s*inline-flex/);
  assert.doesNotMatch(css, /grid-area:\s*1\s*\/\s*1/);
});
