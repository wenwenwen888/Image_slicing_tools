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
  const canvas = document.createElement("canvas");
  canvas.width = outputSize?.width ?? slice.width;
  canvas.height = outputSize?.height ?? slice.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is unavailable");
  }

  if (format === "jpg") {
    context.fillStyle = jpgBackground;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const didClip = applySliceClip(context, slice, canvas.width, canvas.height);
  context.drawImage(
    image,
    slice.x,
    slice.y,
    slice.width,
    slice.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  if (didClip) {
    context.restore();
  }

  if (format !== "jpg" && transparentBackground) {
    eraseBackgroundPixels(context, canvas.width, canvas.height, transparentBackground);
  }

  return canvasToBlob(canvas, getMimeType(format), format === "jpg" ? 0.92 : undefined);
}

function eraseBackgroundPixels(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: TransparentBackgroundOptions,
) {
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const selectedTarget = parseHexColor(options.color);
  const edgeTarget = estimateCanvasEdgeColor(imageData);
  const target =
    selectedTarget && colorDistance(selectedTarget, edgeTarget) <= Math.max(options.tolerance * 2.4, 36)
      ? selectedTarget
      : edgeTarget;
  const tolerance = Math.max(0, Math.min(options.tolerance, 255));
  const hardTolerance = Math.max(tolerance, 18);
  const featherDistance = Math.max(72, tolerance * 3.5);
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];

  function isBackground(pixelIndex: number) {
    const dataIndex = pixelIndex * 4;
    if (pixels[dataIndex + 3] === 0) {
      return true;
    }

    return getPixelDistance(pixels, dataIndex, target) <= hardTolerance;
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

    const dataIndex = pixelIndex * 4;
    pixels[dataIndex + 3] = 0;

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

  removeEnclosedBackgroundAndFeatherEdges(pixels, target, hardTolerance, featherDistance);

  context.putImageData(imageData, 0, 0);
}

function removeEnclosedBackgroundAndFeatherEdges(
  pixels: Uint8ClampedArray,
  target: { r: number; g: number; b: number },
  hardTolerance: number,
  featherDistance: number,
) {
  const featherLimit = hardTolerance + featherDistance;

  for (let dataIndex = 0; dataIndex < pixels.length; dataIndex += 4) {
    const alpha = pixels[dataIndex + 3];
    if (alpha === 0) {
      continue;
    }

    const distance = getPixelDistance(pixels, dataIndex, target);
    if (distance <= hardTolerance) {
      pixels[dataIndex + 3] = 0;
      continue;
    }

    if (distance <= featherLimit) {
      const ratio = Math.max(0, Math.min((distance - hardTolerance) / featherDistance, 1));
      const nextAlpha = Math.round(alpha * Math.pow(ratio, 1.35));
      pixels[dataIndex + 3] = Math.min(alpha, nextAlpha);
      if (pixels[dataIndex + 3] > 0) {
        unmixBackgroundColor(pixels, dataIndex, target, pixels[dataIndex + 3] / 255);
      }
    }
  }
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

function estimateCanvasEdgeColor(imageData: ImageData) {
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
