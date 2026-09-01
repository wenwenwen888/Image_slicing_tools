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
});
