import { buildFileName, getExtension, sanitizeAndroidResourceName, sanitizeCustomOutputFileName, sanitizeFileName } from "./naming";
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

const ANDROID_ADAPTIVE_ICON_OUTPUTS = [
  { density: "mdpi", directory: "mipmap-mdpi", size: 108 },
  { density: "hdpi", directory: "mipmap-hdpi", size: 162 },
  { density: "xhdpi", directory: "mipmap-xhdpi", size: 216 },
  { density: "xxhdpi", directory: "mipmap-xxhdpi", size: 324 },
  { density: "xxxhdpi", directory: "mipmap-xxxhdpi", size: 432 },
] as const;

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

    for (const output of ANDROID_ADAPTIVE_ICON_OUTPUTS) {
      const foregroundPath = `android-res/${sliceFolder}res/${output.directory}/${safeResourceName}_foreground.png`;
      imageFiles.push({
        path: foregroundPath,
        width: output.size,
        height: output.size,
        sliceId: slice.id,
      });
      reportLines.push(`- ${output.directory}/${safeResourceName}_foreground.png: ${output.size} x ${output.size}`);
    }

    reportLines.push("");
  }

  const adaptiveTextFiles = [
    {
      path: "android-res/res/mipmap-anydpi-v26/ic_launcher.xml",
      content: [
        '<?xml version="1.0" encoding="utf-8"?>',
        "<adaptive-icon xmlns:android=\"http://schemas.android.com/apk/res/android\">",
        `  <background android:drawable="@color/${safeResourceName}_background"/>`,
        `  <foreground android:drawable="@mipmap/${safeResourceName}_foreground"/>`,
        "</adaptive-icon>",
        "",
      ].join("\n"),
    },
    {
      path: "android-res/res/mipmap-anydpi-v26/ic_launcher_round.xml",
      content: [
        '<?xml version="1.0" encoding="utf-8"?>',
        "<adaptive-icon xmlns:android=\"http://schemas.android.com/apk/res/android\">",
        `  <background android:drawable="@color/${safeResourceName}_background"/>`,
        `  <foreground android:drawable="@mipmap/${safeResourceName}_foreground"/>`,
        "</adaptive-icon>",
        "",
      ].join("\n"),
    },
    {
      path: `android-res/res/values/${safeResourceName}_background.xml`,
      content: [
        '<?xml version="1.0" encoding="utf-8"?>',
        "<resources>",
        `  <color name="${safeResourceName}_background">#FFFFFF</color>`,
        "</resources>",
        "",
      ].join("\n"),
    },
  ];

  return {
    archiveName: `${sanitizeFileName(filePrefix || "android-icons")}_android_icons.zip`,
    imageFiles,
    textFiles: [
      ...adaptiveTextFiles,
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
    androidResourceName,
    filePrefix,
    exportFormat,
  } = options;

  if (targetPlatform === "web") {
    return buildWebExportPlan(slices, enabledWebOutputs, imageDocument.fileName, filePrefix);
  }

  if (targetPlatform === "android") {
    return buildAndroidExportPlan(slices, enabledAndroidOutputs, imageDocument.fileName, filePrefix, androidResourceName);
  }

  if (targetPlatform === "ios") {
    return buildIosExportPlan(slices, enabledIosOutputs, imageDocument.fileName, filePrefix);
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

  if (targetPlatform === "ios" && imageDocument.hasAlpha) {
    warnings.push("iOS App Icon 通常需要完整不透明背景，当前原图包含透明通道，导出前建议确认切片背景。");
  }

  if (targetPlatform === "web" && webOutputs.some((output) => output.purpose === "maskable")) {
    const riskySlice = slices.find((slice) => {
      const safeInsetX = slice.width * 0.1;
      const safeInsetY = slice.height * 0.1;
      return Math.min(safeInsetX, safeInsetY) < 8 || Math.abs(slice.width - slice.height) > 1;
    });

    if (riskySlice) {
      warnings.push(`Web maskable icon 建议使用接近正方形且有足够留白的切片，${riskySlice.name} 可能需要检查安全区。`);
    }
  }

  if (targetPlatform === "android") {
    warnings.push("Android 资源包会同时生成 Legacy PNG 和 Adaptive Icon foreground/XML，背景色默认 #FFFFFF。");
  }

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
