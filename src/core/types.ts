export type ImageSize = {
  width: number;
  height: number;
};

export type SliceRegion = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  enabled: boolean;
  locked: boolean;
};

export type ResizeHandle = "nw" | "ne" | "sw" | "se";
export type GridMode = "fixed" | "equal";
export type GridOrder = "row" | "column";
export type ExportFormat = "png" | "jpg" | "webp";

export type WebIconOutput = {
  id: string;
  label: string;
  width: number;
  height: number;
  fileName: string;
  purpose?: "any" | "maskable";
};

export type AndroidIconOutput = {
  id: string;
  label: string;
  density: "mdpi" | "hdpi" | "xhdpi" | "xxhdpi" | "xxxhdpi";
  width: number;
  height: number;
  directory: string;
};

export type IosIconOutput = {
  id: string;
  label: string;
  idiom: "iphone" | "ipad" | "ios-marketing";
  size: string;
  scale: "1x" | "2x" | "3x";
  width: number;
  height: number;
  fileName: string;
};

export type CustomIconOutput = {
  id: string;
  label: string;
  width: number;
  height: number;
  fileName: string;
};

export type ImageDocument = ImageSize & {
  fileName: string;
  fileSize: number;
  mimeType: string;
  hasAlpha: boolean;
  url: string;
};

export type PanState = {
  x: number;
  y: number;
};

export type ToolId = "select" | "rect" | "grid" | "scan";
export type ExportScope = "selected" | "enabled";
export type TargetPlatform = "generic" | "android" | "ios" | "web" | "custom";
export type ScanMode = "auto" | "alpha" | "color";

export type Interaction =
  | { mode: "pan"; pointerX: number; pointerY: number; pan: PanState }
  | { mode: "create"; sliceId: string; startX: number; startY: number }
  | { mode: "move"; sliceId: string; pointerX: number; pointerY: number; original: SliceRegion }
  | {
      mode: "resize";
      sliceId: string;
      pointerX: number;
      pointerY: number;
      original: SliceRegion;
      handle: ResizeHandle;
    };
