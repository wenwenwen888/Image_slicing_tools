import { parseNonNegativeInt, parsePositiveInt } from "../core/numbers";
import type { GridMode, GridOrder } from "../core/types";
import { useWorkspaceStore } from "../store/workspace-store";
import { Hint } from "./Hint";

export function GridPanel() {
  const imageDocument = useWorkspaceStore((state) => state.imageDocument);
  const gridMode = useWorkspaceStore((state) => state.gridMode);
  const gridWidth = useWorkspaceStore((state) => state.gridWidth);
  const gridHeight = useWorkspaceStore((state) => state.gridHeight);
  const gridStartX = useWorkspaceStore((state) => state.gridStartX);
  const gridStartY = useWorkspaceStore((state) => state.gridStartY);
  const gridGapX = useWorkspaceStore((state) => state.gridGapX);
  const gridGapY = useWorkspaceStore((state) => state.gridGapY);
  const gridRows = useWorkspaceStore((state) => state.gridRows);
  const gridColumns = useWorkspaceStore((state) => state.gridColumns);
  const gridOrder = useWorkspaceStore((state) => state.gridOrder);
  const setGridMode = useWorkspaceStore((state) => state.setGridMode);
  const setGridWidth = useWorkspaceStore((state) => state.setGridWidth);
  const setGridHeight = useWorkspaceStore((state) => state.setGridHeight);
  const setGridStartX = useWorkspaceStore((state) => state.setGridStartX);
  const setGridStartY = useWorkspaceStore((state) => state.setGridStartY);
  const setGridGapX = useWorkspaceStore((state) => state.setGridGapX);
  const setGridGapY = useWorkspaceStore((state) => state.setGridGapY);
  const setGridRows = useWorkspaceStore((state) => state.setGridRows);
  const setGridColumns = useWorkspaceStore((state) => state.setGridColumns);
  const setGridOrder = useWorkspaceStore((state) => state.setGridOrder);
  const generateGridSlices = useWorkspaceStore((state) => state.generateGridSlices);

  return (
    <section className="panel-section">
      <h2>网格切图</h2>
      <label className="field">
        生成方式
        <select data-testid="grid-mode" onChange={(event) => setGridMode(event.target.value as GridMode)} value={gridMode}>
          <option value="fixed">固定尺寸</option>
          <option value="equal">按行列均分</option>
        </select>
      </label>

      <div className="field-grid">
        <label>
          行数
          <input min={1} onChange={(event) => setGridRows(parsePositiveInt(event.target.value, 1))} type="number" value={gridRows} />
        </label>
        <label>
          列数
          <input
            min={1}
            onChange={(event) => setGridColumns(parsePositiveInt(event.target.value, 1))}
            type="number"
            value={gridColumns}
          />
        </label>
      </div>

      {gridMode === "fixed" && (
        <>
          <div className="field-grid">
            <label>
              宽
              <input
                min={1}
                onChange={(event) => setGridWidth(parsePositiveInt(event.target.value, 1))}
                type="number"
                value={gridWidth}
              />
            </label>
            <label>
              高
              <input
                min={1}
                onChange={(event) => setGridHeight(parsePositiveInt(event.target.value, 1))}
                type="number"
                value={gridHeight}
              />
            </label>
          </div>

          <div className="field-grid">
            <label>
              起点 X
              <input
                min={0}
                onChange={(event) => setGridStartX(parseNonNegativeInt(event.target.value))}
                type="number"
                value={gridStartX}
              />
            </label>
            <label>
              起点 Y
              <input
                min={0}
                onChange={(event) => setGridStartY(parseNonNegativeInt(event.target.value))}
                type="number"
                value={gridStartY}
              />
            </label>
          </div>

          <div className="field-grid">
            <label>
              横向间距
              <input min={0} onChange={(event) => setGridGapX(parseNonNegativeInt(event.target.value))} type="number" value={gridGapX} />
            </label>
            <label>
              纵向间距
              <input min={0} onChange={(event) => setGridGapY(parseNonNegativeInt(event.target.value))} type="number" value={gridGapY} />
            </label>
          </div>
        </>
      )}

      <label className="field">
        编号顺序
        <select onChange={(event) => setGridOrder(event.target.value as GridOrder)} value={gridOrder}>
          <option value="row">按行优先</option>
          <option value="column">按列优先</option>
        </select>
      </label>

      <div className="action-row">
        <Hint fill text="清空现有切片，按当前网格设置重新生成。">
          <button className="button" disabled={!imageDocument} onClick={() => generateGridSlices(true)} type="button">
            替换生成
          </button>
        </Hint>
        <Hint fill text="保留现有切片，再按当前网格追加一批。">
          <button className="button" disabled={!imageDocument} onClick={() => generateGridSlices(false)} type="button">
            追加生成
          </button>
        </Hint>
      </div>
    </section>
  );
}
