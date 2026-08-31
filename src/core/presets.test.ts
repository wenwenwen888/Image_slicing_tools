import { describe, expect, it } from "vitest";
import { ANDROID_ICON_OUTPUTS, IOS_ICON_OUTPUTS, WEB_ICON_OUTPUTS } from "./presets";

describe("平台 icon 尺寸配置", () => {
  it("包含 Web favicon、Apple touch、PWA 和 maskable 常用尺寸", () => {
    expect(WEB_ICON_OUTPUTS.map((output) => `${output.width}x${output.height}`)).toEqual([
      "16x16",
      "32x32",
      "48x48",
      "180x180",
      "192x192",
      "512x512",
      "512x512",
    ]);
    expect(WEB_ICON_OUTPUTS.find((output) => output.id === "pwa-192")?.purpose).toBe("any");
    expect(WEB_ICON_OUTPUTS.find((output) => output.id === "maskable-512")?.purpose).toBe("maskable");
    expect(WEB_ICON_OUTPUTS.every((output) => output.fileName.endsWith(".png"))).toBe(true);
  });

  it("Android density 按 mdpi 48px 基准倍率生成 mipmap 目录", () => {
    expect(
      ANDROID_ICON_OUTPUTS.map((output) => ({
        density: output.density,
        width: output.width,
        directory: output.directory,
      })),
    ).toEqual([
      { density: "mdpi", width: 48, directory: "mipmap-mdpi" },
      { density: "hdpi", width: 72, directory: "mipmap-hdpi" },
      { density: "xhdpi", width: 96, directory: "mipmap-xhdpi" },
      { density: "xxhdpi", width: 144, directory: "mipmap-xxhdpi" },
      { density: "xxxhdpi", width: 192, directory: "mipmap-xxxhdpi" },
    ]);
    expect(ANDROID_ICON_OUTPUTS.every((output) => output.width === output.height)).toBe(true);
  });

  it("iOS 输出宽高等于逻辑尺寸乘以 scale", () => {
    for (const output of IOS_ICON_OUTPUTS) {
      const logical = Number.parseFloat(output.size.split("x")[0]);
      const scale = Number.parseInt(output.scale, 10);
      expect(output.width).toBeCloseTo(logical * scale, 5);
      expect(output.height).toBe(output.width);
      expect(output.fileName.endsWith(".png")).toBe(true);
    }

    expect(IOS_ICON_OUTPUTS.some((output) => output.idiom === "iphone")).toBe(true);
    expect(IOS_ICON_OUTPUTS.some((output) => output.idiom === "ipad")).toBe(true);
    expect(IOS_ICON_OUTPUTS.some((output) => output.id === "app-store-1024" && output.width === 1024)).toBe(true);
  });
});
