import { Crop, Trash2 } from "lucide-react";
import { clamp } from "../core/geometry";
import { parseNonNegativeInt } from "../core/numbers";
import type { AspectRatioPreset, SliceShape } from "../core/types";
import { useWorkspaceStore } from "../store/workspace-store";
import { Hint } from "./Hint";

export function SliceEditor() {
  const slices = useWorkspaceStore((state) => state.slices);
  const selectedSliceId = useWorkspaceStore((state) => state.selectedSliceId);
  const deleteSlice = useWorkspaceStore((state) => state.deleteSlice);
  const pushHistory = useWorkspaceStore((state) => state.pushHistory);
  const updateSlice = useWorkspaceStore((state) => state.updateSlice);
  const handleNumericChange = useWorkspaceStore((state) => state.handleNumericChange);
  const trimSelectedSlice = useWorkspaceStore((state) => state.trimSelectedSlice);
  const trimAllSlices = useWorkspaceStore((state) => state.trimAllSlices);
  const defaultSliceShape = useWorkspaceStore((state) => state.defaultSliceShape);
  const defaultCornerRadius = useWorkspaceStore((state) => state.defaultCornerRadius);
  const aspectRatioPreset = useWorkspaceStore((state) => state.aspectRatioPreset);
  const setDefaultSliceShape = useWorkspaceStore((state) => state.setDefaultSliceShape);
  const setDefaultCornerRadius = useWorkspaceStore((state) => state.setDefaultCornerRadius);
  const setAspectRatioPreset = useWorkspaceStore((state) => state.setAspectRatioPreset);
  const selectedSlice = slices.find((slice) => slice.id === selectedSliceId) ?? null;
  const selectedShape = selectedSlice?.shape ?? defaultSliceShape;
  const selectedCornerRadius = selectedSlice?.cornerRadius ?? defaultCornerRadius;

  return (
    <details className="panel-section tree-panel">
      <summary>当前选区</summary>
      <div className="tree-body">
        <div className="panel-heading">
          <span className="panel-subtitle">{selectedSlice ? selectedSlice.name : "未选择"}</span>
          <Hint text="删除当前选中的切片，可用撤销找回。">
            <button
              className="mini-button danger"
              disabled={!selectedSlice}
              onClick={() => selectedSlice && deleteSlice(selectedSlice.id)}
              type="button"
            >
              <Trash2 size={14} />
              删除
            </button>
          </Hint>
        </div>

        <label className="field">
          名称
          <input
            disabled={!selectedSlice}
            onChange={(event) => {
              if (!selectedSlice) {
                return;
              }

              pushHistory();
              updateSlice(selectedSlice.id, { name: event.target.value });
            }}
            value={selectedSlice?.name ?? ""}
          />
        </label>

        <div className="field-grid">
          <label>
            X
            <input
              disabled={!selectedSlice}
              onChange={(event) => handleNumericChange("x", event.target.value)}
              type="number"
              value={selectedSlice?.x ?? 0}
            />
          </label>
          <label>
            Y
            <input
              disabled={!selectedSlice}
              onChange={(event) => handleNumericChange("y", event.target.value)}
              type="number"
              value={selectedSlice?.y ?? 0}
            />
          </label>
          <label>
            宽
            <input
              disabled={!selectedSlice}
              min={1}
              onChange={(event) => handleNumericChange("width", event.target.value)}
              type="number"
              value={selectedSlice?.width ?? 0}
            />
          </label>
          <label>
            高
            <input
              disabled={!selectedSlice}
              min={1}
              onChange={(event) => handleNumericChange("height", event.target.value)}
              type="number"
              value={selectedSlice?.height ?? 0}
            />
          </label>
        </div>

        <details className="collapsible-panel">
          <summary>更多选区设置</summary>
          <div className="collapsible-body">
            <div className="field-grid">
              <label>
                形状
                <select
                  data-testid="slice-shape"
                  onChange={(event) => {
                    const shape = event.target.value as SliceShape;
                    setDefaultSliceShape(shape);
                    if (!selectedSlice) {
                      return;
                    }

                    pushHistory();
                    updateSlice(selectedSlice.id, {
                      shape,
                      cornerRadius: shape === "rounded" ? selectedCornerRadius : selectedSlice.cornerRadius,
                    });
                  }}
                  value={selectedShape}
                >
                  <option value="rect">矩形</option>
                  <option value="rounded">圆角矩形</option>
                  <option value="ellipse">圆形/椭圆</option>
                </select>
              </label>
              <label>
                圆角
                <input
                  disabled={selectedShape !== "rounded"}
                  min={0}
                  onChange={(event) => {
                    const cornerRadius = clamp(parseNonNegativeInt(event.target.value), 0, 999);
                    setDefaultCornerRadius(cornerRadius);
                    if (!selectedSlice) {
                      return;
                    }

                    pushHistory();
                    updateSlice(selectedSlice.id, { cornerRadius });
                  }}
                  type="number"
                  value={selectedCornerRadius}
                />
              </label>
            </div>

            <label className="field">
              绘制比例
              <select
                data-testid="aspect-ratio-preset"
                onChange={(event) => setAspectRatioPreset(event.target.value as AspectRatioPreset)}
                value={aspectRatioPreset}
              >
                <option value="free">自由</option>
                <option value="1:1">1:1</option>
                <option value="4:3">4:3</option>
                <option value="16:9">16:9</option>
                <option value="3:2">3:2</option>
              </select>
            </label>

            <div className="toggle-row">
              <label>
                <input
                  checked={selectedSlice?.enabled ?? false}
                  disabled={!selectedSlice}
                  onChange={(event) => {
                    if (!selectedSlice) {
                      return;
                    }

                    pushHistory();
                    updateSlice(selectedSlice.id, { enabled: event.target.checked });
                  }}
                  type="checkbox"
                />
                启用导出
              </label>
              <label>
                <input
                  checked={selectedSlice?.locked ?? false}
                  disabled={!selectedSlice}
                  onChange={(event) => {
                    if (!selectedSlice) {
                      return;
                    }

                    pushHistory();
                    updateSlice(selectedSlice.id, { locked: event.target.checked });
                  }}
                  type="checkbox"
                />
                锁定
              </label>
            </div>
            <div className="action-row slice-action-row">
              <Hint fill text="按透明像素边界收紧当前切片。">
                <button className="button secondary" disabled={!selectedSlice} onClick={() => void trimSelectedSlice()} type="button">
                  <Crop size={16} />
                  收紧当前
                </button>
              </Hint>
              <Hint fill text="批量收紧全部未锁定切片。">
                <button className="button secondary" disabled={slices.length === 0} onClick={() => void trimAllSlices()} type="button">
                  <Crop size={16} />
                  收紧全部
                </button>
              </Hint>
            </div>
          </div>
        </details>
      </div>
    </details>
  );
}
