import type { GridMode, GridOrder, ImageSize, SliceRegion } from "./types";

export function buildGridSlices({
  imageSize,
  mode,
  cellWidth,
  cellHeight,
  startX,
  startY,
  gapX,
  gapY,
  rows,
  columns,
  order,
  nameOffset,
}: {
  imageSize: ImageSize;
  mode: GridMode;
  cellWidth: number;
  cellHeight: number;
  startX: number;
  startY: number;
  gapX: number;
  gapY: number;
  rows: number;
  columns: number;
  order: GridOrder;
  nameOffset: number;
}) {
  const normalizedRows = Math.max(Math.round(rows), 1);
  const normalizedColumns = Math.max(Math.round(columns), 1);
  const normalizedCellWidth =
    mode === "equal" ? Math.floor(imageSize.width / normalizedColumns) : Math.max(Math.round(cellWidth), 1);
  const normalizedCellHeight =
    mode === "equal" ? Math.floor(imageSize.height / normalizedRows) : Math.max(Math.round(cellHeight), 1);
  const normalizedStartX = mode === "equal" ? 0 : Math.max(Math.round(startX), 0);
  const normalizedStartY = mode === "equal" ? 0 : Math.max(Math.round(startY), 0);
  const normalizedGapX = mode === "equal" ? 0 : Math.max(Math.round(gapX), 0);
  const normalizedGapY = mode === "equal" ? 0 : Math.max(Math.round(gapY), 0);
  const positions: Array<{ row: number; column: number }> = [];

  if (order === "row") {
    for (let row = 0; row < normalizedRows; row += 1) {
      for (let column = 0; column < normalizedColumns; column += 1) {
        positions.push({ row, column });
      }
    }
  } else {
    for (let column = 0; column < normalizedColumns; column += 1) {
      for (let row = 0; row < normalizedRows; row += 1) {
        positions.push({ row, column });
      }
    }
  }

  return positions
    .map((position): SliceRegion | null => {
      const x = normalizedStartX + position.column * (normalizedCellWidth + normalizedGapX);
      const y = normalizedStartY + position.row * (normalizedCellHeight + normalizedGapY);

      if (
        x < 0 ||
        y < 0 ||
        x + normalizedCellWidth > imageSize.width ||
        y + normalizedCellHeight > imageSize.height
      ) {
        return null;
      }

      return {
        id: crypto.randomUUID(),
        name: `grid_r${position.row + 1}_c${position.column + 1}`,
        x,
        y,
        width: normalizedCellWidth,
        height: normalizedCellHeight,
        enabled: true,
        locked: false,
      };
    })
    .filter((slice): slice is SliceRegion => Boolean(slice))
    .map((slice, index) => ({
      ...slice,
      name: `${slice.name}_${String(nameOffset + index + 1).padStart(3, "0")}`,
    }));
}
