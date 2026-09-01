import { describe, expect, it } from "vitest";
import { findOpaqueBounds } from "./trim";

function makeImageData(width: number, height: number, opaquePixels: Array<[number, number, number?]>) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y, alpha = 255] of opaquePixels) {
    data[(y * width + x) * 4 + 3] = alpha;
  }

  return { data, width, height } as ImageData;
}

describe("透明边收紧", () => {
  it("按 alpha 找到最小不透明边界", () => {
    const bounds = findOpaqueBounds(
      makeImageData(6, 5, [
        [2, 1],
        [4, 1],
        [3, 3],
      ]),
      16,
    );

    expect(bounds).toEqual({ x: 2, y: 1, width: 3, height: 3 });
  });

  it("忽略低于阈值的半透明像素", () => {
    const bounds = findOpaqueBounds(
      makeImageData(4, 4, [
        [0, 0, 8],
        [2, 2, 64],
      ]),
      16,
    );

    expect(bounds).toEqual({ x: 2, y: 2, width: 1, height: 1 });
  });

  it("完全透明时返回空", () => {
    expect(findOpaqueBounds(makeImageData(3, 3, []), 16)).toBeNull();
  });
});
