import { Download, FileUp, FolderOpen, Redo2, Save, Undo2, XCircle, ZoomIn, ZoomOut } from "lucide-react";
import { ChangeEvent, useRef } from "react";
import appIcon from "../assets/app-icon.png";
import { Hint } from "./Hint";
import { ImageInfoPanel } from "./ImageInfoPanel";
import { SettingsPanel } from "./SettingsPanel";
import { getExportSlices, getPlatformOutputCount } from "../core/export";
import { translate } from "../core/i18n";
import { ANDROID_ICON_OUTPUTS, IOS_ICON_OUTPUTS, WEB_ICON_OUTPUTS } from "../core/presets";
import { useWorkspaceStore } from "../store/workspace-store";

export function TopBar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const language = useWorkspaceStore((state) => state.language);
  const imageDocument = useWorkspaceStore((state) => state.imageDocument);
  const zoom = useWorkspaceStore((state) => state.zoom);
  const pastSlices = useWorkspaceStore((state) => state.pastSlices);
  const futureSlices = useWorkspaceStore((state) => state.futureSlices);
  const slices = useWorkspaceStore((state) => state.slices);
  const selectedSliceId = useWorkspaceStore((state) => state.selectedSliceId);
  const exportScope = useWorkspaceStore((state) => state.exportScope);
  const targetPlatform = useWorkspaceStore((state) => state.targetPlatform);
  const enabledWebOutputIds = useWorkspaceStore((state) => state.enabledWebOutputIds);
  const enabledAndroidOutputIds = useWorkspaceStore((state) => state.enabledAndroidOutputIds);
  const enabledIosOutputIds = useWorkspaceStore((state) => state.enabledIosOutputIds);
  const enabledCustomOutputIds = useWorkspaceStore((state) => state.enabledCustomOutputIds);
  const customIconOutputs = useWorkspaceStore((state) => state.customIconOutputs);
  const isExporting = useWorkspaceStore((state) => state.isExporting);
  const changeZoom = useWorkspaceStore((state) => state.changeZoom);
  const fitToWindow = useWorkspaceStore((state) => state.fitToWindow);
  const undo = useWorkspaceStore((state) => state.undo);
  const redo = useWorkspaceStore((state) => state.redo);
  const handleOpenImageClick = useWorkspaceStore((state) => state.handleOpenImageClick);
  const openFile = useWorkspaceStore((state) => state.openFile);
  const openProjectFile = useWorkspaceStore((state) => state.openProjectFile);
  const saveProjectFile = useWorkspaceStore((state) => state.saveProjectFile);
  const handleExport = useWorkspaceStore((state) => state.handleExport);
  const closeCurrentImage = useWorkspaceStore((state) => state.closeCurrentImage);

  const zoomLabel = `${Math.round(zoom * 100)}%`;
  const exportSlices = getExportSlices(slices, exportScope, selectedSliceId);
  const platformOutputCount = getPlatformOutputCount(
    targetPlatform,
    WEB_ICON_OUTPUTS.filter((output) => enabledWebOutputIds.includes(output.id)).length,
    ANDROID_ICON_OUTPUTS.filter((output) => enabledAndroidOutputIds.includes(output.id)).length,
    IOS_ICON_OUTPUTS.filter((output) => enabledIosOutputIds.includes(output.id)).length,
    customIconOutputs.filter((output) => enabledCustomOutputIds.includes(output.id)).length,
  );
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void openFile(file);
    }
    event.target.value = "";
  }

  async function handleProjectFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      await openProjectFile(file);
    }
    event.target.value = "";
  }

  function confirmCloseCurrentImage() {
    if (window.confirm(t("confirmCloseImage"))) {
      closeCurrentImage();
    }
  }

  return (
    <header className="top-bar">
      <div className="brand">
        <img alt="" className="brand-mark" height={36} src={appIcon} width={36} />
        <div>
          <h1>{t("appTitle")}</h1>
          <p>{t("appSubtitle")}</p>
        </div>
      </div>

      <nav className="top-actions" aria-label={t("appSubtitle")}>
        <input
          accept="image/png,image/jpeg,image/webp"
          className="file-input"
          data-testid="image-file-input"
          onChange={handleFileChange}
          ref={fileInputRef}
          type="file"
        />
        <input
          accept="application/json,.json,.ist-project.json"
          className="file-input"
          onChange={(event) => void handleProjectFileChange(event)}
          ref={projectInputRef}
          type="file"
        />
        <Hint text={t("openImageHint")}>
          <button className="button primary" onClick={() => void handleOpenImageClick(fileInputRef.current)} type="button">
            <FolderOpen size={16} />
            {t("openImage")}
          </button>
        </Hint>
        <Hint text={t("openProjectHint")}>
          <button className="icon-button" onClick={() => projectInputRef.current?.click()} type="button" aria-label={t("openProject")}>
            <FileUp size={16} />
          </button>
        </Hint>
        <Hint text={t("saveProjectHint")}>
          <button
            className="icon-button"
            disabled={!imageDocument}
            onClick={() => void saveProjectFile()}
            type="button"
            aria-label={t("saveProject")}
          >
            <Save size={16} />
          </button>
        </Hint>
        <Hint text={t("closeImageHint")}>
          <button
            aria-label={t("closeImage")}
            className="icon-button"
            data-testid="close-image-button"
            disabled={!imageDocument}
            onClick={confirmCloseCurrentImage}
            type="button"
          >
            <XCircle size={16} />
          </button>
        </Hint>
        <Hint text={t("undoHint")}>
          <button className="icon-button" disabled={pastSlices.length === 0} onClick={undo} type="button" aria-label={t("undo")}>
            <Undo2 size={16} />
          </button>
        </Hint>
        <Hint text={t("redoHint")}>
          <button className="icon-button" disabled={futureSlices.length === 0} onClick={redo} type="button" aria-label={t("redo")}>
            <Redo2 size={16} />
          </button>
        </Hint>
        <SettingsPanel />
        <span className="divider" />
        <ImageInfoPanel />
        <Hint text={t("zoomOut")}>
          <button
            className="icon-button"
            disabled={!imageDocument}
            onClick={() => changeZoom(zoom - 0.1)}
            type="button"
            aria-label={t("zoomOut")}
          >
            <ZoomOut size={16} />
          </button>
        </Hint>
        <Hint text={t("fitToWindow")}>
          <button className="zoom-value" disabled={!imageDocument} onClick={fitToWindow} type="button">
            {zoomLabel}
          </button>
        </Hint>
        <Hint text={t("zoomIn")}>
          <button
            className="icon-button"
            disabled={!imageDocument}
            onClick={() => changeZoom(zoom + 0.1)}
            type="button"
            aria-label={t("zoomIn")}
          >
            <ZoomIn size={16} />
          </button>
        </Hint>
        <Hint text={t("exportHint")}>
          <button
            className="button"
            data-testid="export-button"
            disabled={!imageDocument || exportSlices.length === 0 || platformOutputCount === 0 || isExporting}
            onClick={() => void handleExport()}
            type="button"
          >
            <Download size={16} />
            {isExporting ? t("exporting") : t("export")}
          </button>
        </Hint>
      </nav>
    </header>
  );
}
