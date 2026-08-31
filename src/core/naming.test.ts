import { describe, expect, it } from "vitest";
import {
  buildFileName,
  getExtension,
  isValidAndroidResourceName,
  sanitizeAndroidResourceName,
  sanitizeCustomOutputFileName,
  sanitizeFileName,
} from "./naming";
import type { SliceRegion } from "./types";

const slice: SliceRegion = {
  id: "slice-1",
  name: "按钮/主态.png",
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  enabled: true,
  locked: false,
};

describe("命名规则", () => {
  it("清理文件名中的非法字符、扩展名和大小写", () => {
    expect(sanitizeFileName("  Icon Set.PNG  ")).toBe("icon_set");
    expect(sanitizeFileName("按钮 状态@2x!")).toBe("按钮_状态_2x");
    expect(sanitizeFileName("___")).toBe("slice");
  });

  it("按前缀、序号和切片名生成导出文件名", () => {
    expect(buildFileName("My Icons", slice, 3)).toBe("my_icons_003_按钮_主态");
    expect(buildFileName("", { ...slice, name: "" }, 1)).toBe("slice_001_slice_1");
  });

  it("规范化 Android 资源名并拒绝非法值", () => {
    expect(sanitizeAndroidResourceName("Ic Launcher")).toBe("ic_launcher");
    expect(sanitizeAndroidResourceName("2home")).toBe("ic_2home");
    expect(sanitizeAndroidResourceName("***")).toBe("ic_launcher");
    expect(isValidAndroidResourceName("ic_launcher")).toBe(true);
    expect(isValidAndroidResourceName("2home")).toBe(false);
    expect(isValidAndroidResourceName("Ic_Launcher")).toBe(false);
  });

  it("给自定义输出补上 png 扩展名", () => {
    expect(sanitizeCustomOutputFileName("app-icon", 64, 64)).toBe("app-icon.png");
    expect(sanitizeCustomOutputFileName("logo.png", 128, 128)).toBe("logo.png");
  });

  it("导出扩展名与格式一致", () => {
    expect(getExtension("png")).toBe("png");
    expect(getExtension("jpg")).toBe("jpg");
    expect(getExtension("webp")).toBe("webp");
  });
});
