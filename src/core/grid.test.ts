import { describe, expect, it } from "vitest";
import { buildGridSlices } from "./grid";

const imageSize = { width: 100, height: 80 };

describe("网格生成", () => {
  it("按固定尺寸、起点和间距生成切片", () => {
    const slices = buildGridSlices({
      imageSize,
      mode: "fixed",
      cellWidth: 20,
      cellHeight: 10,
      startX: 10,
      startY: 5,
      gapX: 5,
      gapY: 5,
      rows: 2,
      columns: 2,
      order: "row",
      nameOffset: 0,
    });

    expect(slices).toHaveLength(4);
    expect(slices.map((slice) => ({ x: slice.x, y: slice.y, width: slice.width, height: slice.height }))).toEqual([
      { x: 10, y: 5, width: 20, height: 10 },
      { x: 35, y: 5, width: 20, height: 10 },
      { x: 10, y: 20, width: 20, height: 10 },
      { x: 35, y: 20, width: 20, height: 10 },
    ]);
    expect(slices.map((slice) => slice.name)).toEqual([
      "grid_r1_c1_001",
      "grid_r1_c2_002",
      "grid_r2_c1_003",
      "grid_r2_c2_004",
    ]);
  });

  it("按行列均分整张图", () => {
    const slices = buildGridSlices({
      imageSize,
      mode: "equal",
      cellWidth: 999,
      cellHeight: 999,
      startX: 50,
      startY: 50,
      gapX: 8,
      gapY: 8,
      rows: 2,
      columns: 4,
      order: "row",
      nameOffset: 0,
    });

    expect(slices).toHaveLength(8);
    expect(slices[0]).toMatchObject({ x: 0, y: 0, width: 25, height: 40 });
    expect(slices[1]).toMatchObject({ x: 25, y: 0, width: 25, height: 40 });
    expect(slices[4]).toMatchObject({ x: 0, y: 40, width: 25, height: 40 });
  });

  it("列优先编号与行优先顺序不同", () => {
    const rowFirst = buildGridSlices({
      imageSize,
      mode: "fixed",
      cellWidth: 10,
      cellHeight: 10,
      startX: 0,
      startY: 0,
      gapX: 0,
      gapY: 0,
      rows: 2,
      columns: 2,
      order: "row",
      nameOffset: 0,
    });
    const columnFirst = buildGridSlices({
      imageSize,
      mode: "fixed",
      cellWidth: 10,
      cellHeight: 10,
      startX: 0,
      startY: 0,
      gapX: 0,
      gapY: 0,
      rows: 2,
      columns: 2,
      order: "column",
      nameOffset: 0,
    });

    expect(rowFirst.map((slice) => slice.name)).toEqual([
      "grid_r1_c1_001",
      "grid_r1_c2_002",
      "grid_r2_c1_003",
      "grid_r2_c2_004",
    ]);
    expect(columnFirst.map((slice) => slice.name)).toEqual([
      "grid_r1_c1_001",
      "grid_r2_c1_002",
      "grid_r1_c2_003",
      "grid_r2_c2_004",
    ]);
  });

  it("丢弃超出图片范围的格子", () => {
    const slices = buildGridSlices({
      imageSize,
      mode: "fixed",
      cellWidth: 80,
      cellHeight: 80,
      startX: 0,
      startY: 0,
      gapX: 0,
      gapY: 0,
      rows: 2,
      columns: 2,
      order: "row",
      nameOffset: 3,
    });

    expect(slices).toHaveLength(1);
    expect(slices[0]).toMatchObject({
      name: "grid_r1_c1_004",
      x: 0,
      y: 0,
      width: 80,
      height: 80,
    });
  });
});
