/** Palette lookup and flood fill on the graphics plane, independent of text/UI. */
export function createGraphics(
  context: CanvasRenderingContext2D,
  colors: readonly string[],
  currentColor: () => number,
) {
  function selectedColor(colorIndex?: number) {
    return colors[((Math.trunc(colorIndex ?? currentColor()) % 8) + 8) % 8];
  }

  function point(pixelX: number, pixelY: number) {
    pixelX = Math.trunc(pixelX);
    pixelY = Math.trunc(pixelY);
    if (pixelX < 0 || pixelX >= 640 || pixelY < 0 || pixelY >= 400) {
      return -1;
    }
    return pixelColor(context.getImageData(pixelX, pixelY, 1, 1).data, 0);
  }
  function pixelColor(data: Uint8ClampedArray, offset: number) {
    if (!data[offset + 3]) {
      return 0;
    }
    let best = 0,
      distance = Infinity;
    colors.forEach((hex, n) => {
      const rgb = [1, 3, 5].map((p) => parseInt(hex.slice(p, p + 2), 16));
      const colorDistance = rgb.reduce(
        (sum, v, k) => sum + (v - data[offset + k]) ** 2,
        0,
      );
      if (colorDistance < distance) {
        distance = colorDistance;
        best = n;
      }
    });
    return best;
  }
  function paint(pixelX: number, pixelY: number, fill: number, border: number) {
    pixelX = Math.trunc(pixelX);
    pixelY = Math.trunc(pixelY);
    if (pixelX < 0 || pixelX >= 640 || pixelY < 0 || pixelY >= 400) {
      return;
    }
    border = ((Math.trunc(border) % 8) + 8) % 8;
    const image = context.getImageData(0, 0, 640, 400),
      data = image.data;
    const rgb = [1, 3, 5].map((p) =>
      parseInt(selectedColor(fill).slice(p, p + 2), 16),
    );
    const seen = new Uint8Array(640 * 400),
      stack = [pixelY * 640 + pixelX];
    seen[stack[0]] = 1;
    while (stack.length) {
      const pixelIndex = stack.pop()!,
        offset = pixelIndex * 4;
      if (pixelColor(data, offset) === border) {
        continue;
      }
      data[offset] = rgb[0];
      data[offset + 1] = rgb[1];
      data[offset + 2] = rgb[2];
      data[offset + 3] = 255;
      const px = pixelIndex % 640;
      for (const next of [
        px ? pixelIndex - 1 : -1,
        px < 639 ? pixelIndex + 1 : -1,
        pixelIndex - 640,
        pixelIndex + 640,
      ]) {
        if (next >= 0 && next < seen.length && !seen[next]) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    context.putImageData(image, 0, 0);
  }
  return { selectedColor, point, paint };
}
