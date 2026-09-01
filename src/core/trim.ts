export type PixelBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function findOpaqueBounds(imageData: ImageData, alphaThreshold: number): PixelBounds | null {
  const { data, width, height } = imageData;
  const threshold = Math.max(0, Math.min(Math.round(alphaThreshold), 255));
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= threshold) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}
