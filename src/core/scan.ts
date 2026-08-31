import type { ScanMode, SliceRegion } from "./types";

export function findConnectedRegions(
  imageData: ImageData,
  {
    mode,
    alphaThreshold,
    backgroundColor,
    colorTolerance,
    minArea,
    minSize,
    padding,
    nameOffset,
  }: {
    mode: ScanMode;
    alphaThreshold: number;
    backgroundColor: string;
    colorTolerance: number;
    minArea: number;
    minSize: number;
    padding: number;
    nameOffset: number;
  },
) {
  const { width, height } = imageData;
  const foreground = createForegroundMask(imageData, {
    mode,
    alphaThreshold,
    backgroundColor,
    colorTolerance,
  });
  const visited = new Uint8Array(width * height);
  const regions: Array<{ x: number; y: number; width: number; height: number; area: number }> = [];

  for (let startIndex = 0; startIndex < visited.length; startIndex += 1) {
    if (visited[startIndex]) {
      continue;
    }

    if (!foreground[startIndex]) {
      visited[startIndex] = 1;
      continue;
    }

    const stack = [startIndex];
    visited[startIndex] = 1;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    while (stack.length > 0) {
      const pixelIndex = stack.pop();
      if (pixelIndex === undefined) {
        continue;
      }

      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbors = [
        x > 0 ? pixelIndex - 1 : -1,
        x < width - 1 ? pixelIndex + 1 : -1,
        y > 0 ? pixelIndex - width : -1,
        y < height - 1 ? pixelIndex + width : -1,
      ];

      for (const neighborIndex of neighbors) {
        if (neighborIndex < 0 || visited[neighborIndex]) {
          continue;
        }

        visited[neighborIndex] = 1;
        if (foreground[neighborIndex]) {
          stack.push(neighborIndex);
        }
      }
    }

    const regionWidth = maxX - minX + 1;
    const regionHeight = maxY - minY + 1;

    if (area >= minArea && regionWidth >= minSize && regionHeight >= minSize) {
      const paddedX = Math.max(minX - padding, 0);
      const paddedY = Math.max(minY - padding, 0);
      const paddedRight = Math.min(maxX + padding + 1, width);
      const paddedBottom = Math.min(maxY + padding + 1, height);

      regions.push({
        x: paddedX,
        y: paddedY,
        width: paddedRight - paddedX,
        height: paddedBottom - paddedY,
        area,
      });
    }
  }

  return regions
    .sort((left, right) => left.y - right.y || left.x - right.x || right.area - left.area)
    .map((region, index): SliceRegion => ({
      id: crypto.randomUUID(),
      name: `icon_${String(nameOffset + index + 1).padStart(3, "0")}`,
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      enabled: true,
      locked: false,
    }));
}

function createForegroundMask(
  imageData: ImageData,
  {
    mode,
    alphaThreshold,
    backgroundColor,
    colorTolerance,
  }: {
    mode: ScanMode;
    alphaThreshold: number;
    backgroundColor: string;
    colorTolerance: number;
  },
) {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  const mask = new Uint8Array(totalPixels);
  const transparentPixels = countTransparentPixels(data, alphaThreshold);

  if (mode === "alpha" || (mode === "auto" && transparentPixels > 0)) {
    let foregroundPixels = 0;

    for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += 1) {
      if (data[pixelIndex * 4 + 3] > alphaThreshold) {
        mask[pixelIndex] = 1;
        foregroundPixels += 1;
      }
    }

    if (mode === "alpha" && foregroundPixels < totalPixels * 0.86) {
      return mask;
    }

    if (mode === "auto") {
      return mask;
    }
  }

  const background = mode === "color" ? parseHexColor(backgroundColor) : estimateEdgeBackgroundColor(imageData);
  const backgroundMask = createEdgeBackgroundMask(imageData, background, colorTolerance, alphaThreshold);

  for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += 1) {
    if (!backgroundMask[pixelIndex] && data[pixelIndex * 4 + 3] > alphaThreshold) {
      mask[pixelIndex] = 1;
    }
  }

  return mask;
}

function createEdgeBackgroundMask(
  imageData: ImageData,
  background: { r: number; g: number; b: number },
  colorTolerance: number,
  alphaThreshold: number,
) {
  const { data, width, height } = imageData;
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];

  function isBackground(pixelIndex: number) {
    const dataIndex = pixelIndex * 4;
    const alpha = data[dataIndex + 3];

    if (alpha <= alphaThreshold) {
      return true;
    }

    return (
      colorDistance(
        data[dataIndex],
        data[dataIndex + 1],
        data[dataIndex + 2],
        background.r,
        background.g,
        background.b,
      ) <= colorTolerance
    );
  }

  function addSeed(pixelIndex: number) {
    if (!visited[pixelIndex] && isBackground(pixelIndex)) {
      visited[pixelIndex] = 1;
      stack.push(pixelIndex);
    }
  }

  for (let x = 0; x < width; x += 1) {
    addSeed(x);
    addSeed((height - 1) * width + x);
  }

  for (let y = 0; y < height; y += 1) {
    addSeed(y * width);
    addSeed(y * width + width - 1);
  }

  while (stack.length > 0) {
    const pixelIndex = stack.pop();
    if (pixelIndex === undefined) {
      continue;
    }

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    const neighbors = [
      x > 0 ? pixelIndex - 1 : -1,
      x < width - 1 ? pixelIndex + 1 : -1,
      y > 0 ? pixelIndex - width : -1,
      y < height - 1 ? pixelIndex + width : -1,
    ];

    for (const neighborIndex of neighbors) {
      if (neighborIndex < 0 || visited[neighborIndex] || !isBackground(neighborIndex)) {
        continue;
      }

      visited[neighborIndex] = 1;
      stack.push(neighborIndex);
    }
  }

  return visited;
}

function estimateEdgeBackgroundColor(imageData: ImageData) {
  const { data, width, height } = imageData;
  const sampleIndexes = [
    0,
    width - 1,
    (height - 1) * width,
    width * height - 1,
    Math.floor(width / 2),
    (height - 1) * width + Math.floor(width / 2),
    Math.floor(height / 2) * width,
    Math.floor(height / 2) * width + width - 1,
  ];
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (const pixelIndex of sampleIndexes) {
    const dataIndex = pixelIndex * 4;
    if (data[dataIndex + 3] === 0) {
      continue;
    }

    red += data[dataIndex];
    green += data[dataIndex + 1];
    blue += data[dataIndex + 2];
    count += 1;
  }

  if (count === 0) {
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: Math.round(red / count),
    g: Math.round(green / count),
    b: Math.round(blue / count),
  };
}

function countTransparentPixels(data: Uint8ClampedArray, alphaThreshold: number) {
  let count = 0;

  for (let dataIndex = 3; dataIndex < data.length; dataIndex += 4) {
    if (data[dataIndex] <= alphaThreshold) {
      count += 1;
    }
  }

  return count;
}

function parseHexColor(value: string) {
  const normalized = value.replace("#", "");
  const parsed = Number.parseInt(normalized.length === 3 ? normalized.replace(/(.)/g, "$1$1") : normalized, 16);

  if (Number.isNaN(parsed)) {
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) {
  const deltaR = r1 - r2;
  const deltaG = g1 - g2;
  const deltaB = b1 - b2;
  return Math.sqrt(deltaR * deltaR + deltaG * deltaG + deltaB * deltaB);
}
