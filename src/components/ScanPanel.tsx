import { clamp } from "../core/geometry";
import { parseNonNegativeInt, parsePositiveInt } from "../core/numbers";
import type { ScanMode } from "../core/types";
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
  const setScanMode = useWorkspaceStore((state) => state.setScanMode);
  const setScanAlphaThreshold = useWorkspaceStore((state) => state.setScanAlphaThreshold);
  const setScanBackgroundColor = useWorkspaceStore((state) => state.setScanBackgroundColor);
  const setScanColorTolerance = useWorkspaceStore((state) => state.setScanColorTolerance);
  const setScanMinArea = useWorkspaceStore((state) => state.setScanMinArea);
  const setScanMinSize = useWorkspaceStore((state) => state.setScanMinSize);
  const setScanPadding = useWorkspaceStore((state) => state.setScanPadding);
  const detectIconSlices = useWorkspaceStore((state) => state.detectIconSlices);

  return (
    <section className="panel-section">
      <h2>智能识别</h2>
      <label className="field">
        识别方式
        <select onChange={(event) => setScanMode(event.target.value as ScanMode)} value={scanMode}>
          <option value="auto">自动识别</option>
          <option value="alpha">透明背景</option>
          <option value="color">纯色背景</option>
        </select>
      </label>

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
        <>
          <label className="field">
            背景色
            <input onChange={(event) => setScanBackgroundColor(event.target.value)} type="color" value={scanBackgroundColor} />
          </label>
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
        </>
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

      <p className="hint-text">透明背景会识别非透明图形；纯色背景会识别与背景色差异明显的区域。</p>

      <div className="action-row">
        <Hint fill text="清空现有切片，按当前识别参数重新扫描。">
          <button className="button" disabled={!imageDocument || isScanning} onClick={() => void detectIconSlices(true)} type="button">
            替换识别
          </button>
        </Hint>
        <Hint fill text="保留现有切片，把新识别到的区域追加进去。">
          <button className="button" disabled={!imageDocument || isScanning} onClick={() => void detectIconSlices(false)} type="button">
            追加识别
          </button>
        </Hint>
      </div>
    </section>
  );
}
