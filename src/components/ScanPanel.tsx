import { Pipette, ScanSearch } from "lucide-react";
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
  const startPickScanBackground = useWorkspaceStore((state) => state.startPickScanBackground);

  return (
    <details className="panel-section tree-panel" open>
      <summary>智能识别</summary>
      <div className="tree-body">
        <label className="field">
          识别方式
          <select onChange={(event) => setScanMode(event.target.value as ScanMode)} value={scanMode}>
            <option value="auto">智能自动：复杂背景优先识别显著图形</option>
            <option value="alpha">透明图：识别不透明区域</option>
            <option value="color">纯色底：按指定背景色识别</option>
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
        <summary>高级识别调节</summary>
        <div className="collapsible-body">
          {scanMode === "alpha" ? (
            <label className="field">
              透明阈值：数值越大，越容易忽略半透明阴影
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
            背景容差：数值越大，越容易把渐变背景当成背景
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
              最小面积：过滤碎屑和噪点
              <input
                min={1}
                onChange={(event) => setScanMinArea(parsePositiveInt(event.target.value, 1))}
                type="number"
                value={scanMinArea}
              />
            </label>
            <label>
              最小边长：过滤太细小的装饰
              <input
                min={1}
                onChange={(event) => setScanMinSize(parsePositiveInt(event.target.value, 1))}
                type="number"
                value={scanMinSize}
              />
            </label>
          </div>

          <label className="field">
            扩展边距：给识别到的图形多留一点边
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
              <option value="nearby">邻近合并：适合一个 icon 被拆成几块</option>
              <option value="row">同行合并：适合横向排列的小部件</option>
              <option value="none">不合并：保留最细碎结果</option>
            </select>
          </label>

          <div className="field-grid">
            <label>
              合并距离：越大越容易把近处图形合在一起
              <input
                min={0}
                onChange={(event) => setScanMergeDistance(parseNonNegativeInt(event.target.value))}
                type="number"
                value={scanMergeDistance}
              />
            </label>
            <label>
              桥接间隔：连接断开的细边和高光
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

      <p className="hint-text">建议先用“智能自动”。如果图片本身透明，用透明图；如果背景很干净，用纯色底并取一次背景色。</p>

      <div className="action-row single">
        <Hint fill text="按当前设置识别 icon，并直接追加为正式选区。识别错的结果可以在画布或切片列表中删除。">
          <button
            className="button"
            data-testid="scan-detect-preview"
            disabled={!imageDocument || isScanning}
            onClick={() => void detectIconSlices(false)}
            type="button"
          >
            <ScanSearch size={16} />
            {isScanning ? "识别中" : "识别并追加"}
          </button>
        </Hint>
      </div>
      </div>
    </details>
  );
}
