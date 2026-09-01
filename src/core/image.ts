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
  const target = parseHexColor(options.color);
  if (!target) {
    return;
  }

  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const tolerance = Math.max(0, Math.min(options.tolerance, 255));

  for (let index = 0; index < pixels.length; index += 4) {
    const distance = Math.max(
      Math.abs(pixels[index] - target.r),
      Math.abs(pixels[index + 1] - target.g),
      Math.abs(pixels[index + 2] - target.b),
    );
    if (distance <= tolerance) {
      pixels[index + 3] = 0;
    }
  }

  context.putImageData(imageData, 0, 0);
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
