import { Eraser, Pipette } from "lucide-react";
import { useWorkspaceStore } from "../store/workspace-store";
import { Hint } from "./Hint";

export function BrushPanel() {
  const brushColor = useWorkspaceStore((state) => state.brushColor);
  const brushSize = useWorkspaceStore((state) => state.brushSize);
  const isPickingBrushColor = useWorkspaceStore((state) => state.isPickingBrushColor);
  const setBrushColor = useWorkspaceStore((state) => state.setBrushColor);
  const setBrushSize = useWorkspaceStore((state) => state.setBrushSize);
  const startPickBrushColor = useWorkspaceStore((state) => state.startPickBrushColor);

  return (
    <section className="edit-tool-panel" data-testid="brush-panel">
      <h3>画笔设置</h3>
      <label className="field">
        画笔颜色
        <div className="color-picker-row">
          <input data-testid="brush-color" onChange={(event) => setBrushColor(event.target.value)} type="color" value={brushColor} />
          <Hint text="点击后到图片上吸取一个颜色。">
            <button className="mini-button" data-testid="brush-pick-color" onClick={startPickBrushColor} type="button">
              <Pipette size={14} />
              {isPickingBrushColor ? "取色中" : "吸取颜色"}
            </button>
          </Hint>
        </div>
      </label>
      <label className="field">
        画笔大小：{brushSize}px
        <div className="brush-size-row">
          <input
            data-testid="brush-size"
            max={240}
            min={1}
            onChange={(event) => setBrushSize(Number(event.target.value))}
            type="range"
            value={brushSize}
          />
          <input
            aria-label="画笔大小数值"
            max={240}
            min={1}
            onChange={(event) => setBrushSize(Number(event.target.value))}
            type="number"
            value={brushSize}
          />
        </div>
      </label>
      <p className="hint-text">设置完成后直接在图片上按住并拖动。笔迹会写入当前图片，也会用于后续识别、切片和导出。</p>
    </section>
  );
}

export function SmartErasePanel() {
  const selection = useWorkspaceStore((state) => state.smartEraseSelection);
  const isApplyingImageEdit = useWorkspaceStore((state) => state.isApplyingImageEdit);
  const applySmartEraseSelection = useWorkspaceStore((state) => state.applySmartEraseSelection);
  const setSmartEraseSelection = useWorkspaceStore((state) => state.setSmartEraseSelection);

  return (
    <section className="edit-tool-panel" data-testid="smart-erase-panel">
      <h3>智能消除</h3>
      <p className="hint-text">在图片上框住要去掉的文字或瑕疵，并在四周保留少量干净背景。工具会沿横向和纵向重建渐变。</p>
      <div className="erase-selection-info" data-testid="smart-erase-selection-info">
        {selection ? `${selection.width} x ${selection.height}，位置 ${selection.x}, ${selection.y}` : "尚未框选消除区域"}
      </div>
      <div className="action-row">
        <button
          className="button primary"
          data-testid="apply-smart-erase"
          disabled={!selection || isApplyingImageEdit}
          onClick={() => void applySmartEraseSelection()}
          type="button"
        >
          <Eraser size={16} />
          {isApplyingImageEdit ? "正在补全" : "一键智能消除"}
        </button>
        <button
          className="button secondary"
          disabled={!selection || isApplyingImageEdit}
          onClick={() => setSmartEraseSelection(null)}
          type="button"
        >
          清除框选
        </button>
      </div>
    </section>
  );
}
