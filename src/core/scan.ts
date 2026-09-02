import type { ScanMergeStrategy, ScanMode, SliceRegion } from "./types";

type DetectedRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
};

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
    mergeStrategy = "nearby",
    mergeDistance = 8,
    bridgeGap = 1,
    ignoreText = true,
  }: {
    mode: ScanMode;
    alphaThreshold: number;
    backgroundColor: string;
    colorTolerance: number;
    minArea: number;
    minSize: number;
    padding: number;
    nameOffset: number;
    mergeStrategy?: ScanMergeStrategy;
    mergeDistance?: number;
    bridgeGap?: number;
    ignoreText?: boolean;
  },
) {
  const { width, height } = imageData;
  let foreground: Uint8Array<ArrayBufferLike> = createForegroundMask(imageData, {
    mode,
    alphaThreshold,
    backgroundColor,
    colorTolerance,
  });
  foreground = removeHugeFilledComponents(foreground, width, height, ignoreText);
  foreground = bridgeGap > 0 ? dilateMask(foreground, width, height, bridgeGap) : foreground;
  const visited = new Uint8Array(width * height);
  const regions: DetectedRegion[] = [];

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
        x > 0 && y > 0 ? pixelIndex - width - 1 : -1,
        x < width - 1 && y > 0 ? pixelIndex - width + 1 : -1,
        x > 0 && y < height - 1 ? pixelIndex + width - 1 : -1,
        x < width - 1 && y < height - 1 ? pixelIndex + width + 1 : -1,
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

    const region = {
      x: minX,
      y: minY,
      width: regionWidth,
      height: regionHeight,
      area,
    };

    if (shouldKeepRegion(region, minArea, minSize, ignoreText)) {
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

  if (mode === "auto") {
    regions.push(...findColorfulObjectRegions(imageData, minArea, minSize, padding));
  }

  const candidateRegions = regions.filter((region) => !isTooLargeSceneRegion(region, width, height, ignoreText));
  const mergedRegions = mergeRegions(candidateRegions, mergeStrategy, mergeDistance, width, height).filter(
    (region) => shouldKeepRegion(region, minArea, minSize, ignoreText) && !isTooLargeSceneRegion(region, width, height, ignoreText),
  );

  return mergedRegions
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

function findColorfulObjectRegions(imageData: ImageData, minArea: number, minSize: number, padding: number) {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  const mask = new Uint8Array(totalPixels);

  for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += 1) {
    const dataIndex = pixelIndex * 4;
    if (data[dataIndex + 3] < 180) {
      continue;
    }

    const red = data[dataIndex];
    const green = data[dataIndex + 1];
    const blue = data[dataIndex + 2];
    const maxChannel = Math.max(red, green, blue);
    const minChannel = Math.min(red, green, blue);
    const saturation = maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const chroma = maxChannel - minChannel;

    if (saturation >= 0.42 && chroma >= 64 && luminance >= 72) {
      mask[pixelIndex] = 1;
    }
  }

  const bridged = dilateMask(mask, width, height, 2);
  const visited = new Uint8Array(totalPixels);
  const regions: DetectedRegion[] = [];

  for (let startIndex = 0; startIndex < totalPixels; startIndex += 1) {
    if (!bridged[startIndex] || visited[startIndex]) {
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
      area += mask[pixelIndex] ? 1 : 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbors = [
        x > 0 ? pixelIndex - 1 : -1,
        x < width - 1 ? pixelIndex + 1 : -1,
        y > 0 ? pixelIndex - width : -1,
        y < height - 1 ? pixelIndex + width : -1,
        x > 0 && y > 0 ? pixelIndex - width - 1 : -1,
        x < width - 1 && y > 0 ? pixelIndex - width + 1 : -1,
        x > 0 && y < height - 1 ? pixelIndex + width - 1 : -1,
        x < width - 1 && y < height - 1 ? pixelIndex + width + 1 : -1,
      ];

      for (const neighborIndex of neighbors) {
        if (neighborIndex < 0 || visited[neighborIndex] || !bridged[neighborIndex]) {
          continue;
        }

        visited[neighborIndex] = 1;
        stack.push(neighborIndex);
      }
    }

    const regionWidth = maxX - minX + 1;
    const regionHeight = maxY - minY + 1;
    const dynamicMinArea = Math.max(minArea, Math.round(totalPixels * 0.00018));
    if (area < dynamicMinArea || regionWidth < minSize || regionHeight < minSize) {
      continue;
    }

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

  return mergeRegions(regions, "nearby", Math.max(16, Math.round(Math.min(width, height) * 0.035)), width, height);
}

function shouldKeepRegion(region: DetectedRegion, minArea: number, minSize: number, ignoreText: boolean) {
  if (region.area < minArea || region.width < minSize || region.height < minSize) {
    return false;
  }

  return !ignoreText || !isTextLikeRegion(region);
}

function isTextLikeRegion(region: DetectedRegion) {
  const aspectRatio = Math.max(region.width / region.height, region.height / region.width);
  const fillRatio = region.area / Math.max(region.width * region.height, 1);

  if (region.width >= 18 && region.height <= 28 && region.width / region.height >= 1.8 && fillRatio <= 0.56) {
    return true;
  }

  if (region.width >= 32 && region.width / region.height >= 3.2 && fillRatio <= 0.62) {
    return true;
  }

  if (region.height >= 32 && region.height / region.width >= 3.8 && fillRatio <= 0.5) {
    return true;
  }

  return aspectRatio >= 5.5;
}

function isTooLargeSceneRegion(region: DetectedRegion, imageWidth: number, imageHeight: number, ignoreText: boolean) {
  if (!ignoreText) {
    return false;
  }

  const areaRatio = (region.width * region.height) / Math.max(imageWidth * imageHeight, 1);
  return areaRatio > 0.46 || (region.width > imageWidth * 0.72 && region.height > imageHeight * 0.5);
}

function mergeRegions(
  regions: DetectedRegion[],
  strategy: ScanMergeStrategy,
  mergeDistance: number,
  imageWidth: number,
  imageHeight: number,
) {
  if (strategy === "none" || regions.length <= 1) {
    return regions;
  }

  const distance = Math.max(0, Math.round(mergeDistance));
  const merged = [...regions];
  let changed = true;

  while (changed) {
    changed = false;

    for (let leftIndex = 0; leftIndex < merged.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < merged.length; rightIndex += 1) {
        if (!shouldMergeRegions(merged[leftIndex], merged[rightIndex], strategy, distance)) {
          continue;
        }

        merged[leftIndex] = unionRegions(merged[leftIndex], merged[rightIndex], imageWidth, imageHeight);
        merged.splice(rightIndex, 1);
        changed = true;
        break;
      }

      if (changed) {
        break;
      }
    }
  }

  return merged;
}

function shouldMergeRegions(left: DetectedRegion, right: DetectedRegion, strategy: ScanMergeStrategy, distance: number) {
  if (strategy === "row") {
    const overlapY = Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y);
    const minHeight = Math.min(left.height, right.height);
    const gapX = Math.max(right.x - (left.x + left.width), left.x - (right.x + right.width), 0);
    return overlapY >= minHeight * 0.35 && gapX <= distance;
  }

  return getRegionDistance(left, right) <= distance;
}

function unionRegions(left: DetectedRegion, right: DetectedRegion, imageWidth: number, imageHeight: number): DetectedRegion {
  const minX = Math.max(Math.min(left.x, right.x), 0);
  const minY = Math.max(Math.min(left.y, right.y), 0);
  const maxX = Math.min(Math.max(left.x + left.width, right.x + right.width), imageWidth);
  const maxY = Math.min(Math.max(left.y + left.height, right.y + right.height), imageHeight);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    area: left.area + right.area,
  };
}

function getRegionDistance(left: DetectedRegion, right: DetectedRegion) {
  const gapX = Math.max(right.x - (left.x + left.width), left.x - (right.x + right.width), 0);
  const gapY = Math.max(right.y - (left.y + left.height), left.y - (right.y + right.height), 0);
  return Math.sqrt(gapX * gapX + gapY * gapY);
}

function dilateMask(mask: Uint8Array<ArrayBufferLike>, width: number, height: number, radius: number) {
  const safeRadius = Math.max(0, Math.min(Math.round(radius), 8));
  if (safeRadius === 0) {
    return mask;
  }

  const next = new Uint8Array(mask.length);
  next.set(mask);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      if (!mask[pixelIndex]) {
        continue;
      }

      for (let offsetY = -safeRadius; offsetY <= safeRadius; offsetY += 1) {
        for (let offsetX = -safeRadius; offsetX <= safeRadius; offsetX += 1) {
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX >= 0 && nextY >= 0 && nextX < width && nextY < height) {
            next[nextY * width + nextX] = 1;
          }
        }
      }
    }
  }

  return next;
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
  let foregroundPixels = 0;

  for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += 1) {
    if (!backgroundMask[pixelIndex] && data[pixelIndex * 4 + 3] > alphaThreshold) {
      mask[pixelIndex] = 1;
      foregroundPixels += 1;
    }
  }

  if (mode === "auto" && foregroundPixels > totalPixels * 0.42) {
    return createSalientObjectMask(imageData, alphaThreshold);
  }

  return mask;
}

function createSalientObjectMask(imageData: ImageData, alphaThreshold: number) {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  const mask = new Uint8Array(totalPixels);

  for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += 1) {
    const dataIndex = pixelIndex * 4;
    if (data[dataIndex + 3] <= alphaThreshold) {
      continue;
    }

    const red = data[dataIndex];
    const green = data[dataIndex + 1];
    const blue = data[dataIndex + 2];
    const maxChannel = Math.max(red, green, blue);
    const minChannel = Math.min(red, green, blue);
    const saturation = maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

    if ((saturation >= 0.34 && luminance >= 68) || (saturation >= 0.2 && luminance >= 128 && maxChannel - minChannel >= 40)) {
      mask[pixelIndex] = 1;
    }
  }

  return closeSmallGaps(mask, width, height);
}

function removeHugeFilledComponents(mask: Uint8Array<ArrayBufferLike>, width: number, height: number, ignoreText: boolean) {
  if (!ignoreText) {
    return mask;
  }

  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const next = new Uint8Array(mask);

  for (let startIndex = 0; startIndex < totalPixels; startIndex += 1) {
    if (!mask[startIndex] || visited[startIndex]) {
      continue;
    }

    const stack = [startIndex];
    const component: number[] = [];
    visited[startIndex] = 1;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    while (stack.length > 0) {
      const pixelIndex = stack.pop();
      if (pixelIndex === undefined) {
        continue;
      }

      component.push(pixelIndex);
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
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
        if (neighborIndex < 0 || visited[neighborIndex] || !mask[neighborIndex]) {
          continue;
        }

        visited[neighborIndex] = 1;
        stack.push(neighborIndex);
      }
    }

    const componentWidth = maxX - minX + 1;
    const componentHeight = maxY - minY + 1;
    const fillRatio = component.length / Math.max(componentWidth * componentHeight, 1);
    const coversTooMuch = component.length > totalPixels * 0.22 || componentWidth > width * 0.82 || componentHeight > height * 0.82;

    if (coversTooMuch && fillRatio > 0.38) {
      for (const pixelIndex of component) {
        next[pixelIndex] = 0;
      }
    }
  }

  return next;
}

function closeSmallGaps(mask: Uint8Array<ArrayBufferLike>, width: number, height: number) {
  return erodeMask(dilateMask(mask, width, height, 1), width, height, 1);
}

function erodeMask(mask: Uint8Array<ArrayBufferLike>, width: number, height: number, radius: number) {
  const safeRadius = Math.max(0, Math.min(Math.round(radius), 8));
  if (safeRadius === 0) {
    return mask;
  }

  const next = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      if (!mask[pixelIndex]) {
        continue;
      }

      let keep = true;
      for (let offsetY = -safeRadius; offsetY <= safeRadius && keep; offsetY += 1) {
        for (let offsetX = -safeRadius; offsetX <= safeRadius; offsetX += 1) {
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height || !mask[nextY * width + nextX]) {
            keep = false;
            break;
          }
        }
      }

      if (keep) {
        next[pixelIndex] = 1;
      }
    }
  }

  return next;
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
