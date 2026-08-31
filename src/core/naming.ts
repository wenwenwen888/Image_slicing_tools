import type { SliceRegion } from "./types";

export function sanitizeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "slice"
  );
}

export function sanitizeAndroidResourceName(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) {
    return "ic_launcher";
  }

  if (/^[0-9]/.test(normalized)) {
    return `ic_${normalized}`;
  }

  return normalized;
}

export function isValidAndroidResourceName(value: string) {
  return /^[a-z_][a-z0-9_]*$/.test(value);
}

export function sanitizeCustomOutputFileName(fileName: string, width: number, height: number) {
  const safeName = sanitizeFileName(fileName || `icon-${width}x${height}`);
  return safeName.endsWith(".png") ? safeName : `${safeName}.png`;
}

export function buildFileName(prefix: string, slice: SliceRegion, index: number) {
  const safePrefix = sanitizeFileName(prefix || "slice");
  const safeSliceName = sanitizeFileName(slice.name || `slice_${index}`);
  const sequence = String(index).padStart(3, "0");
  return `${safePrefix}_${sequence}_${safeSliceName}`;
}

export function getExtension(format: "png" | "jpg" | "webp") {
  return format === "jpg" ? "jpg" : format;
}
