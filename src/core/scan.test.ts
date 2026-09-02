import { describe, expect, it } from "vitest";
import { findConnectedRegions } from "./scan";

function makeImageData(width: number, height: number, pixels: Array<[number, number]>) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y] of pixels) {
    const index = (y * width + x) * 4;
    data[index] = 20;
    data[index + 1] = 20;
    data[index + 2] = 20;
    data[index + 3] = 255;
  }

  return { data, width, height } as ImageData;
}

function makeRgbaImageData(
  width: number,
  height: number,
  getPixel: (x: number, y: number) => [number, number, number, number],
) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const [red, green, blue, alpha] = getPixel(x, y);
      data[index] = red;
      data[index + 1] = green;
      data[index + 2] = blue;
      data[index + 3] = alpha;
    }
  }

  return { data, width, height } as ImageData;
}

function rectPixels(x: number, y: number, width: number, height: number) {
  const pixels: Array<[number, number]> = [];
  for (let nextY = y; nextY < y + height; nextY += 1) {
    for (let nextX = x; nextX < x + width; nextX += 1) {
      pixels.push([nextX, nextY]);
    }
  }
  return pixels;
}

const baseOptions = {
  mode: "alpha" as const,
  alphaThreshold: 16,
  backgroundColor: "#ffffff",
  colorTolerance: 24,
  minArea: 1,
  minSize: 1,
  padding: 0,
  nameOffset: 0,
};

describe("智能识别增强", () => {
  it("可把相近区域合并成一个候选切片", () => {
    const imageData = makeImageData(30, 20, [...rectPixels(2, 2, 4, 4), ...rectPixels(9, 3, 4, 4)]);
    const regions = findConnectedRegions(imageData, {
      ...baseOptions,
      mergeStrategy: "nearby",
      mergeDistance: 4,
      bridgeGap: 0,
      ignoreText: false,
    });

    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ x: 2, y: 2, width: 11, height: 5 });
  });

  it("关闭文字识别时会过滤疑似文字长条", () => {
    const imageData = makeImageData(80, 20, rectPixels(2, 3, 50, 8));
    const regions = findConnectedRegions(imageData, {
      ...baseOptions,
      mergeStrategy: "none",
      bridgeGap: 0,
      ignoreText: true,
    });

    expect(regions).toHaveLength(0);
  });

  it("打开文字识别时保留疑似文字区域", () => {
    const imageData = makeImageData(80, 20, rectPixels(2, 3, 50, 8));
    const regions = findConnectedRegions(imageData, {
      ...baseOptions,
      mergeStrategy: "none",
      bridgeGap: 0,
      ignoreText: false,
    });

    expect(regions).toHaveLength(1);
  });

  it("复杂深色背景和大白卡片中优先识别彩色主体", () => {
    const imageData = makeRgbaImageData(140, 220, (x, y) => {
      const inWhiteCard = x >= 16 && x < 124 && y >= 52 && y < 205;
      const inGift = x >= 45 && x < 96 && y >= 92 && y < 145;
      const inRibbon = x >= 63 && x < 76 && y >= 84 && y < 150;
      const inCoin = (x - 40) ** 2 + (y - 160) ** 2 < 12 ** 2;
      const inButton = x >= 30 && x < 110 && y >= 176 && y < 197;
      const inText = x >= 38 && x < 100 && y >= 64 && y < 73;

      if (inGift) {
        return [224, 28, 34, 255];
      }
      if (inRibbon || inCoin || inButton) {
        return [245, 184, 18, 255];
      }
      if (inText) {
        return [8, 10, 35, 255];
      }
      if (inWhiteCard) {
        return [248, 246, 238, 255];
      }
      return [3, 16, 31, 255];
    });

    const regions = findConnectedRegions(imageData, {
      ...baseOptions,
      mode: "auto",
      minArea: 80,
      minSize: 6,
      padding: 2,
      mergeStrategy: "nearby",
      mergeDistance: 8,
      bridgeGap: 1,
      ignoreText: true,
    });

    expect(regions.some((region) => region.x <= 45 && region.y <= 92 && region.width >= 48 && region.height >= 50)).toBe(true);
    expect(regions.every((region) => region.width < 120 && region.height < 170)).toBe(true);
  });
});
