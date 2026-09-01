import JSZip from "jszip";
import {
  buildExportPreview,
  buildExportWarnings,
  buildGenericExportPlan,
  buildPlatformExportPlan,
  validateExport,
  type ExportPreview,
  type PlatformExportPlan,
} from "./export-plan";
import { loadImage, renderSlice, type TransparentBackgroundOptions } from "./image";
import { isValidAndroidResourceName } from "./naming";
import { ANDROID_ICON_OUTPUTS, IOS_ICON_OUTPUTS, WEB_ICON_OUTPUTS } from "./presets";
import { isTauriRuntime } from "../platform/runtime";
import { saveBlob, saveFilesToDirectory, type DirectoryExportFile } from "../platform/save";
import type {
  CustomIconOutput,
  ExportFormat,
  ExportMode,
  ExportScope,
  ImageDocument,
  SliceRegion,
  TargetPlatform,
} from "./types";

export function getExportSlices(
  slices: SliceRegion[],
  exportScope: ExportScope,
  selectedSliceId: string | null,
) {
  if (exportScope === "selected") {
    const selectedSlice = slices.find((slice) => slice.id === selectedSliceId) ?? null;
    return selectedSlice ? [selectedSlice] : [];
  }

  return slices.filter((slice) => slice.enabled);
}

export function getPlatformOutputCount(
  targetPlatform: TargetPlatform,
  enabledWebCount: number,
  enabledAndroidCount: number,
  enabledIosCount: number,
  enabledCustomCount: number,
) {
  if (targetPlatform === "android") {
    return enabledAndroidCount;
  }
  if (targetPlatform === "ios") {
    return enabledIosCount;
  }
  if (targetPlatform === "web") {
    return enabledWebCount;
  }
  if (targetPlatform === "custom") {
    return enabledCustomCount;
  }
  return 1;
}

export function buildPreviewForExport(options: {
  imageDocument: ImageDocument | null;
  slices: SliceRegion[];
  exportScope: ExportScope;
  selectedSliceId: string | null;
  targetPlatform: TargetPlatform;
  enabledWebOutputIds: string[];
  enabledAndroidOutputIds: string[];
  enabledIosOutputIds: string[];
  enabledCustomOutputIds: string[];
  customIconOutputs: CustomIconOutput[];
  androidResourceName: string;
  filePrefix: string;
  exportFormat: ExportFormat;
}): ExportPreview | null {
  if (!options.imageDocument) {
    return null;
  }

  const exportSlices = getExportSlices(options.slices, options.exportScope, options.selectedSliceId);
  if (exportSlices.length === 0) {
    return null;
  }

  const enabledWebOutputs = WEB_ICON_OUTPUTS.filter((output) => options.enabledWebOutputIds.includes(output.id));
  const enabledAndroidOutputs = ANDROID_ICON_OUTPUTS.filter((output) => options.enabledAndroidOutputIds.includes(output.id));
  const enabledIosOutputs = IOS_ICON_OUTPUTS.filter((output) => options.enabledIosOutputIds.includes(output.id));
  const enabledCustomOutputs = options.customIconOutputs.filter((output) => options.enabledCustomOutputIds.includes(output.id));

  if (
    (options.targetPlatform === "web" && enabledWebOutputs.length === 0) ||
    (options.targetPlatform === "android" && enabledAndroidOutputs.length === 0) ||
    (options.targetPlatform === "ios" && enabledIosOutputs.length === 0) ||
    (options.targetPlatform === "custom" && enabledCustomOutputs.length === 0)
  ) {
    return null;
  }

  const plan = buildPlatformExportPlan({
    imageDocument: options.imageDocument,
    slices: exportSlices,
    targetPlatform: options.targetPlatform,
    enabledWebOutputs,
    enabledAndroidOutputs,
    enabledIosOutputs,
    enabledCustomOutputs,
    customIconOutputs: options.customIconOutputs,
    androidResourceName: options.androidResourceName,
    filePrefix: options.filePrefix,
    exportFormat: options.exportFormat,
  });
  const warnings = buildExportWarnings(options.imageDocument, exportSlices, options.targetPlatform, enabledWebOutputs);
  return buildExportPreview(plan, warnings);
}

export async function savePlatformPackage(
  sourceImage: HTMLImageElement,
  slices: SliceRegion[],
  plan: PlatformExportPlan,
  jpgBackground: string,
  exportMode: ExportMode,
  transparentBackground?: TransparentBackgroundOptions | null,
) {
  const files = await renderExportFiles(sourceImage, slices, plan, jpgBackground, transparentBackground);

  if (exportMode === "folder" && isTauriRuntime()) {
    const selectedDirectory = await saveFilesToDirectory(files, plan.archiveName.replace(/\.zip$/i, ""));
    return { mode: "folder" as const, directory: selectedDirectory, canceled: selectedDirectory === null };
  }

  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.content);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  await saveBlob(zipBlob, plan.archiveName);
  return { mode: "zip" as const, directory: null, canceled: false };
}

async function renderExportFiles(
  sourceImage: HTMLImageElement,
  slices: SliceRegion[],
  plan: PlatformExportPlan,
  jpgBackground: string,
  transparentBackground?: TransparentBackgroundOptions | null,
): Promise<DirectoryExportFile[]> {
  const files: DirectoryExportFile[] = [];
  const sliceById = new Map(slices.map((slice) => [slice.id, slice]));

  for (const file of plan.imageFiles) {
    const slice = sliceById.get(file.sliceId);
    if (!slice) {
      continue;
    }

    const blob = await renderSlice(sourceImage, slice, file.format ?? "png", jpgBackground, {
      width: file.width,
      height: file.height,
    }, transparentBackground);
    files.push({ path: file.path, content: blob });
  }

  for (const file of plan.textFiles) {
    files.push({ path: file.path, content: file.content });
  }

  return files;
}

export async function runExport(options: {
  imageDocument: ImageDocument;
  slices: SliceRegion[];
  exportScope: ExportScope;
  selectedSliceId: string | null;
  targetPlatform: TargetPlatform;
  enabledWebOutputIds: string[];
  enabledAndroidOutputIds: string[];
  enabledIosOutputIds: string[];
  enabledCustomOutputIds: string[];
  customIconOutputs: CustomIconOutput[];
  androidResourceName: string;
  filePrefix: string;
  exportFormat: ExportFormat;
  jpgBackground: string;
  exportMode: ExportMode;
  transparentBackground?: TransparentBackgroundOptions | null;
}): Promise<
  | { ok: true; statusText: string; exportDirectory: string | null }
  | { ok: false; errorMessage: string; statusText: string }
> {
  const {
    imageDocument,
    slices,
    exportScope,
    selectedSliceId,
    targetPlatform,
    enabledWebOutputIds,
    enabledAndroidOutputIds,
    enabledIosOutputIds,
    enabledCustomOutputIds,
    customIconOutputs,
    androidResourceName,
    filePrefix,
    exportFormat,
    jpgBackground,
    exportMode,
    transparentBackground,
  } = options;

  const exportSlices = getExportSlices(slices, exportScope, selectedSliceId);
  const enabledWebOutputs = WEB_ICON_OUTPUTS.filter((output) => enabledWebOutputIds.includes(output.id));
  const enabledAndroidOutputs = ANDROID_ICON_OUTPUTS.filter((output) => enabledAndroidOutputIds.includes(output.id));
  const enabledIosOutputs = IOS_ICON_OUTPUTS.filter((output) => enabledIosOutputIds.includes(output.id));
  const enabledCustomOutputs = customIconOutputs.filter((output) => enabledCustomOutputIds.includes(output.id));
  const exportIssue = validateExport(exportSlices, imageDocument);

  if (exportIssue) {
    return { ok: false, errorMessage: exportIssue, statusText: "导出前检查未通过" };
  }

  if (targetPlatform === "web" && enabledWebOutputs.length === 0) {
    return { ok: false, errorMessage: "请至少选择一个 Web icon 尺寸。", statusText: "导出前检查未通过" };
  }

  if (targetPlatform === "android" && enabledAndroidOutputs.length === 0) {
    return { ok: false, errorMessage: "请至少选择一个 Android density。", statusText: "导出前检查未通过" };
  }

  if (targetPlatform === "ios" && enabledIosOutputs.length === 0) {
    return { ok: false, errorMessage: "请至少选择一个 iOS icon 尺寸。", statusText: "导出前检查未通过" };
  }

  if (targetPlatform === "custom" && enabledCustomOutputs.length === 0) {
    return { ok: false, errorMessage: "请至少启用一个自定义尺寸。", statusText: "导出前检查未通过" };
  }

  if (targetPlatform === "android" && !isValidAndroidResourceName(androidResourceName)) {
    return {
      ok: false,
      errorMessage: "Android 资源名只能使用小写字母、数字和下划线，并且不能以数字开头。",
      statusText: "导出前检查未通过",
    };
  }

  const sourceImage = await loadImage(imageDocument.url);
  const plan = buildPlatformExportPlan({
    imageDocument,
    slices: exportSlices,
    targetPlatform,
    enabledWebOutputs,
    enabledAndroidOutputs,
    enabledIosOutputs,
    enabledCustomOutputs,
    customIconOutputs,
    androidResourceName,
    filePrefix,
    exportFormat,
  });

  const effectiveExportMode = exportMode === "folder" && isTauriRuntime() ? "folder" : "zip";

  if (targetPlatform === "web") {
    const result = await savePlatformPackage(sourceImage, exportSlices, plan, jpgBackground, effectiveExportMode, transparentBackground);
    if (result.canceled) {
      return { ok: true, statusText: "已取消导出", exportDirectory: null };
    }

    return {
      ok: true,
      statusText: getPackageStatusText("Web 资源包", exportSlices.length, result.directory),
      exportDirectory: result.directory,
    };
  }

  if (targetPlatform === "android") {
    const result = await savePlatformPackage(sourceImage, exportSlices, plan, jpgBackground, effectiveExportMode, transparentBackground);
    if (result.canceled) {
      return { ok: true, statusText: "已取消导出", exportDirectory: null };
    }

    return {
      ok: true,
      statusText: getPackageStatusText("Android 资源包", exportSlices.length, result.directory),
      exportDirectory: result.directory,
    };
  }

  if (targetPlatform === "ios") {
    const result = await savePlatformPackage(sourceImage, exportSlices, plan, jpgBackground, effectiveExportMode, transparentBackground);
    if (result.canceled) {
      return { ok: true, statusText: "已取消导出", exportDirectory: null };
    }

    return {
      ok: true,
      statusText: getPackageStatusText("iOS 资源包", exportSlices.length, result.directory),
      exportDirectory: result.directory,
    };
  }

  if (targetPlatform === "custom") {
    const result = await savePlatformPackage(sourceImage, exportSlices, plan, jpgBackground, effectiveExportMode, transparentBackground);
    if (result.canceled) {
      return { ok: true, statusText: "已取消导出", exportDirectory: null };
    }

    return {
      ok: true,
      statusText: getPackageStatusText("自定义资源包", exportSlices.length, result.directory),
      exportDirectory: result.directory,
    };
  }

  if (effectiveExportMode === "folder") {
    const result = await savePlatformPackage(sourceImage, exportSlices, plan, jpgBackground, effectiveExportMode, transparentBackground);
    if (result.canceled) {
      return { ok: true, statusText: "已取消导出", exportDirectory: null };
    }

    return {
      ok: true,
      statusText: getPackageStatusText("通用切片", exportSlices.length, result.directory),
      exportDirectory: result.directory,
    };
  }

  const genericPlan = buildGenericExportPlan(exportSlices, filePrefix, exportFormat);

  if (genericPlan.kind === "single") {
    const blob = await renderSlice(sourceImage, exportSlices[0], exportFormat, jpgBackground, undefined, transparentBackground);
    await saveBlob(blob, genericPlan.fileName);
  } else {
    const zip = new JSZip();
    for (let index = 0; index < exportSlices.length; index += 1) {
      const blob = await renderSlice(sourceImage, exportSlices[index], exportFormat, jpgBackground, undefined, transparentBackground);
      zip.file(genericPlan.files[index], blob);
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    await saveBlob(zipBlob, genericPlan.archiveName);
  }

  return { ok: true, statusText: `已导出 ${exportSlices.length} 个切片`, exportDirectory: null };
}

function getPackageStatusText(label: string, sliceCount: number, directory: string | null) {
  if (directory) {
    return `已导出${label}到文件夹：${sliceCount} 个切片`;
  }

  return `已导出 ${label}：${sliceCount} 个切片`;
}
