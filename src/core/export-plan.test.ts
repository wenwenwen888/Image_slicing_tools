import { describe, expect, it } from "vitest";
import {
  buildAndroidExportPlan,
  buildCustomExportPlan,
  buildExportPreview,
  buildExportWarnings,
  buildGenericExportPlan,
  buildIosExportPlan,
  buildWebExportPlan,
  validateExport,
} from "./export-plan";
import { ANDROID_ICON_OUTPUTS, IOS_ICON_OUTPUTS, WEB_ICON_OUTPUTS } from "./presets";
import type { SliceRegion } from "./types";

function makeSlice(partial: Partial<SliceRegion> = {}): SliceRegion {
  return {
    id: "slice-1",
    name: "home icon",
    x: 0,
    y: 0,
    width: 64,
    height: 64,
    enabled: true,
    locked: false,
    ...partial,
  };
}

const imageSize = { width: 200, height: 200 };

describe("导出清单生成", () => {
  it("在没有切片或越界时给出导出前检查错误", () => {
    expect(validateExport([], imageSize)).toBe("没有可导出的切片。请先创建选区，或启用至少一个切片。");
    expect(validateExport([makeSlice({ x: 180, width: 40 })], imageSize)).toBe("切片 home icon 的尺寸或位置不合法。");
    expect(validateExport([makeSlice()], imageSize)).toBeNull();
  });

  it("单切片走单文件，多切片走 ZIP 并编号", () => {
    expect(buildGenericExportPlan([makeSlice({ name: "A" })], "Icons", "png")).toEqual({
      kind: "single",
      fileName: "icons_001_a.png",
    });
    expect(buildGenericExportPlan([makeSlice({ name: "A" }), makeSlice({ id: "slice-2", name: "B" })], "Icons", "jpg")).toEqual({
      kind: "zip",
      archiveName: "icons.zip",
      files: ["icons_001_a.jpg", "icons_002_b.jpg"],
    });
  });

  it("单切片 Web 切图只包含等比缩放后的 PNG", () => {
    const plan = buildWebExportPlan([makeSlice({ width: 120, height: 60 })], WEB_ICON_OUTPUTS.slice(0, 2), "site");

    expect(plan.archiveName).toBe("site_web_icons.zip");
    expect(plan.imageFiles.map((file) => file.path)).toEqual([
      "web-icons/site_001_home_icon_16x8.png",
      "web-icons/site_001_home_icon_32x16.png",
    ]);
    expect(plan.imageFiles.map(({ width, height }) => ({ width, height }))).toEqual([
      { width: 16, height: 8 },
      { width: 32, height: 16 },
    ]);
    expect(plan.textFiles).toEqual([]);
  });

  it("多切片 Web 切图按切片分子目录且不生成配置文件", () => {
    const plan = buildWebExportPlan(
      [makeSlice({ name: "one" }), makeSlice({ id: "slice-2", name: "two" })],
      WEB_ICON_OUTPUTS.slice(0, 1),
      "site",
    );

    expect(plan.imageFiles.map((file) => file.path)).toEqual([
      "web-icons/one/site_001_one_16x16.png",
      "web-icons/two/site_002_two_16x16.png",
    ]);
    expect(plan.textFiles).toEqual([]);
  });

  it("Android 切图写入 res/mipmap-*，保持原比例且不生成 adaptive icon 配置", () => {
    const plan = buildAndroidExportPlan([makeSlice({ width: 120, height: 60 })], ANDROID_ICON_OUTPUTS, "app");

    expect(plan.imageFiles.map((file) => file.path).slice(0, 5)).toEqual([
      "android-res/res/mipmap-mdpi/app_001_home_icon_48x24.png",
      "android-res/res/mipmap-hdpi/app_001_home_icon_72x36.png",
      "android-res/res/mipmap-xhdpi/app_001_home_icon_96x48.png",
      "android-res/res/mipmap-xxhdpi/app_001_home_icon_144x72.png",
      "android-res/res/mipmap-xxxhdpi/app_001_home_icon_192x96.png",
    ]);
    expect(plan.textFiles).toEqual([]);
  });

  it("iOS 切图保持原比例且不生成 AppIcon 配置", () => {
    const plan = buildIosExportPlan([makeSlice({ width: 80, height: 120 })], IOS_ICON_OUTPUTS.slice(0, 2), "app");

    expect(plan.imageFiles.map((file) => file.path)).toEqual([
      "ios-icons/app_001_home_icon_27x40.png",
      "ios-icons/app_001_home_icon_40x60.png",
    ]);
    expect(plan.imageFiles.map(({ width, height }) => ({ width, height }))).toEqual([
      { width: 27, height: 40 },
      { width: 40, height: 60 },
    ]);
    expect(plan.textFiles).toEqual([]);
  });

  it("自定义资源包只导出启用尺寸，但预设 JSON 保留全部尺寸", () => {
    const allOutputs = [
      { id: "a", label: "A", width: 32, height: 32, fileName: "a" },
      { id: "b", label: "B", width: 64, height: 64, fileName: "b.png" },
    ];
    const plan = buildCustomExportPlan([makeSlice()], [allOutputs[0]], allOutputs, "source.png", "brand", "2026-01-01T00:00:00.000Z");
    const preset = JSON.parse(plan.textFiles.find((file) => file.path === "custom-icons/custom-preset.json")?.content ?? "{}");

    expect(plan.imageFiles.map((file) => file.path)).toEqual(["custom-icons/a.png"]);
    expect(preset).toEqual({
      version: 1,
      savedAt: "2026-01-01T00:00:00.000Z",
      outputs: allOutputs,
    });
  });

  it("导出预览显示文件数量、示例路径和平台警告", () => {
    const plan = buildWebExportPlan([makeSlice({ width: 48, height: 64 })], WEB_ICON_OUTPUTS, "site");
    const warnings = buildExportWarnings(
      {
        fileName: "source.png",
        fileSize: 100,
        mimeType: "image/png",
        width: 100,
        height: 100,
        hasAlpha: true,
        url: "blob:test",
      },
      [makeSlice({ width: 48, height: 64 })],
      "web",
      WEB_ICON_OUTPUTS,
    );
    const preview = buildExportPreview(plan, warnings);

    expect(preview.archiveName).toBe("site_web_icons.zip");
    expect(preview.imageCount).toBe(WEB_ICON_OUTPUTS.length);
    expect(preview.totalCount).toBe(preview.imageCount);
    expect(preview.samplePaths[0]).toBe("web-icons/site_001_home_icon_12x16.png");
    expect(preview.warnings).toEqual([]);
  });
});
