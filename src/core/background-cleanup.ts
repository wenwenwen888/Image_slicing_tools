import { clamp } from "./geometry";
import type { ImageRegion } from "./types";

export type ForegroundOverlayRegion = ImageRegion & {
  kind: "dialog" | "status";
};

type Component = ImageRegion & {
  area: number;
};

export function detectForegroundOverlays(imageData: ImageData, maxDimension = 640): ForegroundOverlayRegion[] {
  const scale = Math.min(1, maxDimension / Math.max(imageData.width, imageData.height));
  const width = Math.max(1, Math.round(imageData.width * scale));
  const height = Math.max(1, Math.round(imageData.height * scale));
  const mask = buildBrightNeutralMask(imageData, width, height);
  const components = findComponents(mask, width, height);
  const totalArea = width * height;
  const dialog = components
    .filter((component) => {
      const centerX = component.x + component.width / 2;
      const centerY = component.y + component.height / 2;
      const fillRatio = component.area / Math.max(component.width * component.height, 1);
      return (
        component.area >= totalArea * 0.035 &&
        component.width >= width * 0.42 &&
        component.height >= height * 0.2 &&
        centerX >= width * 0.25 &&
        centerX <= width * 0.75 &&
        centerY >= height * 0.25 &&
        fillRatio >= 0.16
      );
    })
    .sort((first, second) => second.area - first.area)[0];

  const statusCandidates = components.filter(
    (component) =>
      component.area >= 2 &&
      component.y + component.height <= height * 0.14 &&
      component.width <= width * 0.3 &&
      component.height <= height * 0.08,
  );
  const mergedStatus = mergeNearbyStatusRegions(statusCandidates, width, height);
  const regions: ForegroundOverlayRegion[] = mergedStatus.map((region) => ({
    ...scaleRegion(expandRegion(region, 3, width, height), scale, imageData.width, imageData.height),
    kind: "status",
  }));

  if (dialog) {
    regions.push({
      ...scaleRegion(expandRegion(dialog, Math.max(6, Math.round(width * 0.018)), width, height), scale, imageData.width, imageData.height),
      kind: "dialog",
    });
  }

  return regions;
}

export function reconstructLargeOverlay(imageData: ImageData, region: ImageRegion) {
  const { data, width, height } = imageData;
  const source = new Uint8ClampedArray(data);
  const left = clamp(Math.round(region.x), 1, width - 2);
  const top = clamp(Math.round(region.y), 0, height - 1);
  const right = clamp(Math.round(region.x + region.width), left + 1, width - 1);
  const bottom = clamp(Math.round(region.y + region.height), top + 1, height);
  const availableLeft = Math.max(1, Math.min(left, Math.round(width * 0.16)));
  const availableRight = Math.max(1, Math.min(width - right, Math.round(width * 0.16)));
  const span = Math.max(right - left - 1, 1);

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const progress = (x - left) / span;
      const leftDepth = smoothStep(Math.min(progress * 2, 1)) * (availableLeft - 1);
      const rightDepth = smoothStep(Math.min((1 - progress) * 2, 1)) * (availableRight - 1);
      const leftPixel = sampleHorizontal(source, width, height, left - 1 - leftDepth, y);
      const rightPixel = sampleHorizontal(source, width, height, right + rightDepth, y);
      const blend = smoothStep(progress);
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        data[offset + channel] = Math.round(leftPixel[channel] * (1 - blend) + rightPixel[channel] * blend);
      }
    }
  }

  return imageData;
}

function sampleHorizontal(data: Uint8ClampedArray, width: number, height: number, x: number, y: number) {
  const safeY = clamp(Math.round(y), 0, height - 1);
  const startX = clamp(Math.floor(x), 0, width - 1);
  const endX = clamp(startX + 1, 0, width - 1);
  const progress = clamp(x - startX, 0, 1);
  const startOffset = (safeY * width + startX) * 4;
  const endOffset = (safeY * width + endX) * 4;
  return [0, 1, 2, 3].map(
    (channel) => data[startOffset + channel] * (1 - progress) + data[endOffset + channel] * progress,
  );
}

function smoothStep(value: number) {
  const normalized = clamp(value, 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function buildBrightNeutralMask(imageData: ImageData, width: number, height: number) {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(Math.floor((y / height) * imageData.height), imageData.height - 1);
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(Math.floor((x / width) * imageData.width), imageData.width - 1);
      const offset = (sourceY * imageData.width + sourceX) * 4;
      const red = imageData.data[offset];
      const green = imageData.data[offset + 1];
      const blue = imageData.data[offset + 2];
      const alpha = imageData.data[offset + 3];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      if (alpha > 180 && luminance >= 195 && maximum - minimum <= 72) {
        mask[y * width + x] = 1;
      }
    }
  }
  return mask;
}

function findComponents(mask: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(mask.length);
  const components: Component[] = [];

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) {
      continue;
    }

    const stack = [start];
    visited[start] = 1;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    while (stack.length > 0) {
      const index = stack.pop()!;
      const x = index % width;
      const y = Math.floor(index / width);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbors = [index - 1, index + 1, index - width, index + width];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= mask.length || visited[neighbor] || !mask[neighbor]) {
          continue;
        }
        const neighborX = neighbor % width;
        if (Math.abs(neighborX - x) > 1) {
          continue;
        }
        visited[neighbor] = 1;
        stack.push(neighbor);
      }
    }

    components.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, area });
  }

  return components;
}

function mergeNearbyStatusRegions(components: Component[], width: number, height: number) {
  const regions = components.map(({ area: _area, ...region }) => region);
  let merged = true;

  while (merged) {
    merged = false;
    outer: for (let firstIndex = 0; firstIndex < regions.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < regions.length; secondIndex += 1) {
        const first = regions[firstIndex];
        const second = regions[secondIndex];
        const horizontalGap = Math.max(first.x, second.x) - Math.min(first.x + first.width, second.x + second.width);
        const verticalOverlap = Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y);
        if (horizontalGap <= width * 0.025 && verticalOverlap >= -height * 0.008) {
          regions[firstIndex] = unionRegions(first, second);
          regions.splice(secondIndex, 1);
          merged = true;
          break outer;
        }
      }
    }
  }

  return regions.filter((region) => region.width * region.height >= 4);
}

function unionRegions(first: ImageRegion, second: ImageRegion): ImageRegion {
  const left = Math.min(first.x, second.x);
  const top = Math.min(first.y, second.y);
  const right = Math.max(first.x + first.width, second.x + second.width);
  const bottom = Math.max(first.y + first.height, second.y + second.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function expandRegion(region: ImageRegion, padding: number, width: number, height: number): ImageRegion {
  const left = clamp(region.x - padding, 0, width - 1);
  const top = clamp(region.y - padding, 0, height - 1);
  const right = clamp(region.x + region.width + padding, left + 1, width);
  const bottom = clamp(region.y + region.height + padding, top + 1, height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function scaleRegion(region: ImageRegion, scale: number, width: number, height: number): ImageRegion {
  const left = clamp(Math.floor(region.x / scale), 0, width - 1);
  const top = clamp(Math.floor(region.y / scale), 0, height - 1);
  const right = clamp(Math.ceil((region.x + region.width) / scale), left + 1, width);
  const bottom = clamp(Math.ceil((region.y + region.height) / scale), top + 1, height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
