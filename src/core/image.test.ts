import { describe, expect, it } from "vitest";
import { removeBackgroundPixels } from "./image";

function createPixels(width: number, height: number, color = [255, 255, 255, 255]) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    pixels.set(color, index * 4);
  }
  return pixels;
}

function paintPixel(pixels: Uint8ClampedArray, width: number, x: number, y: number, color: number[]) {
  pixels.set(color, (y * width + x) * 4);
}

function paintHollowRect(
  pixels: Uint8ClampedArray,
  width: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
) {
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (x === left || x === right || y === top || y === bottom) {
        paintPixel(pixels, width, x, y, [20, 30, 40, 255]);
      }
    }
  }
}

describe("removeBackgroundPixels", () => {
  it("保留普通图标内部与背景同色的闭合区域", () => {
    const width = 15;
    const pixels = createPixels(width, 15);
    paintHollowRect(pixels, width, 4, 4, 10, 10);

    removeBackgroundPixels(pixels, width, 15, { color: "#ffffff", tolerance: 24 });

    expect(pixels[(1 * width + 1) * 4 + 3]).toBe(0);
    expect(pixels[(7 * width + 7) * 4 + 3]).toBe(255);
    expect(pixels[(4 * width + 7) * 4 + 3]).toBe(255);
  });

  it("只对具有多字符排列特征的内容清理闭合文字内孔", () => {
    const width = 29;
    const height = 13;
    const pixels = createPixels(width, height);
    paintHollowRect(pixels, width, 2, 2, 8, 10);
    paintHollowRect(pixels, width, 11, 2, 17, 10);
    paintHollowRect(pixels, width, 20, 2, 26, 10);

    removeBackgroundPixels(pixels, width, height, { color: "#ffffff", tolerance: 24 });

    expect(pixels[(1 * width + 1) * 4 + 3]).toBe(0);
    expect(pixels[(6 * width + 5) * 4 + 3]).toBe(0);
    expect(pixels[(6 * width + 14) * 4 + 3]).toBe(0);
    expect(pixels[(6 * width + 23) * 4 + 3]).toBe(0);
    expect(pixels[(2 * width + 5) * 4 + 3]).toBe(255);
  });

  it("只羽化透明边界附近的底色，不影响图标内部颜色", () => {
    const width = 13;
    const pixels = createPixels(width, 13, [8, 25, 42, 255]);
    for (let y = 3; y <= 9; y += 1) {
      for (let x = 3; x <= 9; x += 1) {
        paintPixel(pixels, width, x, y, [225, 30, 38, 255]);
      }
    }
    paintPixel(pixels, width, 3, 6, [90, 27, 40, 255]);

    removeBackgroundPixels(pixels, width, 13, { color: "#08192a", tolerance: 24 });

    expect(pixels[(1 * width + 1) * 4 + 3]).toBe(0);
    expect(pixels[(6 * width + 3) * 4 + 3]).toBeGreaterThan(0);
    expect(pixels[(6 * width + 3) * 4 + 3]).toBeLessThan(255);
    expect(pixels[(6 * width + 6) * 4 + 3]).toBe(255);
  });
});
