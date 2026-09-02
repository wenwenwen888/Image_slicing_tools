import { Download, FileUp, Pipette, Plus, Trash2 } from "lucide-react";
import { ChangeEvent, useRef } from "react";
import { Hint } from "./Hint";
import { buildPreviewForExport, getExportSlices, getPlatformOutputCount } from "../core/export";
import { translate } from "../core/i18n";
import { parseNonNegativeInt, parsePositiveInt } from "../core/numbers";
import { ANDROID_ICON_OUTPUTS, IOS_ICON_OUTPUTS, WEB_ICON_OUTPUTS } from "../core/presets";
import type { ExportFormat, ExportMode, ExportScope, TargetPlatform } from "../core/types";
import { isTauriRuntime } from "../platform/runtime";
import { useWorkspaceStore } from "../store/workspace-store";

export function ExportPanel() {
  const customPresetInputRef = useRef<HTMLInputElement>(null);
  const language = useWorkspaceStore((state) => state.language);
  const imageDocument = useWorkspaceStore((state) => state.imageDocument);
  const errorMessage = useWorkspaceStore((state) => state.errorMessage);
  const slices = useWorkspaceStore((state) => state.slices);
  const selectedSliceId = useWorkspaceStore((state) => state.selectedSliceId);
  const exportScope = useWorkspaceStore((state) => state.exportScope);
  const filePrefix = useWorkspaceStore((state) => state.filePrefix);
  const targetPlatform = useWorkspaceStore((state) => state.targetPlatform);
  const exportFormat = useWorkspaceStore((state) => state.exportFormat);
  const exportMode = useWorkspaceStore((state) => state.exportMode);
  const lastExportDirectory = useWorkspaceStore((state) => state.lastExportDirectory);
  const enabledWebOutputIds = useWorkspaceStore((state) => state.enabledWebOutputIds);
  const enabledAndroidOutputIds = useWorkspaceStore((state) => state.enabledAndroidOutputIds);
  const enabledIosOutputIds = useWorkspaceStore((state) => state.enabledIosOutputIds);
  const androidResourceName = useWorkspaceStore((state) => state.androidResourceName);
  const jpgBackground = useWorkspaceStore((state) => state.jpgBackground);
  const exportTransparentBackground = useWorkspaceStore((state) => state.exportTransparentBackground);
  const scanBackgroundColor = useWorkspaceStore((state) => state.scanBackgroundColor);
  const scanColorTolerance = useWorkspaceStore((state) => state.scanColorTolerance);
  const isPickingScanBackground = useWorkspaceStore((state) => state.isPickingScanBackground);
  const customIconOutputs = useWorkspaceStore((state) => state.customIconOutputs);
  const enabledCustomOutputIds = useWorkspaceStore((state) => state.enabledCustomOutputIds);
  const isExporting = useWorkspaceStore((state) => state.isExporting);
  const setExportScope = useWorkspaceStore((state) => state.setExportScope);
  const setFilePrefix = useWorkspaceStore((state) => state.setFilePrefix);
  const setTargetPlatform = useWorkspaceStore((state) => state.setTargetPlatform);
  const setExportFormat = useWorkspaceStore((state) => state.setExportFormat);
  const setExportMode = useWorkspaceStore((state) => state.setExportMode);
  const setJpgBackground = useWorkspaceStore((state) => state.setJpgBackground);
  const setExportTransparentBackground = useWorkspaceStore((state) => state.setExportTransparentBackground);
  const setScanBackgroundColor = useWorkspaceStore((state) => state.setScanBackgroundColor);
  const setScanColorTolerance = useWorkspaceStore((state) => state.setScanColorTolerance);
  const startPickExportBackground = useWorkspaceStore((state) => state.startPickExportBackground);
  const toggleWebOutput = useWorkspaceStore((state) => state.toggleWebOutput);
  const toggleAndroidOutput = useWorkspaceStore((state) => state.toggleAndroidOutput);
  const toggleIosOutput = useWorkspaceStore((state) => state.toggleIosOutput);
  const toggleCustomOutput = useWorkspaceStore((state) => state.toggleCustomOutput);
  const updateCustomOutput = useWorkspaceStore((state) => state.updateCustomOutput);
  const addCustomOutput = useWorkspaceStore((state) => state.addCustomOutput);
  const removeCustomOutput = useWorkspaceStore((state) => state.removeCustomOutput);
  const openCustomPresetFile = useWorkspaceStore((state) => state.openCustomPresetFile);
  const saveCustomPresetFile = useWorkspaceStore((state) => state.saveCustomPresetFile);
  const openLastExportDirectory = useWorkspaceStore((state) => state.openLastExportDirectory);
  const handleExport = useWorkspaceStore((state) => state.handleExport);
  const isDesktop = isTauriRuntime();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  const exportSlices = getExportSlices(slices, exportScope, selectedSliceId);
  const exportPreview = buildPreviewForExport({
    imageDocument,
    slices,
    exportScope,
    selectedSliceId,
    targetPlatform,
    enabledWebOutputIds,
    enabledAndroidOutputIds,
    enabledIosOutputIds,
    enabledCustomOutputIds,
    customIconOutputs,
    androidResourceName,
    filePrefix,
    exportFormat,
  });
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
    <details className="panel-section tree-panel" open>
      <summary>{t("exportSettings")}</summary>
      <div className="tree-body">
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
        {t("exportScope")}
        <select onChange={(event) => setExportScope(event.target.value as ExportScope)} value={exportScope}>
          <option value="enabled">{t("allEnabledSlices")}</option>
          <option value="selected">{t("currentSelection")}</option>
        </select>
      </label>
      <label className="field">
        {t("filePrefix")}
        <input onChange={(event) => setFilePrefix(event.target.value)} placeholder="slice" value={filePrefix} />
      </label>
      <label className="field">
        {t("targetPlatform")}
        <select
          data-testid="target-platform"
          onChange={(event) => setTargetPlatform(event.target.value as TargetPlatform)}
          value={targetPlatform}
        >
          <option value="generic">{t("generic")}</option>
          <option value="android">Android</option>
          <option value="ios">iOS</option>
          <option value="web">Web</option>
          <option value="custom">{t("custom")}</option>
        </select>
      </label>
      <label className="field">
        {t("outputFormat")}
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
      <label className="field">
        {t("exportMode")}
        <select
          disabled={!isDesktop}
          onChange={(event) => setExportMode(event.target.value as ExportMode)}
          value={isDesktop ? exportMode : "zip"}
        >
          <option value="zip">{t("zipFile")}</option>
          <option value="folder">{t("desktopFolder")}</option>
        </select>
      </label>
      {!isDesktop && <div className="hint-text">{t("webZipHint")}</div>}
      {targetPlatform === "generic" && exportFormat === "jpg" && (
        <label className="field">
          {t("jpgBackground")}
          <input onChange={(event) => setJpgBackground(event.target.value)} type="color" value={jpgBackground} />
        </label>
      )}
      <details className="collapsible-panel" open>
        <summary>{t("transparentBackground")}</summary>
        <div className="collapsible-body">
          <label className="scan-toggle">
            <input
              checked={exportTransparentBackground}
              data-testid="export-transparent-background"
              onChange={(event) => setExportTransparentBackground(event.target.checked)}
              type="checkbox"
            />
            {t("smartTransparentBackground")}
          </label>
          <div className="color-picker-row">
            <label>
              {t("backgroundColor")}
              <input
                data-testid="export-background-color"
                disabled={!exportTransparentBackground}
                onChange={(event) => setScanBackgroundColor(event.target.value)}
                type="color"
                value={scanBackgroundColor}
              />
            </label>
            <Hint text={t("pickExportBackgroundHint")}>
              <button
                className="mini-button"
                data-testid="export-pick-background"
                disabled={!imageDocument || !exportTransparentBackground}
                onClick={startPickExportBackground}
                type="button"
              >
                <Pipette size={14} />
                {isPickingScanBackground ? t("pickingColor") : t("pickColor")}
              </button>
            </Hint>
          </div>
          <label className="field">
            {t("toleranceLabel")}
            <input
              disabled={!exportTransparentBackground}
              max={255}
              min={0}
              onChange={(event) => setScanColorTolerance(Math.max(0, Math.min(parseNonNegativeInt(event.target.value), 255)))}
              type="number"
              value={scanColorTolerance}
            />
          </label>
          <div className="hint-text">{t("transparentHint")}</div>
        </div>
      </details>
      <details className="collapsible-panel">
        <summary>{t("platformSizesAndPreview")}</summary>
        <div className="collapsible-body">
          {targetPlatform === "web" && (
            <div className="web-preset-panel">
              <div className="hint-text">{t("webPresetHint")}</div>
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
              <div className="hint-text">{t("androidPresetHint")}</div>
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
              <div className="hint-text">{t("iosPresetHint")}</div>
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
              <div className="hint-text">{t("customPresetHint")}</div>
              <div className="action-row">
                <Hint fill text={t("openPreset")}>
                  <button className="button" onClick={() => customPresetInputRef.current?.click()} type="button">
                    <FileUp size={16} />
                    {t("openPreset")}
                  </button>
                </Hint>
                <Hint fill text={t("savePreset")}>
                  <button className="button" onClick={() => void saveCustomPresetFile()} type="button">
                    <Download size={16} />
                    {t("savePreset")}
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
                      {t("enabled")}
                    </label>
                    <label>
                      {t("name")}
                      <input onChange={(event) => updateCustomOutput(output.id, { label: event.target.value })} value={output.label} />
                    </label>
                    <div className="field-grid">
                      <label>
                        {t("width")}
                        <input
                          min={1}
                          onChange={(event) => updateCustomOutput(output.id, { width: parsePositiveInt(event.target.value, 1) })}
                          type="number"
                          value={output.width}
                        />
                      </label>
                      <label>
                        {t("height")}
                        <input
                          min={1}
                          onChange={(event) => updateCustomOutput(output.id, { height: parsePositiveInt(event.target.value, 1) })}
                          type="number"
                          value={output.height}
                        />
                      </label>
                    </div>
                    <label>
                      {t("fileName")}
                      <input
                        onChange={(event) => updateCustomOutput(output.id, { fileName: event.target.value })}
                        value={output.fileName}
                      />
                    </label>
                    <Hint text={t("delete")}>
                      <button
                        className="mini-button danger"
                        disabled={customIconOutputs.length <= 1}
                        onClick={() => removeCustomOutput(output.id)}
                        type="button"
                      >
                        <Trash2 size={14} />
                        {t("delete")}
                      </button>
                    </Hint>
                  </div>
                ))}
              </div>
              <Hint fill text={t("addSize")}>
                <button className="button export-panel-button" onClick={addCustomOutput} type="button">
                  <Plus size={16} />
                  {t("addSize")}
                </button>
              </Hint>
            </div>
          )}
          {exportPreview && (
            <div className="export-preview">
              <div className="export-preview-summary">
                <strong>
                  {exportMode === "folder" && isDesktop ? exportPreview.archiveName.replace(/\.zip$/i, "") : exportPreview.archiveName}
                </strong>
                <span>
                  {language === "zh"
                    ? `${exportPreview.imageCount} ${t("imagesCount")}`
                    : `${exportPreview.imageCount} ${t("imagesCount")}`}
                  {exportPreview.textCount > 0 ? ` + ${exportPreview.textCount} ${t("configFilesCount")}` : ""}
                </span>
              </div>
              {exportPreview.warnings.length > 0 && (
                <div className="export-warning-list">
                  {exportPreview.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              )}
              <div className="export-file-list">
                {exportPreview.samplePaths.map((path) => (
                  <span key={path}>{path}</span>
                ))}
                {exportPreview.totalCount > exportPreview.samplePaths.length && (
                  <span>
                    {language === "zh"
                      ? `${t("moreFiles")} ${exportPreview.totalCount - exportPreview.samplePaths.length} ${t("files")}`
                      : `${t("moreFiles")} ${exportPreview.totalCount - exportPreview.samplePaths.length} ${t("files")}`}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </details>
      <Hint fill text={t("exportHint")}>
        <button
          className="button export-panel-button"
          disabled={!imageDocument || exportSlices.length === 0 || platformOutputCount === 0 || isExporting}
          onClick={() => void handleExport()}
          type="button"
        >
          <Download size={16} />
          {isExporting
            ? t("exporting")
            : targetPlatform === "web"
              ? t("exportWebSlices")
              : targetPlatform === "android"
                ? t("exportAndroidSlices")
                : targetPlatform === "ios"
                  ? t("exportIosSlices")
                  : targetPlatform === "custom"
                    ? t("exportCustomPackage")
                    : language === "zh"
                      ? `导出 ${exportSlices.length} 个切片`
                      : `Export ${exportSlices.length} slices`}
        </button>
      </Hint>
      {isDesktop && lastExportDirectory && (
        <Hint fill text={t("openExportDirectory")}>
          <button className="button secondary export-panel-button" onClick={() => void openLastExportDirectory()} type="button">
            {t("openExportDirectory")}
          </button>
        </Hint>
      )}
      </div>
    </details>
  );
}
