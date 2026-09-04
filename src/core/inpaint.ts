import { clamp } from "./geometry";
import type { ImageRegion } from "./types";

type Pixel = [number, number, number, number];

type SurfaceSample = {
  basis: number[];
  pixel: Pixel;
};

const BASIS_SIZE = 6;
export type InpaintDirection = "auto" | "horizontal" | "vertical";

export function inpaintRegion(imageData: ImageData, region: ImageRegion, sampleRadius = 6, direction: InpaintDirection = "auto") {
  const { width, height, data } = imageData;
  const left = clamp(Math.round(region.x), 0, width - 1);
  const top = clamp(Math.round(region.y), 0, height - 1);
  const right = clamp(Math.round(region.x + region.width), left + 1, width);
  const bottom = clamp(Math.round(region.y + region.height), top + 1, height);
  const radius = Math.max(2, Math.round(sampleRadius));
  const centerX = (left + right - 1) / 2;
  const centerY = (top + bottom - 1) / 2;
  const scaleX = Math.max((right - left) / 2, 1);
  const scaleY = Math.max((bottom - top) / 2, 1);
  const samples = collectRingSamples(data, width, height, left, top, right, bottom, radius, centerX, centerY, scaleX, scaleY);
  const surface = fitRobustSurface(samples);

  if (!surface) {
    return fillWithBoundaryInterpolation(imageData, { x: left, y: top, width: right - left, height: bottom - top });
  }

  const horizontalBoundaries =
    direction === "vertical"
      ? null
      : Array.from({ length: bottom - top }, (_, row) => {
          const y = top + row;
          return [
            sampleMedianBlock(data, width, height, left - radius, y - 1, radius, 3),
            sampleMedianBlock(data, width, height, right, y - 1, radius, 3),
          ] as [Pixel, Pixel];
        });
  const verticalBoundaries =
    direction === "horizontal"
      ? null
      : Array.from({ length: right - left }, (_, column) => {
          const x = left + column;
          return [
            sampleMedianBlock(data, width, height, x - 1, top - radius, 3, radius),
            sampleMedianBlock(data, width, height, x - 1, bottom, 3, radius),
          ] as [Pixel, Pixel];
        });
  const detailedDirection = chooseDetailedDirection(horizontalBoundaries, verticalBoundaries);

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const basis = createBasis(x, y, centerX, centerY, scaleX, scaleY);
      const offset = (y * width + x) * 4;
      const surfacePixel = predictPixel(surface, basis);
      const horizontalPixel = horizontalBoundaries
        ? mix(horizontalBoundaries[y - top][0], horizontalBoundaries[y - top][1], (x - left + 0.5) / Math.max(right - left, 1))
        : surfacePixel;
      const verticalPixel = verticalBoundaries
        ? mix(verticalBoundaries[x - left][0], verticalBoundaries[x - left][1], (y - top + 0.5) / Math.max(bottom - top, 1))
        : surfacePixel;
      const outputPixel = blendBackgroundEstimates(surfacePixel, horizontalPixel, verticalPixel, direction, detailedDirection);
      for (let channel = 0; channel < 4; channel += 1) {
        data[offset + channel] = clamp(Math.round(outputPixel[channel]), 0, 255);
      }
    }
  }

  return imageData;
}

function sampleMedianBlock(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  x: number,
  y: number,
  blockWidth: number,
  blockHeight: number,
): Pixel {
  const channels = Array.from({ length: 4 }, () => [] as number[]);
  const startX = clamp(Math.round(x), 0, imageWidth - 1);
  const startY = clamp(Math.round(y), 0, imageHeight - 1);
  const endX = clamp(Math.round(x + blockWidth), startX + 1, imageWidth);
  const endY = clamp(Math.round(y + blockHeight), startY + 1, imageHeight);

  for (let sampleY = startY; sampleY < endY; sampleY += 1) {
    for (let sampleX = startX; sampleX < endX; sampleX += 1) {
      const offset = (sampleY * imageWidth + sampleX) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        channels[channel].push(data[offset + channel]);
      }
    }
  }

  return channels.map((values) => median(values)) as Pixel;
}

function blendBackgroundEstimates(
  surface: Pixel,
  horizontal: Pixel,
  vertical: Pixel,
  direction: InpaintDirection,
  detailedDirection: InpaintDirection,
): Pixel {
  if (direction === "horizontal") {
    return weightedPixel([horizontal, surface], [0.82, 0.18]);
  }
  if (direction === "vertical") {
    return weightedPixel([vertical, surface], [0.82, 0.18]);
  }
  if (detailedDirection === "horizontal") {
    return weightedPixel([horizontal, surface], [0.95, 0.05]);
  }
  if (detailedDirection === "vertical") {
    return weightedPixel([vertical, surface], [0.95, 0.05]);
  }

  const directionalDistance = colorDistance(horizontal, vertical);
  if (directionalDistance <= 28) {
    return weightedPixel([horizontal, vertical, surface], [0.43, 0.43, 0.14]);
  }

  const horizontalWeight = 1 / (1 + (colorDistance(horizontal, surface) / 30) ** 2);
  const verticalWeight = 1 / (1 + (colorDistance(vertical, surface) / 30) ** 2);
  return weightedPixel([horizontal, vertical, surface], [horizontalWeight, verticalWeight, 0.35]);
}

function chooseDetailedDirection(
  horizontalBoundaries: [Pixel, Pixel][] | null,
  verticalBoundaries: [Pixel, Pixel][] | null,
): InpaintDirection {
  const horizontalVariation = boundaryVariation(horizontalBoundaries);
  const verticalVariation = boundaryVariation(verticalBoundaries);
  if (horizontalVariation > verticalVariation * 1.6 + 3) {
    return "horizontal";
  }
  if (verticalVariation > horizontalVariation * 1.6 + 3) {
    return "vertical";
  }
  return "auto";
}

function boundaryVariation(boundaries: [Pixel, Pixel][] | null) {
  if (!boundaries || boundaries.length < 2) {
    return 0;
  }

  let total = 0;
  for (let index = 1; index < boundaries.length; index += 1) {
    total += colorDistance(boundaries[index - 1][0], boundaries[index][0]);
    total += colorDistance(boundaries[index - 1][1], boundaries[index][1]);
  }
  return total / ((boundaries.length - 1) * 2);
}

function weightedPixel(pixels: Pixel[], weights: number[]): Pixel {
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  return [0, 1, 2, 3].map((channel) =>
    pixels.reduce((total, pixel, index) => total + pixel[channel] * weights[index], 0) / totalWeight,
  ) as Pixel;
}

function collectRingSamples(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  radius: number,
  centerX: number,
  centerY: number,
  scaleX: number,
  scaleY: number,
) {
  const samples: SurfaceSample[] = [];
  const outerLeft = Math.max(0, left - radius);
  const outerTop = Math.max(0, top - radius);
  const outerRight = Math.min(imageWidth, right + radius);
  const outerBottom = Math.min(imageHeight, bottom + radius);

  for (let y = outerTop; y < outerBottom; y += 1) {
    for (let x = outerLeft; x < outerRight; x += 1) {
      if (x >= left && x < right && y >= top && y < bottom) {
        continue;
      }

      const offset = (y * imageWidth + x) * 4;
      samples.push({
        basis: createBasis(x, y, centerX, centerY, scaleX, scaleY),
        pixel: [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]],
      });
    }
  }

  return samples;
}

function createBasis(x: number, y: number, centerX: number, centerY: number, scaleX: number, scaleY: number) {
  const normalizedX = (x - centerX) / scaleX;
  const normalizedY = (y - centerY) / scaleY;
  return [1, normalizedX, normalizedY, normalizedX * normalizedY, normalizedX * normalizedX, normalizedY * normalizedY];
}

function fitRobustSurface(samples: SurfaceSample[]): number[][] | null {
  if (samples.length < BASIS_SIZE * 2) {
    return null;
  }

  const initial = fitSurface(samples);
  if (!initial) {
    return null;
  }

  const residuals = samples.map((sample) => colorDistance(sample.pixel, predictPixel(initial, sample.basis)));
  const medianResidual = median(residuals);
  const deviation = median(residuals.map((residual) => Math.abs(residual - medianResidual)));
  const threshold = medianResidual + Math.max(8, deviation * 3.5);
  const filtered = samples.filter((_sample, index) => residuals[index] <= threshold);

  if (filtered.length < BASIS_SIZE * 2 || filtered.length === samples.length) {
    return initial;
  }

  return fitSurface(filtered) ?? initial;
}

function fitSurface(samples: SurfaceSample[]) {
  const normalMatrix = Array.from({ length: BASIS_SIZE }, () => Array(BASIS_SIZE).fill(0));
  const channelVectors = Array.from({ length: 4 }, () => Array(BASIS_SIZE).fill(0));

  for (const sample of samples) {
    for (let row = 0; row < BASIS_SIZE; row += 1) {
      for (let column = 0; column < BASIS_SIZE; column += 1) {
        normalMatrix[row][column] += sample.basis[row] * sample.basis[column];
      }
      for (let channel = 0; channel < 4; channel += 1) {
        channelVectors[channel][row] += sample.basis[row] * sample.pixel[channel];
      }
    }
  }

  for (let diagonal = 0; diagonal < BASIS_SIZE; diagonal += 1) {
    normalMatrix[diagonal][diagonal] += 1e-6;
  }

  const coefficients = channelVectors.map((vector) => solveLinearSystem(normalMatrix, vector));
  return coefficients.every((channel) => channel !== null) ? (coefficients as number[][]) : null;
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivot = 0; pivot < size; pivot += 1) {
    let bestRow = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[bestRow][pivot])) {
        bestRow = row;
      }
    }

    if (Math.abs(augmented[bestRow][pivot]) < 1e-10) {
      return null;
    }

    [augmented[pivot], augmented[bestRow]] = [augmented[bestRow], augmented[pivot]];
    const pivotValue = augmented[pivot][pivot];
    for (let column = pivot; column <= size; column += 1) {
      augmented[pivot][column] /= pivotValue;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) {
        continue;
      }
      const factor = augmented[row][pivot];
      for (let column = pivot; column <= size; column += 1) {
        augmented[row][column] -= factor * augmented[pivot][column];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function predictPixel(surface: number[][], basis: number[]): Pixel {
  return surface.map((channel) => dot(channel, basis)) as Pixel;
}

function dot(values: number[], basis: number[]) {
  return values.reduce((total, value, index) => total + value * basis[index], 0);
}

function colorDistance(first: Pixel, second: Pixel) {
  return Math.sqrt(
    (first[0] - second[0]) ** 2 +
      (first[1] - second[1]) ** 2 +
      (first[2] - second[2]) ** 2 +
      (first[3] - second[3]) ** 2,
  );
}

function median(values: number[]) {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function fillWithBoundaryInterpolation(imageData: ImageData, region: ImageRegion) {
  const { width, height, data } = imageData;
  const left = region.x;
  const top = region.y;
  const right = region.x + region.width;
  const bottom = region.y + region.height;

  for (let y = top; y < bottom; y += 1) {
    const verticalProgress = (y - top + 0.5) / Math.max(region.height, 1);
    const leftPixel = readPixel(data, width, height, left - 1, y);
    const rightPixel = readPixel(data, width, height, right, y);
    for (let x = left; x < right; x += 1) {
      const horizontalProgress = (x - left + 0.5) / Math.max(region.width, 1);
      const topPixel = readPixel(data, width, height, x, top - 1);
      const bottomPixel = readPixel(data, width, height, x, bottom);
      const horizontal = mix(leftPixel, rightPixel, horizontalProgress);
      const vertical = mix(topPixel, bottomPixel, verticalProgress);
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        data[offset + channel] = Math.round((horizontal[channel] + vertical[channel]) / 2);
      }
    }
  }

  return imageData;
}

function readPixel(data: Uint8ClampedArray, width: number, height: number, x: number, y: number): Pixel {
  const safeX = clamp(x, 0, width - 1);
  const safeY = clamp(y, 0, height - 1);
  const offset = (safeY * width + safeX) * 4;
  return [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
}

function mix(start: Pixel, end: Pixel, progress: number): Pixel {
  return start.map((value, channel) => value + (end[channel] - value) * progress) as Pixel;
}
