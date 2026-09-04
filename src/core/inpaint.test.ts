import { describe, expect, it } from "vitest";
import { inpaintRegion } from "./inpaint";

describe("inpaintRegion", () => {
  it("用选区四周像素恢复二维渐变并移除覆盖内容", () => {
    const width = 40;
    const height = 30;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        data[offset] = 30 + x * 3 + y;
        data[offset + 1] = 80 + x + y * 2;
        data[offset + 2] = 140 + x * 2;
        data[offset + 3] = 255;
      }
    }

    for (let y = 10; y < 20; y += 1) {
      for (let x = 12; x < 29; x += 1) {
        const offset = (y * width + x) * 4;
        data[offset] = 255;
        data[offset + 1] = 255;
        data[offset + 2] = 255;
      }
    }

    const imageData = { data, width, height, colorSpace: "srgb" } as ImageData;
    inpaintRegion(imageData, { x: 10, y: 8, width: 21, height: 14 }, 3);

    const center = (15 * width + 20) * 4;
    expect(Array.from(imageData.data.slice(center, center + 4))).toEqual([105, 130, 180, 255]);
    expect(Array.from(imageData.data.slice(0, 4))).toEqual([30, 80, 140, 255]);
  });

  it("不会把边界附近的窄色带扩散成横向痕迹", () => {
    const width = 80;
    const height = 50;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        data[offset] = 246 + Math.round(x / 30);
        data[offset + 1] = 244 + Math.round(y / 25);
        data[offset + 2] = 242;
        data[offset + 3] = 255;
      }
    }

    for (let x = 20; x < 60; x += 1) {
      const offset = (39 * width + x) * 4;
      data[offset] = 250;
      data[offset + 1] = 190;
      data[offset + 2] = 40;
    }

    for (let y = 18; y < 32; y += 1) {
      for (let x = 28; x < 52; x += 1) {
        const offset = (y * width + x) * 4;
        data[offset] = 30;
        data[offset + 1] = 30;
        data[offset + 2] = 30;
      }
    }

    const imageData = { data, width, height, colorSpace: "srgb" } as ImageData;
    inpaintRegion(imageData, { x: 18, y: 14, width: 44, height: 24 }, 7);

    for (let x = 22; x < 58; x += 4) {
      const offset = (34 * width + x) * 4;
      expect(imageData.data[offset + 1]).toBeGreaterThan(238);
      expect(imageData.data[offset + 2]).toBeGreaterThan(235);
    }
  });

  it("会沿用上下邻域中可见的非线性渐变", () => {
    const width = 100;
    const height = 60;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        data[offset] = 120 + Math.round(Math.sin(x / 8) * 70);
        data[offset + 1] = 80 + Math.round(x * 1.2);
        data[offset + 2] = 160 - Math.round(Math.cos(x / 11) * 50);
        data[offset + 3] = 255;
      }
    }

    for (let y = 18; y < 44; y += 1) {
      for (let x = 20; x < 80; x += 1) {
        const offset = (y * width + x) * 4;
        data[offset] = 10;
        data[offset + 1] = 10;
        data[offset + 2] = 10;
      }
    }

    const imageData = { data, width, height, colorSpace: "srgb" } as ImageData;
    inpaintRegion(imageData, { x: 18, y: 16, width: 64, height: 30 }, 6);

    for (const x of [28, 52, 72]) {
      const restored = imageData.data[(30 * width + x) * 4];
      const expected = 120 + Math.round(Math.sin(x / 8) * 70);
      expect(Math.abs(restored - expected)).toBeLessThanOrEqual(5);
    }
  });
});
