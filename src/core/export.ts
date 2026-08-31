import JSZip from "jszip";
import {
  buildAndroidExportPlan,
  buildCustomExportPlan,
  buildGenericExportPlan,
  buildIosExportPlan,
  buildWebExportPlan,
  validateExport,
  type PlatformExportPlan,
} from "./export-plan";
import { loadImage, renderSlice } from "./image";
import { isValidAndroidResourceName } from "./naming";
import { ANDROID_ICON_OUTPUTS, IOS_ICON_OUTPUTS, WEB_ICON_OUTPUTS } from "./presets";
import { saveBlob } from "../platform/save";
import type {
  CustomIconOutput,
  ExportFormat,
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

export async function savePlatformPackage(
  sourceImage: HTMLImageElement,
  slices: SliceRegion[],
  plan: PlatformExportPlan,
  jpgBackground: string,
) {
  const zip = new JSZip();
  const sliceById = new Map(slices.map((slice) => [slice.id, slice]));

  for (const file of plan.imageFiles) {
    const slice = sliceById.get(file.sliceId);
    if (!slice) {
      continue;
    }

    const blob = await renderSlice(sourceImage, slice, "png", jpgBackground, {
      width: file.width,
      height: file.height,
    });
    zip.file(file.path, blob);
  }

  for (const file of plan.textFiles) {
    zip.file(file.path, file.content);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  await saveBlob(zipBlob, plan.archiveName);
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
}): Promise<{ ok: true; statusText: string } | { ok: false; errorMessage: string; statusText: string }> {
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

  if (targetPlatform === "web") {
    await savePlatformPackage(
      sourceImage,
      exportSlices,
      buildWebExportPlan(exportSlices, enabledWebOutputs, imageDocument.fileName, filePrefix),
      jpgBackground,
    );
    return { ok: true, statusText: `已导出 Web 资源包：${exportSlices.length} 个切片` };
  }

  if (targetPlatform === "android") {
    await savePlatformPackage(
      sourceImage,
      exportSlices,
      buildAndroidExportPlan(
        exportSlices,
        enabledAndroidOutputs,
        imageDocument.fileName,
        filePrefix,
        androidResourceName,
      ),
      jpgBackground,
    );
    return { ok: true, statusText: `已导出 Android 资源包：${exportSlices.length} 个切片` };
  }

  if (targetPlatform === "ios") {
    await savePlatformPackage(
      sourceImage,
      exportSlices,
      buildIosExportPlan(exportSlices, enabledIosOutputs, imageDocument.fileName, filePrefix),
      jpgBackground,
    );
    return { ok: true, statusText: `已导出 iOS 资源包：${exportSlices.length} 个切片` };
  }

  if (targetPlatform === "custom") {
    await savePlatformPackage(
      sourceImage,
      exportSlices,
      buildCustomExportPlan(
        exportSlices,
        enabledCustomOutputs,
        customIconOutputs,
        imageDocument.fileName,
        filePrefix,
        new Date().toISOString(),
      ),
      jpgBackground,
    );
    return { ok: true, statusText: `已导出自定义资源包：${exportSlices.length} 个切片` };
  }

  const genericPlan = buildGenericExportPlan(exportSlices, filePrefix, exportFormat);

  if (genericPlan.kind === "single") {
    const blob = await renderSlice(sourceImage, exportSlices[0], exportFormat, jpgBackground);
    await saveBlob(blob, genericPlan.fileName);
  } else {
    const zip = new JSZip();
    for (let index = 0; index < exportSlices.length; index += 1) {
      const blob = await renderSlice(sourceImage, exportSlices[index], exportFormat, jpgBackground);
      zip.file(genericPlan.files[index], blob);
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    await saveBlob(zipBlob, genericPlan.archiveName);
  }

  return { ok: true, statusText: `已导出 ${exportSlices.length} 个切片` };
}
