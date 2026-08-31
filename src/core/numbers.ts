export function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value || String(fallback), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(parsed, 1);
}

export function parseNonNegativeInt(value: string) {
  const parsed = Number.parseInt(value || "0", 10);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.max(parsed, 0);
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function formatMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") {
    return "JPG/JPEG";
  }

  return mimeType.replace("image/", "").toUpperCase();
}
