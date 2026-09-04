import { describe, expect, it } from "vitest";
import { detectForegroundOverlays, reconstructLargeOverlay } from "./background-cleanup";

describe("detectForegroundOverlays", () => {
  it("识别中央亮色弹窗和顶部状态元素", () => {
    const width = 200;
    const height = 320;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let index = 0; index < data.length; index += 4) {
      data[index] = 8;
      data[index + 1] = 24;
      data[index + 2] = 45;
      data[index + 3] = 255;
    }

    fill(data, width, 12, 10, 24, 8, [245, 245, 245, 255]);
    fill(data, width, 150, 10, 34, 8, [245, 245, 245, 255]);
    fill(data, width, 20, 78, 160, 210, [248, 246, 242, 255]);
    fill(data, width, 64, 130, 72, 80, [210, 35, 42, 255]);

    const regions = detectForegroundOverlays({ data, width, height, colorSpace: "srgb" } as ImageData, 640);
    const dialog = regions.find((region) => region.kind === "dialog");
    const statuses = regions.filter((region) => region.kind === "status");

    expect(dialog).toBeTruthy();
    expect(dialog!.x).toBeLessThanOrEqual(20);
    expect(dialog!.width).toBeGreaterThanOrEqual(160);
    expect(statuses.length).toBeGreaterThanOrEqual(2);
  });
});

describe("reconstructLargeOverlay", () => {
  it("从左右背景延续纹理，而不是把整块填成单色", () => {
    const width = 80;
    const height = 40;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        data[offset] = 30 + y * 3;
        data[offset + 1] = 20 + ((x + y * 2) % 18) * 5;
        data[offset + 2] = 80 + y;
        data[offset + 3] = 255;
      }
    }
    for (let y = 8; y < 34; y += 1) {
      for (let x = 16; x < 64; x += 1) {
        const offset = (y * width + x) * 4;
        data[offset] = 250;
        data[offset + 1] = 250;
        data[offset + 2] = 250;
      }
    }

    const imageData = { data, width, height, colorSpace: "srgb" } as ImageData;
    reconstructLargeOverlay(imageData, { x: 14, y: 6, width: 52, height: 30 });

    const upper = imageData.data[(10 * width + 40) * 4];
    const lower = imageData.data[(30 * width + 40) * 4];
    expect(lower - upper).toBeGreaterThan(45);
    expect(imageData.data[(20 * width + 40) * 4]).toBeLessThan(200);
  });
});

function fill(
  data: Uint8ClampedArray,
  imageWidth: number,
  x: number,
  y: number,
  width: number,
  height: number,
  color: [number, number, number, number],
) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      const offset = (row * imageWidth + column) * 4;
      data.set(color, offset);
    }
  }
}
