import type { AspectRatioPreset, ImageSize, ResizeHandle, SliceRegion } from "./types";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeRect(
  x: number,
  y: number,
  width: number,
  height: number,
  imageSize: ImageSize,
  aspectRatio?: number | null,
): Pick<SliceRegion, "x" | "y" | "width" | "height"> {
  const constrained = aspectRatio
    ? fitSizeToImageBounds(x, y, constrainSizeToAspectRatio(width, height, aspectRatio), imageSize)
    : { width, height };
  const left = clamp(Math.min(x, x + constrained.width), 0, imageSize.width);
  const top = clamp(Math.min(y, y + constrained.height), 0, imageSize.height);
  const right = clamp(Math.max(x, x + constrained.width), 0, imageSize.width);
  const bottom = clamp(Math.max(y, y + constrained.height), 0, imageSize.height);

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
  aspectRatio?: number | null,
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

  return normalizeRect(nextX, nextY, nextWidth, nextHeight, imageSize, aspectRatio);
}

export function getAspectRatioValue(preset: AspectRatioPreset) {
  if (preset === "1:1") {
    return 1;
  }
  if (preset === "4:3") {
    return 4 / 3;
  }
  if (preset === "16:9") {
    return 16 / 9;
  }
  if (preset === "3:2") {
    return 3 / 2;
  }

  return null;
}

function constrainSizeToAspectRatio(width: number, height: number, aspectRatio: number) {
  const directionX = width < 0 ? -1 : 1;
  const directionY = height < 0 ? -1 : 1;
  const absoluteWidth = Math.abs(width);
  const absoluteHeight = Math.abs(height);

  if (absoluteWidth === 0 && absoluteHeight === 0) {
    return { width, height };
  }

  if (absoluteWidth / Math.max(absoluteHeight, 1) >= aspectRatio) {
    return {
      width,
      height: directionY * Math.max(Math.round(absoluteWidth / aspectRatio), 1),
    };
  }

  return {
    width: directionX * Math.max(Math.round(absoluteHeight * aspectRatio), 1),
    height,
  };
}

function fitSizeToImageBounds(
  x: number,
  y: number,
  size: { width: number; height: number },
  imageSize: ImageSize,
) {
  const absoluteWidth = Math.abs(size.width);
  const absoluteHeight = Math.abs(size.height);
  const maxWidth = size.width < 0 ? x : imageSize.width - x;
  const maxHeight = size.height < 0 ? y : imageSize.height - y;
  const scale = Math.min(
    1,
    Math.max(maxWidth, 1) / Math.max(absoluteWidth, 1),
    Math.max(maxHeight, 1) / Math.max(absoluteHeight, 1),
  );

  return {
    width: Math.sign(size.width || 1) * Math.max(Math.round(absoluteWidth * scale), 1),
    height: Math.sign(size.height || 1) * Math.max(Math.round(absoluteHeight * scale), 1),
  };
}
