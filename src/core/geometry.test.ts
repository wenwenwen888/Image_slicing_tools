import { describe, expect, it } from "vitest";
import { clamp, normalizeRect, resizeSlice } from "./geometry";
import type { SliceRegion } from "./types";

const image = { width: 100, height: 80 };

function makeSlice(partial: Partial<SliceRegion> = {}): SliceRegion {
  return {
    id: "slice-1",
    name: "slice_1",
    x: 10,
    y: 10,
    width: 20,
    height: 16,
    enabled: true,
    locked: false,
    ...partial,
  };
}

describe("选区坐标转换", () => {
  it("把从右下往左上拖出的负宽高归一成正矩形", () => {
    expect(normalizeRect(40, 30, -20, -10, image)).toEqual({
      x: 20,
      y: 20,
      width: 20,
      height: 10,
    });
  });

  it("把超出图片边界的选区裁切回图片内", () => {
    expect(normalizeRect(-10, -8, 40, 30, image)).toEqual({
      x: 0,
      y: 0,
      width: 30,
      height: 22,
    });
    expect(normalizeRect(90, 70, 30, 20, image)).toEqual({
      x: 90,
      y: 70,
      width: 10,
      height: 10,
    });
  });

  it("宽或高为 0 时至少保留 1px", () => {
    expect(normalizeRect(5, 5, 0, 0, image)).toEqual({
      x: 5,
      y: 5,
      width: 1,
      height: 1,
    });
  });

  it("从东南角拉大选区并限制在图片内", () => {
    expect(resizeSlice(makeSlice(), "se", 10, 4, image)).toEqual({
      x: 10,
      y: 10,
      width: 30,
      height: 20,
    });
    expect(resizeSlice(makeSlice({ x: 90, y: 70, width: 8, height: 6 }), "se", 40, 40, image)).toEqual({
      x: 90,
      y: 70,
      width: 10,
      height: 10,
    });
  });

  it("从西北角缩小选区并换算新的原点", () => {
    expect(resizeSlice(makeSlice(), "nw", 4, 2, image)).toEqual({
      x: 14,
      y: 12,
      width: 16,
      height: 14,
    });
  });

  it("clamp 把值限制在闭区间内", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
