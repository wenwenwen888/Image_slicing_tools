import { buildFileName, getExtension, sanitizeCustomOutputFileName, sanitizeFileName } from "./naming";
import type {
  AndroidIconOutput,
  CustomIconOutput,
  ExportFormat,
  ImageSize,
  ImageDocument,
  IosIconOutput,
  SliceRegion,
  TargetPlatform,
  WebIconOutput,
} from "./types";

export type ExportImageFile = {
  path: string;
  width: number;
  height: number;
  sliceId: string;
  format?: ExportFormat;
};

export type ExportTextFile = {
  path: string;
  content: string;
};

export type PlatformExportPlan = {
  archiveName: string;
  imageFiles: ExportImageFile[];
  textFiles: ExportTextFile[];
};

export type ExportPreview = {
  archiveName: string;
  imageCount: number;
  textCount: number;
  totalCount: number;
  samplePaths: string[];
  warnings: string[];
};

export function validateExport(slices: SliceRegion[], imageSize: ImageSize) {
  if (slices.length === 0) {
    return "没有可导出的切片。请先创建选区，或启用至少一个切片。";
  }

  const invalidSlice = slices.find(
    (slice) =>
      slice.width <= 0 ||
      slice.height <= 0 ||
      slice.x < 0 ||
      slice.y < 0 ||
      slice.x + slice.width > imageSize.width ||
      slice.y + slice.height > imageSize.height,
  );

  if (invalidSlice) {
    return `切片 ${invalidSlice.name} 的尺寸或位置不合法。`;
  }

  return null;
}

export function buildGenericExportPlan(slices: SliceRegion[], filePrefix: string, format: ExportFormat) {
  const extension = getExtension(format);
  const files = slices.map((slice, index) => `${buildFileName(filePrefix, slice, index + 1)}.${extension}`);

  if (slices.length === 1) {
    return {
      kind: "single" as const,
      fileName: files[0],
    };
  }

  return {
    kind: "zip" as const,
    archiveName: `${sanitizeFileName(filePrefix || "slices")}.zip`,
    files,
  };
}

function getAspectFitSize(slice: SliceRegion, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / slice.width, maxHeight / slice.height);
  return {
    width: Math.max(1, Math.round(slice.width * scale)),
    height: Math.max(1, Math.round(slice.height * scale)),
  };
}

function buildPlatformFileName(
  filePrefix: string,
  slice: SliceRegion,
  sliceIndex: number,
  size: { width: number; height: number },
) {
  return `${buildFileName(filePrefix, slice, sliceIndex + 1)}_${size.width}x${size.height}.png`;
}

export function buildWebExportPlan(
  slices: SliceRegion[],
  outputs: WebIconOutput[],
  filePrefix: string,
): PlatformExportPlan {
  const imageFiles: ExportImageFile[] = [];

  for (let sliceIndex = 0; sliceIndex < slices.length; sliceIndex += 1) {
    const slice = slices[sliceIndex];
    const sliceFolder = sanitizeFileName(slice.name || `slice_${sliceIndex + 1}`);
    const outputRoot = slices.length === 1 ? "web-icons" : `web-icons/${sliceFolder}`;

    for (const output of outputs) {
      const size = getAspectFitSize(slice, output.width, output.height);
      imageFiles.push({
        path: `${outputRoot}/${buildPlatformFileName(filePrefix, slice, sliceIndex, size)}`,
        width: size.width,
        height: size.height,
        sliceId: slice.id,
      });
    }
  }

  return {
    archiveName: `${sanitizeFileName(filePrefix || "web-icons")}_web_icons.zip`,
    imageFiles,
    textFiles: [],
  };
}

export function buildAndroidExportPlan(
  slices: SliceRegion[],
  outputs: AndroidIconOutput[],
  filePrefix: string,
): PlatformExportPlan {
  const imageFiles: ExportImageFile[] = [];

  for (let sliceIndex = 0; sliceIndex < slices.length; sliceIndex += 1) {
    const slice = slices[sliceIndex];
    for (const output of outputs) {
      const size = getAspectFitSize(slice, output.width, output.height);
      imageFiles.push({
        path: `android-res/res/${output.directory}/${buildPlatformFileName(filePrefix, slice, sliceIndex, size)}`,
        width: size.width,
        height: size.height,
        sliceId: slice.id,
      });
    }
  }

  return {
    archiveName: `${sanitizeFileName(filePrefix || "android-icons")}_android_icons.zip`,
    imageFiles,
    textFiles: [],
  };
}

export function buildIosExportPlan(
  slices: SliceRegion[],
  outputs: IosIconOutput[],
  filePrefix: string,
): PlatformExportPlan {
  const imageFiles: ExportImageFile[] = [];

  for (let sliceIndex = 0; sliceIndex < slices.length; sliceIndex += 1) {
    const slice = slices[sliceIndex];
    for (const output of outputs) {
      const size = getAspectFitSize(slice, output.width, output.height);
      imageFiles.push({
        path: `ios-icons/${buildPlatformFileName(filePrefix, slice, sliceIndex, size)}`,
        width: size.width,
        height: size.height,
        sliceId: slice.id,
      });
    }
  }

  return {
    archiveName: `${sanitizeFileName(filePrefix || "ios-icons")}_ios_icons.zip`,
    imageFiles,
    textFiles: [],
  };
}

export function buildCustomExportPlan(
  slices: SliceRegion[],
  enabledOutputs: CustomIconOutput[],
  allOutputs: CustomIconOutput[],
  sourceFileName: string,
  filePrefix: string,
  savedAt: string,
): PlatformExportPlan {
  const reportLines = [
    "# Custom Icon Export Report",
    "",
    `Source: ${sourceFileName || "unknown"}`,
    `Slices: ${slices.length}`,
    `Outputs per slice: ${enabledOutputs.length}`,
    "",
  ];
  const imageFiles: ExportImageFile[] = [];

  for (const slice of slices) {
    const sliceFolder = slices.length === 1 ? "custom-icons" : `custom-icons/${sanitizeFileName(slice.name)}`;

    reportLines.push(`## ${slice.name}`);
    reportLines.push(`Original slice: ${slice.width} x ${slice.height}`);

    for (const output of enabledOutputs) {
      const fileName = sanitizeCustomOutputFileName(output.fileName, output.width, output.height);
      imageFiles.push({
        path: `${sliceFolder}/${fileName}`,
        width: output.width,
        height: output.height,
        sliceId: slice.id,
      });
      reportLines.push(`- ${fileName}: ${output.width} x ${output.height}`);
    }

    reportLines.push("");
  }

  return {
    archiveName: `${sanitizeFileName(filePrefix || "custom-icons")}_custom_icons.zip`,
    imageFiles,
    textFiles: [
      {
        path: "custom-icons/custom-preset.json",
        content: JSON.stringify(
          {
            version: 1,
            savedAt,
            outputs: allOutputs,
          },
          null,
          2,
        ),
      },
      {
        path: "custom-icons/export-report.md",
        content: `${reportLines.join("\n")}\n`,
      },
    ],
  };
}

export function buildPlatformExportPlan(options: {
  imageDocument: ImageDocument;
  slices: SliceRegion[];
  targetPlatform: TargetPlatform;
  enabledWebOutputs: WebIconOutput[];
  enabledAndroidOutputs: AndroidIconOutput[];
  enabledIosOutputs: IosIconOutput[];
  enabledCustomOutputs: CustomIconOutput[];
  customIconOutputs: CustomIconOutput[];
  androidResourceName: string;
  filePrefix: string;
  exportFormat: ExportFormat;
}) {
  const {
    imageDocument,
    slices,
    targetPlatform,
    enabledWebOutputs,
    enabledAndroidOutputs,
    enabledIosOutputs,
    enabledCustomOutputs,
    customIconOutputs,
    filePrefix,
    exportFormat,
  } = options;

  if (targetPlatform === "web") {
    return buildWebExportPlan(slices, enabledWebOutputs, filePrefix);
  }

  if (targetPlatform === "android") {
    return buildAndroidExportPlan(slices, enabledAndroidOutputs, filePrefix);
  }

  if (targetPlatform === "ios") {
    return buildIosExportPlan(slices, enabledIosOutputs, filePrefix);
  }

  if (targetPlatform === "custom") {
    return buildCustomExportPlan(
      slices,
      enabledCustomOutputs,
      customIconOutputs,
      imageDocument.fileName,
      filePrefix,
      new Date().toISOString(),
    );
  }

  const genericPlan = buildGenericExportPlan(slices, filePrefix, exportFormat);
  if (genericPlan.kind === "single") {
    return {
      archiveName: genericPlan.fileName,
      imageFiles: [
        {
          path: genericPlan.fileName,
          width: slices[0].width,
          height: slices[0].height,
          sliceId: slices[0].id,
          format: exportFormat,
        },
      ],
      textFiles: [],
    };
  }

  return {
    archiveName: genericPlan.archiveName,
    imageFiles: genericPlan.files.map((path, index) => ({
      path,
      width: slices[index].width,
      height: slices[index].height,
      sliceId: slices[index].id,
      format: exportFormat,
    })),
    textFiles: [],
  };
}

export function buildExportWarnings(
  imageDocument: ImageDocument,
  slices: SliceRegion[],
  targetPlatform: TargetPlatform,
  webOutputs: WebIconOutput[],
) {
  const warnings: string[] = [];
  void imageDocument;
  void slices;
  void targetPlatform;
  void webOutputs;

  return warnings;
}

export function buildExportPreview(plan: PlatformExportPlan, warnings: string[]): ExportPreview {
  const paths = [...plan.imageFiles.map((file) => file.path), ...plan.textFiles.map((file) => file.path)];

  return {
    archiveName: plan.archiveName,
    imageCount: plan.imageFiles.length,
    textCount: plan.textFiles.length,
    totalCount: paths.length,
    samplePaths: paths.slice(0, 8),
    warnings,
  };
}
