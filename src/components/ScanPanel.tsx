import { Pipette, Trash2 } from "lucide-react";
import { clamp } from "../core/geometry";
import { parseNonNegativeInt, parsePositiveInt } from "../core/numbers";
import type { ScanMergeStrategy, ScanMode } from "../core/types";
import { useWorkspaceStore } from "../store/workspace-store";
import { Hint } from "./Hint";

export function ScanPanel() {
  const imageDocument = useWorkspaceStore((state) => state.imageDocument);
  const isScanning = useWorkspaceStore((state) => state.isScanning);
  const scanMode = useWorkspaceStore((state) => state.scanMode);
  const scanAlphaThreshold = useWorkspaceStore((state) => state.scanAlphaThreshold);
  const scanBackgroundColor = useWorkspaceStore((state) => state.scanBackgroundColor);
  const scanColorTolerance = useWorkspaceStore((state) => state.scanColorTolerance);
  const scanMinArea = useWorkspaceStore((state) => state.scanMinArea);
  const scanMinSize = useWorkspaceStore((state) => state.scanMinSize);
  const scanPadding = useWorkspaceStore((state) => state.scanPadding);
  const scanMergeStrategy = useWorkspaceStore((state) => state.scanMergeStrategy);
  const scanMergeDistance = useWorkspaceStore((state) => state.scanMergeDistance);
  const scanBridgeGap = useWorkspaceStore((state) => state.scanBridgeGap);
  const scanIgnoreText = useWorkspaceStore((state) => state.scanIgnoreText);
  const scanPreviewSlices = useWorkspaceStore((state) => state.scanPreviewSlices);
  const isPickingScanBackground = useWorkspaceStore((state) => state.isPickingScanBackground);
  const setScanMode = useWorkspaceStore((state) => state.setScanMode);
  const setScanAlphaThreshold = useWorkspaceStore((state) => state.setScanAlphaThreshold);
  const setScanBackgroundColor = useWorkspaceStore((state) => state.setScanBackgroundColor);
  const setScanColorTolerance = useWorkspaceStore((state) => state.setScanColorTolerance);
  const setScanMinArea = useWorkspaceStore((state) => state.setScanMinArea);
  const setScanMinSize = useWorkspaceStore((state) => state.setScanMinSize);
  const setScanPadding = useWorkspaceStore((state) => state.setScanPadding);
  const setScanMergeStrategy = useWorkspaceStore((state) => state.setScanMergeStrategy);
  const setScanMergeDistance = useWorkspaceStore((state) => state.setScanMergeDistance);
  const setScanBridgeGap = useWorkspaceStore((state) => state.setScanBridgeGap);
  const setScanIgnoreText = useWorkspaceStore((state) => state.setScanIgnoreText);
  const detectIconSlices = useWorkspaceStore((state) => state.detectIconSlices);
  const applyScanPreview = useWorkspaceStore((state) => state.applyScanPreview);
  const removeScanPreviewSlice = useWorkspaceStore((state) => state.removeScanPreviewSlice);
  const clearScanPreview = useWorkspaceStore((state) => state.clearScanPreview);
  const startPickScanBackground = useWorkspaceStore((state) => state.startPickScanBackground);

  return (
    <details className="panel-section tree-panel" open>
      <summary>智能识别</summary>
      <div className="tree-body">
        <label className="field">
          识别方式
          <select onChange={(event) => setScanMode(event.target.value as ScanMode)} value={scanMode}>
            <option value="auto">自动识别</option>
            <option value="alpha">透明背景</option>
            <option value="color">纯色背景</option>
          </select>
        </label>

        {scanMode !== "alpha" && (
          <label className="field">
            背景色
            <div className="color-picker-row">
              <input
                data-testid="scan-background-color"
                onChange={(event) => setScanBackgroundColor(event.target.value)}
                type="color"
                value={scanBackgroundColor}
              />
              <Hint text="从画布点击取背景色。">
                <button
                  className="mini-button"
                  data-testid="scan-pick-background"
                  disabled={!imageDocument}
                  onClick={startPickScanBackground}
                  type="button"
                >
                  <Pipette size={14} />
                  {isPickingScanBackground ? "取色中" : "取色"}
                </button>
              </Hint>
            </div>
          </label>
        )}

      <details className="collapsible-panel">
        <summary>识别参数</summary>
        <div className="collapsible-body">
          {scanMode === "alpha" ? (
            <label className="field">
              透明阈值
              <input
                max={255}
                min={0}
                onChange={(event) => setScanAlphaThreshold(clamp(parseNonNegativeInt(event.target.value), 0, 255))}
                type="number"
                value={scanAlphaThreshold}
              />
            </label>
          ) : (
          <label className="field">
            颜色容差
            <input
              max={255}
              min={0}
              onChange={(event) => setScanColorTolerance(clamp(parseNonNegativeInt(event.target.value), 0, 255))}
              type="number"
              value={scanColorTolerance}
            />
          </label>
          )}

          <div className="field-grid">
            <label>
              最小面积
              <input
                min={1}
                onChange={(event) => setScanMinArea(parsePositiveInt(event.target.value, 1))}
                type="number"
                value={scanMinArea}
              />
            </label>
            <label>
              最小边长
              <input
                min={1}
                onChange={(event) => setScanMinSize(parsePositiveInt(event.target.value, 1))}
                type="number"
                value={scanMinSize}
              />
            </label>
          </div>

          <label className="field">
            扩展边距
            <input
              min={0}
              onChange={(event) => setScanPadding(parseNonNegativeInt(event.target.value))}
              type="number"
              value={scanPadding}
            />
          </label>

          <label className="field">
            合并策略
            <select onChange={(event) => setScanMergeStrategy(event.target.value as ScanMergeStrategy)} value={scanMergeStrategy}>
              <option value="nearby">邻近合并</option>
              <option value="row">同行合并</option>
              <option value="none">不合并</option>
            </select>
          </label>

          <div className="field-grid">
            <label>
              合并距离
              <input
                min={0}
                onChange={(event) => setScanMergeDistance(parseNonNegativeInt(event.target.value))}
                type="number"
                value={scanMergeDistance}
              />
            </label>
            <label>
              桥接间隔
              <input
                max={8}
                min={0}
                onChange={(event) => setScanBridgeGap(clamp(parseNonNegativeInt(event.target.value), 0, 8))}
                type="number"
                value={scanBridgeGap}
              />
            </label>
          </div>

          <label className="scan-toggle">
            <input
              checked={!scanIgnoreText}
              data-testid="scan-include-text"
              onChange={(event) => setScanIgnoreText(!event.target.checked)}
              type="checkbox"
            />
            识别文字区域
          </label>
        </div>
      </details>

      <p className="hint-text">透明背景会识别非透明图形；纯色背景会识别与背景色差异明显的区域。</p>

      <div className="action-row">
        <Hint fill text="按当前识别参数生成预览，不会立即改动正式切片。">
          <button
            className="button"
            data-testid="scan-detect-preview"
            disabled={!imageDocument || isScanning}
            onClick={() => void detectIconSlices(true)}
            type="button"
          >
            生成预览
          </button>
        </Hint>
        <Hint fill text="清空当前预览结果。">
          <button
            className="button secondary"
            data-testid="scan-clear-preview"
            disabled={scanPreviewSlices.length === 0}
            onClick={clearScanPreview}
            type="button"
          >
            清空预览
          </button>
        </Hint>
      </div>

        {scanPreviewSlices.length > 0 && (
          <div className="scan-preview-panel">
          <div className="scan-preview-header">
            <strong>{scanPreviewSlices.length} 个候选区域</strong>
            <span>可先删除误识别项</span>
          </div>
          <div className="scan-preview-list">
            {scanPreviewSlices.slice(0, 8).map((slice) => (
              <div className="scan-preview-item" data-testid="scan-preview-item" key={slice.id}>
                <span>
                  {slice.name} · {slice.width} x {slice.height}
                </span>
                <Hint text="移除这个误识别区域。">
                  <button
                    className="mini-button danger"
                    data-testid="scan-remove-preview-item"
                    onClick={() => removeScanPreviewSlice(slice.id)}
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </Hint>
              </div>
            ))}
            {scanPreviewSlices.length > 8 && <span className="hint-text">还有 {scanPreviewSlices.length - 8} 个候选区域</span>}
          </div>
          <div className="action-row">
            <Hint fill text="用预览结果替换正式切片。">
              <button className="button" data-testid="scan-apply-replace" onClick={() => applyScanPreview(true)} type="button">
                替换应用
              </button>
            </Hint>
            <Hint fill text="把预览结果追加到正式切片。">
              <button className="button" data-testid="scan-apply-append" onClick={() => applyScanPreview(false)} type="button">
                追加应用
              </button>
            </Hint>
          </div>
          </div>
        )}
      </div>
    </details>
  );
}
