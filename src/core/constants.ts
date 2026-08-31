import type { CustomIconOutput } from "./types";

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
export const MAX_SCAN_PIXELS = 16_000_000;

export const DEFAULT_WEB_OUTPUT_IDS = [
  "favicon-16",
  "favicon-32",
  "favicon-48",
  "apple-touch-180",
  "pwa-192",
  "pwa-512",
];

export const DEFAULT_CUSTOM_ICON_OUTPUTS: CustomIconOutput[] = [
  { id: "custom-64", label: "Icon 64", width: 64, height: 64, fileName: "icon-64x64.png" },
  { id: "custom-128", label: "Icon 128", width: 128, height: 128, fileName: "icon-128x128.png" },
  { id: "custom-256", label: "Icon 256", width: 256, height: 256, fileName: "icon-256x256.png" },
];
