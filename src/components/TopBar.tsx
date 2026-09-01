import { Download, FileUp, FolderOpen, Redo2, Save, Undo2, XCircle, ZoomIn, ZoomOut } from "lucide-react";
import { ChangeEvent, useRef } from "react";
import appIcon from "../assets/app-icon.png";
import { Hint } from "./Hint";
import { ImageInfoPanel } from "./ImageInfoPanel";
import { getExportSlices, getPlatformOutputCount } from "../core/export";
import { ANDROID_ICON_OUTPUTS, IOS_ICON_OUTPUTS, WEB_ICON_OUTPUTS } from "../core/presets";
import { useWorkspaceStore } from "../store/workspace-store";

export function TopBar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
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
    if (window.confirm("确定关闭当前图片？关闭后会清空当前图片和所有选区。")) {
      closeCurrentImage();
    }
  }

  return (
    <header className="top-bar">
      <div className="brand">
        <img alt="" className="brand-mark" height={36} src={appIcon} width={36} />
        <div>
          <h1>图片切图工具</h1>
          <p>跨平台图片切图工作台</p>
        </div>
      </div>

      <nav className="top-actions" aria-label="主要操作">
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
        <Hint text="从本地选择 PNG、JPG 或 WebP 图片，开始切图。">
          <button className="button primary" onClick={() => void handleOpenImageClick(fileInputRef.current)} type="button">
            <FolderOpen size={16} />
            打开图片
          </button>
        </Hint>
        <Hint text="打开之前保存的切图项目，恢复图片、切片和导出设置。">
          <button className="icon-button" onClick={() => projectInputRef.current?.click()} type="button" aria-label="打开项目">
            <FileUp size={16} />
          </button>
        </Hint>
        <Hint text="把当前图片、切片和导出设置保存成项目文件，方便下次继续。">
          <button
            className="icon-button"
            disabled={!imageDocument}
            onClick={() => void saveProjectFile()}
            type="button"
            aria-label="保存项目"
          >
            <Save size={16} />
          </button>
        </Hint>
        <Hint text="关闭当前图片，并清空画布和选区。">
          <button
            aria-label="关闭当前图片"
            className="icon-button"
            data-testid="close-image-button"
            disabled={!imageDocument}
            onClick={confirmCloseCurrentImage}
            type="button"
          >
            <XCircle size={16} />
          </button>
        </Hint>
        <Hint text="撤销上一步切片编辑。">
          <button className="icon-button" disabled={pastSlices.length === 0} onClick={undo} type="button" aria-label="撤销">
            <Undo2 size={16} />
          </button>
        </Hint>
        <Hint text="重做刚刚撤销的操作。">
          <button className="icon-button" disabled={futureSlices.length === 0} onClick={redo} type="button" aria-label="重做">
            <Redo2 size={16} />
          </button>
        </Hint>
        <span className="divider" />
        <ImageInfoPanel />
        <Hint text="缩小画布。">
          <button
            className="icon-button"
            disabled={!imageDocument}
            onClick={() => changeZoom(zoom - 0.1)}
            type="button"
            aria-label="缩小"
          >
            <ZoomOut size={16} />
          </button>
        </Hint>
        <Hint text="点击后让图片适应窗口大小。">
          <button className="zoom-value" disabled={!imageDocument} onClick={fitToWindow} type="button">
            {zoomLabel}
          </button>
        </Hint>
        <Hint text="放大画布。">
          <button
            className="icon-button"
            disabled={!imageDocument}
            onClick={() => changeZoom(zoom + 0.1)}
            type="button"
            aria-label="放大"
          >
            <ZoomIn size={16} />
          </button>
        </Hint>
        <Hint text="按右侧导出设置，把切片保存为图片或平台资源包。">
          <button
            className="button"
            data-testid="export-button"
            disabled={!imageDocument || exportSlices.length === 0 || platformOutputCount === 0 || isExporting}
            onClick={() => void handleExport()}
            type="button"
          >
            <Download size={16} />
            {isExporting ? "导出中" : "导出"}
          </button>
        </Hint>
      </nav>
    </header>
  );
}
