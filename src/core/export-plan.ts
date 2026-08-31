import { buildFileName, getExtension, sanitizeAndroidResourceName, sanitizeCustomOutputFileName, sanitizeFileName } from "./naming";
import type {
  AndroidIconOutput,
  CustomIconOutput,
  ExportFormat,
  ImageSize,
  IosIconOutput,
  SliceRegion,
  WebIconOutput,
} from "./types";

export type ExportImageFile = {
  path: string;
  width: number;
  height: number;
  sliceId: string;
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

export function buildWebExportPlan(
  slices: SliceRegion[],
  outputs: WebIconOutput[],
  sourceFileName: string,
  filePrefix: string,
): PlatformExportPlan {
  const reportLines = [
    "# Web Icon Export Report",
    "",
    `Source: ${sourceFileName || "unknown"}`,
    `Slices: ${slices.length}`,
    `Outputs per slice: ${outputs.length}`,
    "",
  ];
  const imageFiles: ExportImageFile[] = [];
  const manifestIcons: Array<{ src: string; sizes: string; type: string; purpose?: string }> = [];
  const htmlLinks: string[] = [];

  for (let sliceIndex = 0; sliceIndex < slices.length; sliceIndex += 1) {
    const slice = slices[sliceIndex];
    const sliceFolder = sanitizeFileName(slice.name || `slice_${sliceIndex + 1}`);
    const outputRoot = slices.length === 1 ? "web-icons" : `web-icons/${sliceFolder}`;

    reportLines.push(`## ${slice.name}`);
    reportLines.push(`Original slice: ${slice.width} x ${slice.height}`);

    for (const output of outputs) {
      imageFiles.push({
        path: `${outputRoot}/${output.fileName}`,
        width: output.width,
        height: output.height,
        sliceId: slice.id,
      });
      reportLines.push(`- ${output.fileName}: ${output.width} x ${output.height}`);

      if (slices.length === 1) {
        const publicPath = `/${output.fileName}`;
        if (output.id.startsWith("favicon")) {
          htmlLinks.push(
            `<link rel="icon" type="image/png" sizes="${output.width}x${output.height}" href="${publicPath}">`,
          );
        }

        if (output.id.startsWith("apple-touch")) {
          htmlLinks.push(`<link rel="apple-touch-icon" sizes="${output.width}x${output.height}" href="${publicPath}">`);
        }

        if (output.id.startsWith("pwa") || output.id.startsWith("maskable")) {
          manifestIcons.push({
            src: publicPath,
            sizes: `${output.width}x${output.height}`,
            type: "image/png",
            purpose: output.purpose,
          });
        }
      }
    }

    reportLines.push("");
  }

  const textFiles: ExportTextFile[] = [];
  if (slices.length === 1) {
    textFiles.push({
      path: "web-icons/manifest-icons.json",
      content: JSON.stringify({ icons: manifestIcons }, null, 2),
    });
    textFiles.push({
      path: "web-icons/html-links.txt",
      content: `${htmlLinks.join("\n")}\n`,
    });
  }

  textFiles.push({
    path: "web-icons/export-report.md",
    content: `${reportLines.join("\n")}\n`,
  });

  return {
    archiveName: `${sanitizeFileName(filePrefix || "web-icons")}_web_icons.zip`,
    imageFiles,
    textFiles,
  };
}

export function buildAndroidExportPlan(
  slices: SliceRegion[],
  outputs: AndroidIconOutput[],
  sourceFileName: string,
  filePrefix: string,
  resourceName: string,
): PlatformExportPlan {
  const safeResourceName = sanitizeAndroidResourceName(resourceName);
  const reportLines = [
    "# Android Icon Export Report",
    "",
    `Source: ${sourceFileName || "unknown"}`,
    `Resource name: ${safeResourceName}`,
    `Slices: ${slices.length}`,
    `Densities per slice: ${outputs.length}`,
    "",
  ];
  const imageFiles: ExportImageFile[] = [];

  for (const slice of slices) {
    const sliceFolder = slices.length === 1 ? "" : `${sanitizeFileName(slice.name)}/`;

    reportLines.push(`## ${slice.name}`);
    reportLines.push(`Original slice: ${slice.width} x ${slice.height}`);

    for (const output of outputs) {
      const path = `android-res/${sliceFolder}res/${output.directory}/${safeResourceName}.png`;
      imageFiles.push({
        path,
        width: output.width,
        height: output.height,
        sliceId: slice.id,
      });
      reportLines.push(`- ${output.directory}/${safeResourceName}.png: ${output.width} x ${output.height}`);
    }

    reportLines.push("");
  }

  return {
    archiveName: `${sanitizeFileName(filePrefix || "android-icons")}_android_icons.zip`,
    imageFiles,
    textFiles: [
      {
        path: "android-res/export-report.md",
        content: `${reportLines.join("\n")}\n`,
      },
    ],
  };
}

export function buildIosExportPlan(
  slices: SliceRegion[],
  outputs: IosIconOutput[],
  sourceFileName: string,
  filePrefix: string,
): PlatformExportPlan {
  const reportLines = [
    "# iOS App Icon Export Report",
    "",
    `Source: ${sourceFileName || "unknown"}`,
    `Slices: ${slices.length}`,
    `Outputs per slice: ${outputs.length}`,
    "",
  ];
  const imageFiles: ExportImageFile[] = [];
  const textFiles: ExportTextFile[] = [];

  for (const slice of slices) {
    const sliceFolder =
      slices.length === 1
        ? "Assets.xcassets/AppIcon.appiconset"
        : `Assets.xcassets/${sanitizeFileName(slice.name)}.appiconset`;
    const contentsImages: Array<{
      filename: string;
      idiom: string;
      size: string;
      scale: string;
    }> = [];

    reportLines.push(`## ${slice.name}`);
    reportLines.push(`Original slice: ${slice.width} x ${slice.height}`);

    for (const output of outputs) {
      imageFiles.push({
        path: `${sliceFolder}/${output.fileName}`,
        width: output.width,
        height: output.height,
        sliceId: slice.id,
      });
      contentsImages.push({
        filename: output.fileName,
        idiom: output.idiom,
        size: output.size,
        scale: output.scale,
      });
      reportLines.push(`- ${output.fileName}: ${output.width} x ${output.height}`);
    }

    textFiles.push({
      path: `${sliceFolder}/Contents.json`,
      content: JSON.stringify(
        {
          images: contentsImages,
          info: {
            author: "xcode",
            version: 1,
          },
        },
        null,
        2,
      ),
    });
    reportLines.push("");
  }

  textFiles.push({
    path: "ios-icons/export-report.md",
    content: `${reportLines.join("\n")}\n`,
  });

  return {
    archiveName: `${sanitizeFileName(filePrefix || "ios-icons")}_ios_icons.zip`,
    imageFiles,
    textFiles,
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
