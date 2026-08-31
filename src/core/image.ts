import { MAX_ZOOM, MIN_ZOOM } from "./constants";
import { clamp } from "./geometry";
import type { ExportFormat, SliceRegion } from "./types";

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

  return canvasToBlob(canvas, getMimeType(format), format === "jpg" ? 0.92 : undefined);
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
