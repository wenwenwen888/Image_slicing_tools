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

  it("单切片 Web 资源包包含多尺寸 PNG、manifest 和 HTML 片段", () => {
    const plan = buildWebExportPlan([makeSlice()], WEB_ICON_OUTPUTS, "source.png", "site");

    expect(plan.archiveName).toBe("site_web_icons.zip");
    expect(plan.imageFiles.map((file) => file.path)).toEqual([
      "web-icons/favicon-16x16.png",
      "web-icons/favicon-32x32.png",
      "web-icons/favicon-48x48.png",
      "web-icons/apple-touch-icon.png",
      "web-icons/icon-192x192.png",
      "web-icons/icon-512x512.png",
      "web-icons/maskable-icon-512x512.png",
    ]);

    const manifest = JSON.parse(plan.textFiles.find((file) => file.path === "web-icons/manifest-icons.json")?.content ?? "{}");
    expect(manifest.icons).toEqual([
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);

    const html = plan.textFiles.find((file) => file.path === "web-icons/html-links.txt")?.content ?? "";
    expect(html).toContain('rel="icon"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(plan.textFiles.some((file) => file.path === "web-icons/export-report.md")).toBe(true);
  });

  it("多切片 Web 资源包按切片分子目录且不生成站点配置片段", () => {
    const plan = buildWebExportPlan(
      [makeSlice({ name: "one" }), makeSlice({ id: "slice-2", name: "two" })],
      WEB_ICON_OUTPUTS.slice(0, 1),
      "source.png",
      "site",
    );

    expect(plan.imageFiles.map((file) => file.path)).toEqual([
      "web-icons/one/favicon-16x16.png",
      "web-icons/two/favicon-16x16.png",
    ]);
    expect(plan.textFiles.map((file) => file.path)).toEqual(["web-icons/export-report.md"]);
  });

  it("Android 资源包写入 res/mipmap-* 并清理资源名", () => {
    const plan = buildAndroidExportPlan([makeSlice()], ANDROID_ICON_OUTPUTS, "source.png", "app", "2 Home Icon");

    expect(plan.imageFiles.map((file) => file.path).slice(0, 5)).toEqual([
      "android-res/res/mipmap-mdpi/ic_2_home_icon.png",
      "android-res/res/mipmap-hdpi/ic_2_home_icon.png",
      "android-res/res/mipmap-xhdpi/ic_2_home_icon.png",
      "android-res/res/mipmap-xxhdpi/ic_2_home_icon.png",
      "android-res/res/mipmap-xxxhdpi/ic_2_home_icon.png",
    ]);
    expect(plan.imageFiles.map((file) => file.path)).toContain("android-res/res/mipmap-xxxhdpi/ic_2_home_icon_foreground.png");
    expect(plan.textFiles.map((file) => file.path)).toContain("android-res/res/mipmap-anydpi-v26/ic_launcher.xml");
    expect(plan.textFiles.map((file) => file.path)).toContain("android-res/res/values/ic_2_home_icon_background.xml");
    expect(plan.textFiles.find((file) => file.path === "android-res/export-report.md")?.content).toContain(
      "Resource name: ic_2_home_icon",
    );
  });

  it("iOS 资源包生成 AppIcon.appiconset 和 Contents.json", () => {
    const plan = buildIosExportPlan([makeSlice()], IOS_ICON_OUTPUTS, "source.png", "app");
    const contents = JSON.parse(
      plan.textFiles.find((file) => file.path === "Assets.xcassets/AppIcon.appiconset/Contents.json")?.content ?? "{}",
    );

    expect(plan.imageFiles).toHaveLength(IOS_ICON_OUTPUTS.length);
    expect(plan.imageFiles[0]?.path).toBe("Assets.xcassets/AppIcon.appiconset/iphone-notification-20@2x.png");
    expect(contents.images).toHaveLength(IOS_ICON_OUTPUTS.length);
    expect(contents.images[0]).toEqual({
      filename: "iphone-notification-20@2x.png",
      idiom: "iphone",
      size: "20x20",
      scale: "2x",
    });
    expect(contents.info).toEqual({ author: "xcode", version: 1 });
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
    const plan = buildWebExportPlan([makeSlice({ width: 48, height: 64 })], WEB_ICON_OUTPUTS, "source.png", "site");
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
    expect(preview.totalCount).toBeGreaterThan(preview.imageCount);
    expect(preview.samplePaths[0]).toBe("web-icons/favicon-16x16.png");
    expect(preview.warnings[0]).toContain("maskable icon");
  });
});
