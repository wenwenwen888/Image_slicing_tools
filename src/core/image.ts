import { MAX_ZOOM, MIN_ZOOM } from "./constants";
import { clamp } from "./geometry";
import type { ExportFormat, SliceRegion } from "./types";

export type TransparentBackgroundOptions = {
  color: string;
  tolerance: number;
};

export function calculateFitZoom(imageWidth: number, imageHeight: number) {
  const panel = document.querySelector(".canvas-panel");

  if (!(panel instanceof HTMLElement)) {
    return 1;
  }

  const rect = panel.getBoundingClientRect();
  const availableWidth = Math.max(rect.width - 80, 1);
  const availableHeight = Math.max(rect.height - 80, 1);
  return clamp(Math.min(availableWidth / imageWidth, availableHeight / imageHeight, 1), MIN_ZOOM, MAX_ZOOM);
}

export async function detectAlphaChannel(bitmap: ImageBitmap) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(bitmap.width, 512);
  canvas.height = Math.min(bitmap.height, 512);

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return false;
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 255) {
      return true;
    }
  }

  return false;
}

export async function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed"));
    image.src = url;
  });
}

export function getMimeType(format: ExportFormat) {
  if (format === "jpg") {
    return "image/jpeg";
  }

  return `image/${format}`;
}

export async function renderSlice(
  image: HTMLImageElement,
  slice: SliceRegion,
  format: ExportFormat,
  jpgBackground: string,
  outputSize?: { width: number; height: number },
  transparentBackground?: TransparentBackgroundOptions | null,
) {
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = slice.width;
  sourceCanvas.height = slice.height;

  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: Boolean(transparentBackground) });
  if (!sourceContext) {
    throw new Error("Canvas is unavailable");
  }

  if (format === "jpg") {
    sourceContext.fillStyle = jpgBackground;
    sourceContext.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  }

  const didClip = applySliceClip(sourceContext, slice, sourceCanvas.width, sourceCanvas.height);
  sourceContext.drawImage(
    image,
    slice.x,
    slice.y,
    slice.width,
    slice.height,
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
  );
  if (didClip) {
    sourceContext.restore();
  }

  if (format !== "jpg" && transparentBackground) {
    eraseBackgroundPixels(sourceContext, sourceCanvas.width, sourceCanvas.height, transparentBackground);
  }

  const outputWidth = outputSize?.width ?? sourceCanvas.width;
  const outputHeight = outputSize?.height ?? sourceCanvas.height;
  if (outputWidth === sourceCanvas.width && outputHeight === sourceCanvas.height) {
    return canvasToBlob(sourceCanvas, getMimeType(format), format === "jpg" ? 0.92 : undefined);
  }

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) {
    throw new Error("Canvas is unavailable");
  }

  if (format === "jpg") {
    outputContext.fillStyle = jpgBackground;
    outputContext.fillRect(0, 0, outputWidth, outputHeight);
  }
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";
  outputContext.drawImage(sourceCanvas, 0, 0, outputWidth, outputHeight);

  return canvasToBlob(outputCanvas, getMimeType(format), format === "jpg" ? 0.92 : undefined);
}

function eraseBackgroundPixels(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: TransparentBackgroundOptions,
) {
  const imageData = context.getImageData(0, 0, width, height);
  removeBackgroundPixels(imageData.data, width, height, options);
  context.putImageData(imageData, 0, 0);
}

export function removeBackgroundPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  options: TransparentBackgroundOptions,
) {
  const selectedTarget = parseHexColor(options.color);
  const edgeTarget = estimateCanvasEdgeColor({ data: pixels, width, height });
  const target =
    selectedTarget && colorDistance(selectedTarget, edgeTarget) <= Math.max(options.tolerance * 2.4, 36)
      ? selectedTarget
      : edgeTarget;
  const tolerance = Math.max(0, Math.min(options.tolerance, 255));
  const hardTolerance = Math.max(tolerance, 18);
  const featherDistance = Math.max(72, tolerance * 3.5);
  const removed = new Uint8Array(width * height);
  const stack: number[] = [];

  function isBackground(pixelIndex: number) {
    const dataIndex = pixelIndex * 4;
    if (pixels[dataIndex + 3] === 0) {
      return true;
    }

    return getPixelDistance(pixels, dataIndex, target) <= hardTolerance;
  }

  function addSeed(pixelIndex: number) {
    if (!removed[pixelIndex] && isBackground(pixelIndex)) {
      removed[pixelIndex] = 1;
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
      if (neighborIndex < 0 || removed[neighborIndex] || !isBackground(neighborIndex)) {
        continue;
      }

      removed[neighborIndex] = 1;
      stack.push(neighborIndex);
    }
  }

  if (isLikelyTextForeground(pixels, width, height, target, hardTolerance)) {
    markEnclosedBackground(pixels, width, height, target, hardTolerance, removed);
  }

  featherRemovedBackground(pixels, width, height, target, hardTolerance, featherDistance, removed);
}

function markEnclosedBackground(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  target: { r: number; g: number; b: number },
  hardTolerance: number,
  removed: Uint8Array,
) {
  const visited = new Uint8Array(width * height);
  const totalPixels = width * height;

  for (let startIndex = 0; startIndex < totalPixels; startIndex += 1) {
    if (removed[startIndex] || visited[startIndex] || !isBackgroundPixel(pixels, startIndex, target, hardTolerance)) {
      continue;
    }

    const component: number[] = [];
    const stack = [startIndex];
    visited[startIndex] = 1;
    let touchesEdge = false;

    while (stack.length > 0) {
      const pixelIndex = stack.pop();
      if (pixelIndex === undefined) {
        continue;
      }

      component.push(pixelIndex);
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      touchesEdge ||= x === 0 || y === 0 || x === width - 1 || y === height - 1;

      const neighbors = [
        x > 0 ? pixelIndex - 1 : -1,
        x < width - 1 ? pixelIndex + 1 : -1,
        y > 0 ? pixelIndex - width : -1,
        y < height - 1 ? pixelIndex + width : -1,
      ];
      for (const neighbor of neighbors) {
        if (
          neighbor < 0 ||
          removed[neighbor] ||
          visited[neighbor] ||
          !isBackgroundPixel(pixels, neighbor, target, hardTolerance)
        ) {
          continue;
        }
        visited[neighbor] = 1;
        stack.push(neighbor);
      }
    }

    if (!touchesEdge) {
      for (const pixelIndex of component) {
        removed[pixelIndex] = 1;
      }
    }
  }
}

function featherRemovedBackground(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  target: { r: number; g: number; b: number },
  hardTolerance: number,
  featherDistance: number,
  removed: Uint8Array,
) {
  const featherLimit = hardTolerance + featherDistance;
  const featherRadius = Math.max(2, Math.min(4, Math.ceil(hardTolerance / 12)));
  const featherZone = expandMask(removed, width, height, featherRadius);

  for (let dataIndex = 0; dataIndex < pixels.length; dataIndex += 4) {
    const pixelIndex = dataIndex / 4;
    if (removed[pixelIndex]) {
      pixels[dataIndex + 3] = 0;
      continue;
    }

    const alpha = pixels[dataIndex + 3];
    if (alpha === 0) {
      continue;
    }

    const distance = getPixelDistance(pixels, dataIndex, target);
    if (distance > featherLimit || !featherZone[pixelIndex]) {
      continue;
    }

    const ratio = Math.max(0, Math.min((distance - hardTolerance) / featherDistance, 1));
    const nextAlpha = Math.round(alpha * Math.pow(ratio, 1.2));
    pixels[dataIndex + 3] = Math.min(alpha, nextAlpha);
    if (pixels[dataIndex + 3] > 0) {
      unmixBackgroundColor(pixels, dataIndex, target, pixels[dataIndex + 3] / 255);
    }
  }
}

function expandMask(mask: Uint8Array, width: number, height: number, radius: number) {
  const horizontal = new Uint8Array(mask.length);
  const expanded = new Uint8Array(mask.length);

  for (let y = 0; y < height; y += 1) {
    let active = 0;
    for (let x = 0; x < width; x += 1) {
      if (x === 0) {
        for (let seedX = 0; seedX <= Math.min(width - 1, radius); seedX += 1) {
          active += mask[y * width + seedX];
        }
      } else {
        const enteringX = x + radius;
        const leavingX = x - radius - 1;
        if (enteringX < width) {
          active += mask[y * width + enteringX];
        }
        if (leavingX >= 0) {
          active -= mask[y * width + leavingX];
        }
      }
      horizontal[y * width + x] = active > 0 ? 1 : 0;
    }
  }

  for (let x = 0; x < width; x += 1) {
    let active = 0;
    for (let y = 0; y < height; y += 1) {
      if (y === 0) {
        for (let seedY = 0; seedY <= Math.min(height - 1, radius); seedY += 1) {
          active += horizontal[seedY * width + x];
        }
      } else {
        const enteringY = y + radius;
        const leavingY = y - radius - 1;
        if (enteringY < height) {
          active += horizontal[enteringY * width + x];
        }
        if (leavingY >= 0) {
          active -= horizontal[leavingY * width + x];
        }
      }
      expanded[y * width + x] = active > 0 ? 1 : 0;
    }
  }

  return expanded;
}

function isLikelyTextForeground(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  target: { r: number; g: number; b: number },
  hardTolerance: number,
) {
  const mask = new Uint8Array(width * height);
  const foregroundTolerance = Math.max(hardTolerance * 1.5, 42);
  for (let pixelIndex = 0; pixelIndex < mask.length; pixelIndex += 1) {
    const dataIndex = pixelIndex * 4;
    if (pixels[dataIndex + 3] >= 48 && getPixelDistance(pixels, dataIndex, target) > foregroundTolerance) {
      mask[pixelIndex] = 1;
    }
  }

  const components = collectForegroundComponents(mask, width, height).filter(
    (component) => component.area >= Math.max(4, Math.round(width * height * 0.0004)),
  );
  if (components.length < 3) {
    return false;
  }

  const totalArea = components.reduce((sum, component) => sum + component.area, 0);
  const largestArea = Math.max(...components.map((component) => component.area));
  if (largestArea / Math.max(totalArea, 1) > 0.68) {
    return false;
  }

  const left = Math.min(...components.map((component) => component.left));
  const right = Math.max(...components.map((component) => component.right));
  const top = Math.min(...components.map((component) => component.top));
  const bottom = Math.max(...components.map((component) => component.bottom));
  const boundsWidth = right - left + 1;
  const boundsHeight = bottom - top + 1;
  if (boundsWidth / Math.max(boundsHeight, 1) < 1.45) {
    return false;
  }

  const heights = components.map((component) => component.bottom - component.top + 1).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)];
  const bottoms = components.map((component) => component.bottom).sort((a, b) => a - b);
  const medianBottom = bottoms[Math.floor(bottoms.length / 2)];
  const aligned = components.filter((component) => {
    const componentHeight = component.bottom - component.top + 1;
    return (
      componentHeight >= medianHeight * 0.45 &&
      componentHeight <= medianHeight * 1.8 &&
      Math.abs(component.bottom - medianBottom) <= Math.max(3, medianHeight * 0.35)
    );
  });

  return aligned.length / components.length >= 0.65;
}

function collectForegroundComponents(mask: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(mask.length);
  const components: Array<{ area: number; left: number; right: number; top: number; bottom: number }> = [];

  for (let startIndex = 0; startIndex < mask.length; startIndex += 1) {
    if (!mask[startIndex] || visited[startIndex]) {
      continue;
    }

    const stack = [startIndex];
    visited[startIndex] = 1;
    let area = 0;
    let left = width;
    let right = 0;
    let top = height;
    let bottom = 0;

    while (stack.length > 0) {
      const pixelIndex = stack.pop();
      if (pixelIndex === undefined) {
        continue;
      }
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      area += 1;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);

      for (let nextY = Math.max(0, y - 1); nextY <= Math.min(height - 1, y + 1); nextY += 1) {
        for (let nextX = Math.max(0, x - 1); nextX <= Math.min(width - 1, x + 1); nextX += 1) {
          const neighbor = nextY * width + nextX;
          if (mask[neighbor] && !visited[neighbor]) {
            visited[neighbor] = 1;
            stack.push(neighbor);
          }
        }
      }
    }

    components.push({ area, left, right, top, bottom });
  }

  return components;
}

function isBackgroundPixel(
  pixels: Uint8ClampedArray,
  pixelIndex: number,
  target: { r: number; g: number; b: number },
  tolerance: number,
) {
  const dataIndex = pixelIndex * 4;
  return pixels[dataIndex + 3] === 0 || getPixelDistance(pixels, dataIndex, target) <= tolerance;
}

function getPixelDistance(pixels: Uint8ClampedArray, dataIndex: number, target: { r: number; g: number; b: number }) {
  return colorDistance({ r: pixels[dataIndex], g: pixels[dataIndex + 1], b: pixels[dataIndex + 2] }, target);
}

function unmixBackgroundColor(
  pixels: Uint8ClampedArray,
  dataIndex: number,
  background: { r: number; g: number; b: number },
  alphaRatio: number,
) {
  if (alphaRatio <= 0 || alphaRatio >= 1) {
    return;
  }

  pixels[dataIndex] = clampColor((pixels[dataIndex] - background.r * (1 - alphaRatio)) / alphaRatio);
  pixels[dataIndex + 1] = clampColor((pixels[dataIndex + 1] - background.g * (1 - alphaRatio)) / alphaRatio);
  pixels[dataIndex + 2] = clampColor((pixels[dataIndex + 2] - background.b * (1 - alphaRatio)) / alphaRatio);
}

function clampColor(value: number) {
  return Math.max(0, Math.min(Math.round(value), 255));
}

function estimateCanvasEdgeColor(imageData: { data: Uint8ClampedArray; width: number; height: number }) {
  const { data, width, height } = imageData;
  const samples: Array<{ r: number; g: number; b: number }> = [];

  function addSample(pixelIndex: number) {
    const dataIndex = pixelIndex * 4;
    if (data[dataIndex + 3] === 0) {
      return;
    }

    samples.push({ r: data[dataIndex], g: data[dataIndex + 1], b: data[dataIndex + 2] });
  }

  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 48))) {
    addSample(x);
    addSample((height - 1) * width + x);
  }

  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 48))) {
    addSample(y * width);
    addSample(y * width + width - 1);
  }

  if (samples.length === 0) {
    return { r: 255, g: 255, b: 255 };
  }

  samples.sort((left, right) => getLuminance(left) - getLuminance(right));
  return samples[Math.floor(samples.length / 2)];
}

function parseHexColor(color: string) {
  const match = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1], 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function colorDistance(left: { r: number; g: number; b: number }, right: { r: number; g: number; b: number }) {
  return Math.max(Math.abs(left.r - right.r), Math.abs(left.g - right.g), Math.abs(left.b - right.b));
}

function getLuminance(color: { r: number; g: number; b: number }) {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

function applySliceClip(context: CanvasRenderingContext2D, slice: SliceRegion, width: number, height: number) {
  const shape = slice.shape ?? "rect";
  if (shape === "rect") {
    return false;
  }

  context.save();
  context.beginPath();

  if (shape === "ellipse") {
    context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  } else {
    const radius = Math.max(0, Math.min(slice.cornerRadius ?? 12, width / 2, height / 2));
    roundedRectPath(context, 0, 0, width, height, radius);
  }

  context.clip();
  return true;
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
}

export async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Canvas export failed"));
      },
      mimeType,
      quality,
    );
  });
}
