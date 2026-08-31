import type { ImageSize, ResizeHandle, SliceRegion } from "./types";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeRect(
  x: number,
  y: number,
  width: number,
  height: number,
  imageSize: ImageSize,
): Pick<SliceRegion, "x" | "y" | "width" | "height"> {
  const left = clamp(Math.min(x, x + width), 0, imageSize.width);
  const top = clamp(Math.min(y, y + height), 0, imageSize.height);
  const right = clamp(Math.max(x, x + width), 0, imageSize.width);
  const bottom = clamp(Math.max(y, y + height), 0, imageSize.height);

  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.max(Math.round(right - left), 1),
    height: Math.max(Math.round(bottom - top), 1),
  };
}

export function resizeSlice(
  original: SliceRegion,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
  imageSize: ImageSize,
) {
  let nextX = original.x;
  let nextY = original.y;
  let nextWidth = original.width;
  let nextHeight = original.height;

  if (handle.includes("w")) {
    nextX = original.x + deltaX;
    nextWidth = original.width - deltaX;
  }

  if (handle.includes("e")) {
    nextWidth = original.width + deltaX;
  }

  if (handle.includes("n")) {
    nextY = original.y + deltaY;
    nextHeight = original.height - deltaY;
  }

  if (handle.includes("s")) {
    nextHeight = original.height + deltaY;
  }

  return normalizeRect(nextX, nextY, nextWidth, nextHeight, imageSize);
}
