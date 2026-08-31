import { Download, FileUp, Plus, Trash2 } from "lucide-react";
import { ChangeEvent, useRef } from "react";
import { Hint } from "./Hint";
import { getExportSlices, getPlatformOutputCount } from "../core/export";
import { parsePositiveInt } from "../core/numbers";
import { ANDROID_ICON_OUTPUTS, IOS_ICON_OUTPUTS, WEB_ICON_OUTPUTS } from "../core/presets";
import type { ExportFormat, ExportScope, TargetPlatform } from "../core/types";
import { useWorkspaceStore } from "../store/workspace-store";

export function ExportPanel() {
  const customPresetInputRef = useRef<HTMLInputElement>(null);
  const imageDocument = useWorkspaceStore((state) => state.imageDocument);
  const errorMessage = useWorkspaceStore((state) => state.errorMessage);
  const slices = useWorkspaceStore((state) => state.slices);
  const selectedSliceId = useWorkspaceStore((state) => state.selectedSliceId);
  const exportScope = useWorkspaceStore((state) => state.exportScope);
  const filePrefix = useWorkspaceStore((state) => state.filePrefix);
  const targetPlatform = useWorkspaceStore((state) => state.targetPlatform);
  const exportFormat = useWorkspaceStore((state) => state.exportFormat);
  const enabledWebOutputIds = useWorkspaceStore((state) => state.enabledWebOutputIds);
  const enabledAndroidOutputIds = useWorkspaceStore((state) => state.enabledAndroidOutputIds);
  const enabledIosOutputIds = useWorkspaceStore((state) => state.enabledIosOutputIds);
  const androidResourceName = useWorkspaceStore((state) => state.androidResourceName);
  const jpgBackground = useWorkspaceStore((state) => state.jpgBackground);
  const customIconOutputs = useWorkspaceStore((state) => state.customIconOutputs);
  const enabledCustomOutputIds = useWorkspaceStore((state) => state.enabledCustomOutputIds);
  const isExporting = useWorkspaceStore((state) => state.isExporting);
  const setExportScope = useWorkspaceStore((state) => state.setExportScope);
  const setFilePrefix = useWorkspaceStore((state) => state.setFilePrefix);
  const setTargetPlatform = useWorkspaceStore((state) => state.setTargetPlatform);
  const setExportFormat = useWorkspaceStore((state) => state.setExportFormat);
  const setJpgBackground = useWorkspaceStore((state) => state.setJpgBackground);
  const setAndroidResourceName = useWorkspaceStore((state) => state.setAndroidResourceName);
  const toggleWebOutput = useWorkspaceStore((state) => state.toggleWebOutput);
  const toggleAndroidOutput = useWorkspaceStore((state) => state.toggleAndroidOutput);
  const toggleIosOutput = useWorkspaceStore((state) => state.toggleIosOutput);
  const toggleCustomOutput = useWorkspaceStore((state) => state.toggleCustomOutput);
  const updateCustomOutput = useWorkspaceStore((state) => state.updateCustomOutput);
  const addCustomOutput = useWorkspaceStore((state) => state.addCustomOutput);
  const removeCustomOutput = useWorkspaceStore((state) => state.removeCustomOutput);
  const openCustomPresetFile = useWorkspaceStore((state) => state.openCustomPresetFile);
  const saveCustomPresetFile = useWorkspaceStore((state) => state.saveCustomPresetFile);
  const handleExport = useWorkspaceStore((state) => state.handleExport);

  const exportSlices = getExportSlices(slices, exportScope, selectedSliceId);
  const platformOutputCount = getPlatformOutputCount(
    targetPlatform,
    WEB_ICON_OUTPUTS.filter((output) => enabledWebOutputIds.includes(output.id)).length,
    ANDROID_ICON_OUTPUTS.filter((output) => enabledAndroidOutputIds.includes(output.id)).length,
    IOS_ICON_OUTPUTS.filter((output) => enabledIosOutputIds.includes(output.id)).length,
    customIconOutputs.filter((output) => enabledCustomOutputIds.includes(output.id)).length,
  );

  async function handleCustomPresetFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      await openCustomPresetFile(file);
    }
    event.target.value = "";
  }

  return (
    <section className="panel-section">
      <h2>导出设置</h2>
      {errorMessage && (
        <div className="error-message compact" data-testid="error-message">
          {errorMessage}
        </div>
      )}
      <input
        accept="application/json,.json,.custom-preset.json"
        className="file-input"
        onChange={(event) => void handleCustomPresetFileChange(event)}
        ref={customPresetInputRef}
        type="file"
      />
      <label className="field">
        导出范围
        <select onChange={(event) => setExportScope(event.target.value as ExportScope)} value={exportScope}>
          <option value="enabled">全部启用切片</option>
          <option value="selected">当前选区</option>
        </select>
      </label>
      <label className="field">
        文件名前缀
        <input onChange={(event) => setFilePrefix(event.target.value)} placeholder="slice" value={filePrefix} />
      </label>
      <label className="field">
        目标平台
        <select
          data-testid="target-platform"
          onChange={(event) => setTargetPlatform(event.target.value as TargetPlatform)}
          value={targetPlatform}
        >
          <option value="generic">通用</option>
          <option value="android">Android</option>
          <option value="ios">iOS</option>
          <option value="web">Web</option>
          <option value="custom">自定义</option>
        </select>
      </label>
      <label className="field">
        输出格式
        <select
          disabled={targetPlatform !== "generic"}
          onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
          value={exportFormat}
        >
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
          <option value="webp">WebP</option>
        </select>
      </label>
      {targetPlatform === "web" && (
        <div className="web-preset-panel">
          <div className="hint-text">Web 资源包固定输出 PNG，并生成 favicon、PWA 和 HTML 配置片段。</div>
          <div className="web-output-list">
            {WEB_ICON_OUTPUTS.map((output) => (
              <label className="web-output-item" key={output.id}>
                <input
                  checked={enabledWebOutputIds.includes(output.id)}
                  onChange={(event) => toggleWebOutput(output.id, event.target.checked)}
                  type="checkbox"
                />
                <span>{output.label}</span>
                <strong>
                  {output.width} x {output.height}
                </strong>
              </label>
            ))}
          </div>
        </div>
      )}
      {targetPlatform === "android" && (
        <div className="web-preset-panel">
          <div className="hint-text">Android 资源包固定输出 PNG，默认放入 `res/mipmap-*` 目录。</div>
          <label className="field">
            资源名
            <input onChange={(event) => setAndroidResourceName(event.target.value)} value={androidResourceName} />
          </label>
          <div className="web-output-list">
            {ANDROID_ICON_OUTPUTS.map((output) => (
              <label className="web-output-item" key={output.id}>
                <input
                  checked={enabledAndroidOutputIds.includes(output.id)}
                  onChange={(event) => toggleAndroidOutput(output.id, event.target.checked)}
                  type="checkbox"
                />
                <span>{output.label}</span>
                <strong>
                  {output.width} x {output.height}
                </strong>
              </label>
            ))}
          </div>
        </div>
      )}
      {targetPlatform === "ios" && (
        <div className="web-preset-panel">
          <div className="hint-text">iOS 资源包固定输出 PNG，并生成 `AppIcon.appiconset/Contents.json`。</div>
          <div className="web-output-list">
            {IOS_ICON_OUTPUTS.map((output) => (
              <label className="web-output-item" key={output.id}>
                <input
                  checked={enabledIosOutputIds.includes(output.id)}
                  onChange={(event) => toggleIosOutput(output.id, event.target.checked)}
                  type="checkbox"
                />
                <span>{output.label}</span>
                <strong>
                  {output.width} x {output.height}
                </strong>
              </label>
            ))}
          </div>
        </div>
      )}
      {targetPlatform === "custom" && (
        <div className="web-preset-panel">
          <div className="hint-text">自定义资源包固定输出 PNG，适合保存项目专用尺寸或交付给不同平台。</div>
          <div className="action-row">
            <Hint fill text="打开已保存的自定义尺寸预设。">
              <button className="button" onClick={() => customPresetInputRef.current?.click()} type="button">
                <FileUp size={16} />
                打开预设
              </button>
            </Hint>
            <Hint fill text="把当前自定义尺寸保存成预设文件。">
              <button className="button" onClick={() => void saveCustomPresetFile()} type="button">
                <Download size={16} />
                保存预设
              </button>
            </Hint>
          </div>
          <div className="custom-output-list">
            {customIconOutputs.map((output) => (
              <div className="custom-output-item" key={output.id}>
                <label className="custom-output-enabled">
                  <input
                    checked={enabledCustomOutputIds.includes(output.id)}
                    onChange={(event) => toggleCustomOutput(output.id, event.target.checked)}
                    type="checkbox"
                  />
                  启用
                </label>
                <label>
                  名称
                  <input onChange={(event) => updateCustomOutput(output.id, { label: event.target.value })} value={output.label} />
                </label>
                <div className="field-grid">
                  <label>
                    宽
                    <input
                      min={1}
                      onChange={(event) => updateCustomOutput(output.id, { width: parsePositiveInt(event.target.value, 1) })}
                      type="number"
                      value={output.width}
                    />
                  </label>
                  <label>
                    高
                    <input
                      min={1}
                      onChange={(event) => updateCustomOutput(output.id, { height: parsePositiveInt(event.target.value, 1) })}
                      type="number"
                      value={output.height}
                    />
                  </label>
                </div>
                <label>
                  文件名
                  <input onChange={(event) => updateCustomOutput(output.id, { fileName: event.target.value })} value={output.fileName} />
                </label>
                <Hint text="从自定义资源包里去掉这个尺寸。">
                  <button
                    className="mini-button danger"
                    disabled={customIconOutputs.length <= 1}
                    onClick={() => removeCustomOutput(output.id)}
                    type="button"
                  >
                    <Trash2 size={14} />
                    删除
                  </button>
                </Hint>
              </div>
            ))}
          </div>
          <Hint fill text="新增一个自定义导出尺寸。">
            <button className="button export-panel-button" onClick={addCustomOutput} type="button">
              <Plus size={16} />
              添加尺寸
            </button>
          </Hint>
        </div>
      )}
      {targetPlatform === "generic" && exportFormat === "jpg" && (
        <label className="field">
          JPG 背景色
          <input onChange={(event) => setJpgBackground(event.target.value)} type="color" value={jpgBackground} />
        </label>
      )}
      <Hint fill text="按当前平台和范围导出切片。没有切片或未勾选输出尺寸时不可用。">
      <button
        className="button export-panel-button"
        disabled={!imageDocument || exportSlices.length === 0 || platformOutputCount === 0 || isExporting}
        onClick={() => void handleExport()}
        type="button"
      >
        <Download size={16} />
        {isExporting
          ? "正在导出"
          : targetPlatform === "web"
            ? `导出 Web 资源包`
            : targetPlatform === "android"
              ? "导出 Android 资源包"
              : targetPlatform === "ios"
                ? "导出 iOS 资源包"
                : `导出 ${exportSlices.length} 个切片`}
      </button>
      </Hint>
    </section>
  );
}
