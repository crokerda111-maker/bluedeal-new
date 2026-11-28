import assert from "node:assert/strict";
import { test } from "node:test";
import { trimHotdealBackdrop } from "../../src/lib/hotdealBackdrop.ts";

function photo(shadeAt) {
  const width = 32;
  const height = 32;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const shade = shadeAt(x, y);
      data.set([shade, shade, shade, 255], (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

test("white surrounds are transparent while white highlights inside the product stay opaque", () => {
  const image = photo((x, y) => {
    if (x < 8 || x > 23 || y < 5 || y > 26) return 255;
    return x >= 10 && x <= 20 && y >= 9 && y <= 22 ? 255 : 224;
  });

  assert.deepEqual(trimHotdealBackdrop(image), { left: 8, top: 5, width: 16, height: 22 });
  assert.equal(image.data[3], 0);
  assert.equal(image.data[(12 * image.width + 12) * 4 + 3], 255);
});

test("a white corner in a scene does not remove the original photo", () => {
  const image = photo((x, y) => x < 20 && y < 12 ? 255 : 160);
  const original = image.data.slice();
  assert.equal(trimHotdealBackdrop(image), null);
  assert.deepEqual(image.data, original);
});

test("a blank light image does not generate an empty cutout", () => {
  const image = photo(() => 252);
  assert.equal(trimHotdealBackdrop(image), null);
  assert.equal(image.data[3], 255);
});
