type PhotoBounds = { left: number; top: number; width: number; height: number };

function isWhiteBackground(data: Uint8ClampedArray, pixel: number) {
  const offset = pixel * 4;
  const lightest = Math.max(data[offset], data[offset + 1], data[offset + 2]);
  const darkest = Math.min(data[offset], data[offset + 1], data[offset + 2]);
  return data[offset + 3] <= 16 || (darkest >= 245 && lightest - darkest <= 10);
}

/** Removes a near-white studio backdrop connected to the image border. */
export function trimHotdealBackdrop({ data, width, height }: ImageData): PhotoBounds | null {
  if (width < 16 || height < 16) return null;

  const pixelCount = width * height;
  const backdrop = new Uint8Array(pixelCount);
  const queue = new Uint32Array(pixelCount);
  let tail = 0;

  function visit(pixel: number) {
    if (backdrop[pixel] || !isWhiteBackground(data, pixel)) return;
    backdrop[pixel] = 1;
    queue[tail++] = pixel;
  }

  for (let x = 0; x < width; x++) {
    visit(x);
    visit(pixelCount - width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    visit(y * width);
    visit(y * width + width - 1);
  }

  const perimeter = 2 * (width + height) - 4;
  if (tail < perimeter * 0.7) return null;

  for (let head = 0; head < tail; head++) {
    const pixel = queue[head];
    const x = pixel % width;
    if (x > 0) visit(pixel - 1);
    if (x < width - 1) visit(pixel + 1);
    if (pixel >= width) visit(pixel - width);
    if (pixel < pixelCount - width) visit(pixel + width);
  }

  // Keep real photos and images without a discernible subject as supplied.
  if (tail < pixelCount * 0.14 || tail > pixelCount * 0.93) return null;

  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  for (let pixel = 0; pixel < pixelCount; pixel++) {
    if (backdrop[pixel]) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }

  for (let i = 0; i < tail; i++) data[queue[i] * 4 + 3] = 0;
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}
