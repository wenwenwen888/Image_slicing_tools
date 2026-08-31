import { ACCEPTED_IMAGE_TYPES } from "./constants";
import type { CustomIconOutput, ExportFormat, ExportScope, GridMode, GridOrder, ScanMode, SliceRegion, TargetPlatform } from "./types";

export type SavedProject = {
  version: 1;
  savedAt: string;
  image: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    width: number;
    height: number;
    hasAlpha: boolean;
    dataUrl: string;
  };
  slices: SliceRegion[];
  selectedSliceId: string | null;
  settings: ProjectSettings;
};

export type ProjectSettings = {
  exportFormat: ExportFormat;
  exportScope: ExportScope;
  targetPlatform: TargetPlatform;
  enabledWebOutputIds: string[];
  enabledAndroidOutputIds: string[];
  enabledIosOutputIds: string[];
  androidResourceName: string;
  filePrefix: string;
  jpgBackground: string;
  gridMode: GridMode;
  gridWidth: number;
  gridHeight: number;
  gridStartX: number;
  gridStartY: number;
  gridGapX: number;
  gridGapY: number;
  gridRows: number;
  gridColumns: number;
  gridOrder: GridOrder;
  scanMode: ScanMode;
  scanAlphaThreshold: number;
  scanBackgroundColor: string;
  scanColorTolerance: number;
  scanMinArea: number;
  scanMinSize: number;
  scanPadding: number;
  customIconOutputs: CustomIconOutput[];
  enabledCustomOutputIds: string[];
};

export type CustomPresetFile = {
  version: 1;
  savedAt: string;
  outputs: CustomIconOutput[];
};

export function isSavedProject(value: unknown): value is SavedProject {
  if (!value || typeof value !== "object") {
    return false;
  }

  const project = value as SavedProject;
  return (
    project.version === 1 &&
    Boolean(project.image?.dataUrl) &&
    ACCEPTED_IMAGE_TYPES.includes(project.image.mimeType) &&
    Array.isArray(project.slices) &&
    Boolean(project.settings)
  );
}

export function isCustomPresetFile(value: unknown): value is CustomPresetFile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const preset = value as CustomPresetFile;
  return (
    preset.version === 1 &&
    Array.isArray(preset.outputs) &&
    preset.outputs.every(
      (output) =>
        Boolean(output.id) &&
        Boolean(output.label) &&
        Number.isFinite(output.width) &&
        Number.isFinite(output.height) &&
        output.width > 0 &&
        output.height > 0,
    )
  );
}
