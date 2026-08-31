import { create } from "zustand";
import { DEFAULT_CUSTOM_ICON_OUTPUTS, DEFAULT_WEB_OUTPUT_IDS, MAX_SCAN_PIXELS, MAX_ZOOM, MIN_ZOOM } from "../core/constants";
import { blobUrlToDataUrl, dataUrlToFile, getMimeTypeFromFileName, isAcceptedImageFile } from "../core/files";
import { runExport } from "../core/export";
import { calculateFitZoom, detectAlphaChannel, loadImage } from "../core/image";
import { clamp } from "../core/geometry";
import { buildGridSlices } from "../core/grid";
import { sanitizeAndroidResourceName, sanitizeCustomOutputFileName, sanitizeFileName } from "../core/naming";
import { ANDROID_ICON_OUTPUTS, IOS_ICON_OUTPUTS } from "../core/presets";
import { isCustomPresetFile, isSavedProject, type ProjectSettings } from "../core/project";
import { findConnectedRegions } from "../core/scan";
import type {
  CustomIconOutput,
  ExportFormat,
  ExportScope,
  GridMode,
  GridOrder,
  ImageDocument,
  PanState,
  ScanMode,
  SliceRegion,
  TargetPlatform,
  ToolId,
} from "../core/types";
import { openImageFromDesktopDialog } from "../platform/open-image";
import { isTauriRuntime } from "../platform/runtime";
import { saveBlob } from "../platform/save";

type WorkspaceState = {
  imageDocument: ImageDocument | null;
  activeTool: ToolId;
  slices: SliceRegion[];
  pastSlices: SliceRegion[][];
  futureSlices: SliceRegion[][];
  selectedSliceId: string | null;
  zoom: number;
  pan: PanState;
  isPanning: boolean;
  isDraggingOver: boolean;
  statusText: string;
  pointerInfo: string;
  errorMessage: string | null;
  exportFormat: ExportFormat;
  exportScope: ExportScope;
  targetPlatform: TargetPlatform;
  enabledWebOutputIds: string[];
  enabledAndroidOutputIds: string[];
  enabledIosOutputIds: string[];
  androidResourceName: string;
  filePrefix: string;
  jpgBackground: string;
  isExporting: boolean;
  gridMode: GridMode;
  gridWidth: number;
  gridHeight: number;
  gridStartX: number;
  gridStartY: number;
  gridGapX: number;
  gridGapY: number;
  gridRows: number;
  gridColumns: number;
  gridOrder: GridOrder;
  scanMode: ScanMode;
  scanAlphaThreshold: number;
  scanBackgroundColor: string;
  scanColorTolerance: number;
  scanMinArea: number;
  scanMinSize: number;
  scanPadding: number;
  isScanning: boolean;
  customIconOutputs: CustomIconOutput[];
  enabledCustomOutputIds: string[];
  setActiveTool: (tool: ToolId) => void;
  setIsPanning: (isPanning: boolean) => void;
  setIsDraggingOver: (isDraggingOver: boolean) => void;
  setPan: (pan: PanState) => void;
  setPointerInfo: (pointerInfo: string) => void;
  setStatusText: (statusText: string) => void;
  setSelectedSliceId: (selectedSliceId: string | null) => void;
  setExportFormat: (exportFormat: ExportFormat) => void;
  setExportScope: (exportScope: ExportScope) => void;
  setTargetPlatform: (targetPlatform: TargetPlatform) => void;
  setFilePrefix: (filePrefix: string) => void;
  setJpgBackground: (jpgBackground: string) => void;
  setAndroidResourceName: (androidResourceName: string) => void;
  setGridMode: (gridMode: GridMode) => void;
  setGridWidth: (gridWidth: number) => void;
  setGridHeight: (gridHeight: number) => void;
  setGridStartX: (gridStartX: number) => void;
  setGridStartY: (gridStartY: number) => void;
  setGridGapX: (gridGapX: number) => void;
  setGridGapY: (gridGapY: number) => void;
  setGridRows: (gridRows: number) => void;
  setGridColumns: (gridColumns: number) => void;
  setGridOrder: (gridOrder: GridOrder) => void;
  setScanMode: (scanMode: ScanMode) => void;
  setScanAlphaThreshold: (scanAlphaThreshold: number) => void;
  setScanBackgroundColor: (scanBackgroundColor: string) => void;
  setScanColorTolerance: (scanColorTolerance: number) => void;
  setScanMinArea: (scanMinArea: number) => void;
  setScanMinSize: (scanMinSize: number) => void;
  setScanPadding: (scanPadding: number) => void;
  changeZoom: (nextZoom: number) => void;
  fitToWindow: () => void;
  pushHistory: () => void;
  updateSlice: (sliceId: string, patch: Partial<SliceRegion>) => void;
  deleteSlice: (sliceId: string) => void;
  undo: () => void;
  redo: () => void;
  handleNumericChange: (field: "x" | "y" | "width" | "height", value: string) => void;
  toggleWebOutput: (outputId: string, enabled: boolean) => void;
  toggleAndroidOutput: (outputId: string, enabled: boolean) => void;
  toggleIosOutput: (outputId: string, enabled: boolean) => void;
  toggleCustomOutput: (outputId: string, enabled: boolean) => void;
  updateCustomOutput: (outputId: string, patch: Partial<CustomIconOutput>) => void;
  addCustomOutput: () => void;
  removeCustomOutput: (outputId: string) => void;
  generateGridSlices: (replaceExisting: boolean) => void;
  detectIconSlices: (replaceExisting: boolean) => Promise<void>;
  openFile: (file: File) => Promise<void>;
  openDroppedFile: (file: File) => Promise<void>;
  handleOpenImageClick: (fileInput: HTMLInputElement | null) => Promise<void>;
  openProjectFile: (file: File) => Promise<void>;
  saveProjectFile: () => Promise<void>;
  openCustomPresetFile: (file: File) => Promise<void>;
  saveCustomPresetFile: () => Promise<void>;
  handleExport: () => Promise<void>;
};

function toggleId(current: string[], id: string, enabled: boolean) {
  if (enabled) {
    return current.includes(id) ? current : [...current, id];
  }

  return current.filter((item) => item !== id);
}

function replaceImage(current: ImageDocument | null, next: ImageDocument | null) {
  if (current) {
    URL.revokeObjectURL(current.url);
  }

  return next;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  imageDocument: null,
  activeTool: "select",
  slices: [],
  pastSlices: [],
  futureSlices: [],
  selectedSliceId: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
  isPanning: false,
  isDraggingOver: false,
  statusText: "就绪",
  pointerInfo: "坐标 0, 0",
  errorMessage: null,
  exportFormat: "png",
  exportScope: "enabled",
  targetPlatform: "generic",
  enabledWebOutputIds: DEFAULT_WEB_OUTPUT_IDS,
  enabledAndroidOutputIds: ANDROID_ICON_OUTPUTS.map((output) => output.id),
  enabledIosOutputIds: IOS_ICON_OUTPUTS.map((output) => output.id),
  androidResourceName: "ic_launcher",
  filePrefix: "slice",
  jpgBackground: "#ffffff",
  isExporting: false,
  gridMode: "fixed",
  gridWidth: 128,
  gridHeight: 128,
  gridStartX: 0,
  gridStartY: 0,
  gridGapX: 0,
  gridGapY: 0,
  gridRows: 3,
  gridColumns: 3,
  gridOrder: "row",
  scanMode: "auto",
  scanAlphaThreshold: 16,
  scanBackgroundColor: "#ffffff",
  scanColorTolerance: 24,
  scanMinArea: 64,
  scanMinSize: 4,
  scanPadding: 2,
  isScanning: false,
  customIconOutputs: DEFAULT_CUSTOM_ICON_OUTPUTS,
  enabledCustomOutputIds: DEFAULT_CUSTOM_ICON_OUTPUTS.map((output) => output.id),
  setActiveTool: (activeTool) => set({ activeTool }),
  setIsPanning: (isPanning) => set({ isPanning }),
  setIsDraggingOver: (isDraggingOver) => set({ isDraggingOver }),
  setPan: (pan) => set({ pan }),
  setPointerInfo: (pointerInfo) => set({ pointerInfo }),
  setStatusText: (statusText) => set({ statusText }),
  setSelectedSliceId: (selectedSliceId) => set({ selectedSliceId }),
  setExportFormat: (exportFormat) => set({ exportFormat }),
  setExportScope: (exportScope) => set({ exportScope }),
  setTargetPlatform: (targetPlatform) => set({ targetPlatform }),
  setFilePrefix: (filePrefix) => set({ filePrefix }),
  setJpgBackground: (jpgBackground) => set({ jpgBackground }),
  setAndroidResourceName: (androidResourceName) => set({ androidResourceName: sanitizeAndroidResourceName(androidResourceName) }),
  setGridMode: (gridMode) => set({ gridMode }),
  setGridWidth: (gridWidth) => set({ gridWidth }),
  setGridHeight: (gridHeight) => set({ gridHeight }),
  setGridStartX: (gridStartX) => set({ gridStartX }),
  setGridStartY: (gridStartY) => set({ gridStartY }),
  setGridGapX: (gridGapX) => set({ gridGapX }),
  setGridGapY: (gridGapY) => set({ gridGapY }),
  setGridRows: (gridRows) => set({ gridRows }),
  setGridColumns: (gridColumns) => set({ gridColumns }),
  setGridOrder: (gridOrder) => set({ gridOrder }),
  setScanMode: (scanMode) => set({ scanMode }),
  setScanAlphaThreshold: (scanAlphaThreshold) => set({ scanAlphaThreshold }),
  setScanBackgroundColor: (scanBackgroundColor) => set({ scanBackgroundColor }),
  setScanColorTolerance: (scanColorTolerance) => set({ scanColorTolerance }),
  setScanMinArea: (scanMinArea) => set({ scanMinArea }),
  setScanMinSize: (scanMinSize) => set({ scanMinSize }),
  setScanPadding: (scanPadding) => set({ scanPadding }),
  changeZoom: (nextZoom) => set({ zoom: clamp(nextZoom, MIN_ZOOM, MAX_ZOOM) }),
  fitToWindow: () => {
    const { imageDocument } = get();
    if (!imageDocument) {
      return;
    }

    set({
      pan: { x: 0, y: 0 },
      zoom: calculateFitZoom(imageDocument.width, imageDocument.height),
      statusText: "已适应窗口",
    });
  },
  pushHistory: () => {
    const { slices } = get();
    set((state) => ({
      pastSlices: [...state.pastSlices, slices],
      futureSlices: [],
    }));
  },
  updateSlice: (sliceId, patch) => {
    set((state) => ({
      slices: state.slices.map((slice) => (slice.id === sliceId ? { ...slice, ...patch } : slice)),
    }));
  },
  deleteSlice: (sliceId) => {
    get().pushHistory();
    set((state) => ({
      slices: state.slices.filter((slice) => slice.id !== sliceId),
      selectedSliceId: state.selectedSliceId === sliceId ? null : state.selectedSliceId,
      statusText: "选区已删除",
    }));
  },
  undo: () => {
    const { pastSlices, slices } = get();
    if (pastSlices.length === 0) {
      return;
    }

    const previous = pastSlices[pastSlices.length - 1];
    set((state) => ({
      pastSlices: state.pastSlices.slice(0, -1),
      futureSlices: [slices, ...state.futureSlices],
      slices: previous,
      selectedSliceId:
        state.selectedSliceId && previous.some((slice) => slice.id === state.selectedSliceId)
          ? state.selectedSliceId
          : previous.at(-1)?.id ?? null,
      statusText: "已撤销",
    }));
  },
  redo: () => {
    const { futureSlices, slices } = get();
    if (futureSlices.length === 0) {
      return;
    }

    const next = futureSlices[0];
    set((state) => ({
      futureSlices: state.futureSlices.slice(1),
      pastSlices: [...state.pastSlices, slices],
      slices: next,
      selectedSliceId:
        state.selectedSliceId && next.some((slice) => slice.id === state.selectedSliceId)
          ? state.selectedSliceId
          : next.at(-1)?.id ?? null,
      statusText: "已重做",
    }));
  },
  handleNumericChange: (field, value) => {
    const { selectedSliceId, slices, imageDocument } = get();
    const selectedSlice = slices.find((slice) => slice.id === selectedSliceId) ?? null;
    if (!selectedSlice || !imageDocument) {
      return;
    }

    const numericValue = Number.parseInt(value || "0", 10);
    if (Number.isNaN(numericValue)) {
      return;
    }

    const nextValue = Math.round(numericValue);
    get().pushHistory();
    if (field === "x") {
      get().updateSlice(selectedSlice.id, {
        x: clamp(nextValue, 0, imageDocument.width - selectedSlice.width),
      });
    }

    if (field === "y") {
      get().updateSlice(selectedSlice.id, {
        y: clamp(nextValue, 0, imageDocument.height - selectedSlice.height),
      });
    }

    if (field === "width") {
      get().updateSlice(selectedSlice.id, {
        width: clamp(nextValue, 1, imageDocument.width - selectedSlice.x),
      });
    }

    if (field === "height") {
      get().updateSlice(selectedSlice.id, {
        height: clamp(nextValue, 1, imageDocument.height - selectedSlice.y),
      });
    }
  },
  toggleWebOutput: (outputId, enabled) => {
    set((state) => ({ enabledWebOutputIds: toggleId(state.enabledWebOutputIds, outputId, enabled) }));
  },
  toggleAndroidOutput: (outputId, enabled) => {
    set((state) => ({ enabledAndroidOutputIds: toggleId(state.enabledAndroidOutputIds, outputId, enabled) }));
  },
  toggleIosOutput: (outputId, enabled) => {
    set((state) => ({ enabledIosOutputIds: toggleId(state.enabledIosOutputIds, outputId, enabled) }));
  },
  toggleCustomOutput: (outputId, enabled) => {
    set((state) => ({ enabledCustomOutputIds: toggleId(state.enabledCustomOutputIds, outputId, enabled) }));
  },
  updateCustomOutput: (outputId, patch) => {
    set((state) => ({
      customIconOutputs: state.customIconOutputs.map((output) =>
        output.id === outputId ? { ...output, ...patch } : output,
      ),
    }));
  },
  addCustomOutput: () => {
    const id = crypto.randomUUID();
    const size = 512;
    set((state) => ({
      customIconOutputs: [
        ...state.customIconOutputs,
        { id, label: `Icon ${size}`, width: size, height: size, fileName: `icon-${size}x${size}.png` },
      ],
      enabledCustomOutputIds: [...state.enabledCustomOutputIds, id],
      statusText: "已添加自定义尺寸",
    }));
  },
  removeCustomOutput: (outputId) => {
    set((state) => ({
      customIconOutputs: state.customIconOutputs.filter((output) => output.id !== outputId),
      enabledCustomOutputIds: state.enabledCustomOutputIds.filter((id) => id !== outputId),
      statusText: "已删除自定义尺寸",
    }));
  },
  generateGridSlices: (replaceExisting) => {
    const state = get();
    if (!state.imageDocument) {
      set({ statusText: "请先导入图片" });
      return;
    }

    const nextSlices = buildGridSlices({
      imageSize: state.imageDocument,
      mode: state.gridMode,
      cellWidth: state.gridWidth,
      cellHeight: state.gridHeight,
      startX: state.gridStartX,
      startY: state.gridStartY,
      gapX: state.gridGapX,
      gapY: state.gridGapY,
      rows: state.gridRows,
      columns: state.gridColumns,
      order: state.gridOrder,
      nameOffset: replaceExisting ? 0 : state.slices.length,
    });

    if (nextSlices.length === 0) {
      set({
        errorMessage: "当前网格参数没有生成有效切片，请检查尺寸、起点和行列数量。",
        statusText: "网格生成失败",
      });
      return;
    }

    state.pushHistory();
    set((current) => ({
      errorMessage: null,
      slices: replaceExisting ? nextSlices : [...current.slices, ...nextSlices],
      selectedSliceId: nextSlices[0].id,
      activeTool: "select",
      statusText: `已生成 ${nextSlices.length} 个网格切片`,
    }));
  },
  detectIconSlices: async (replaceExisting) => {
    const state = get();
    if (!state.imageDocument) {
      set({ statusText: "请先导入图片" });
      return;
    }

    if (state.imageDocument.width * state.imageDocument.height > MAX_SCAN_PIXELS) {
      set({
        errorMessage: "当前图片过大，智能识别基础版暂时建议处理 1600 万像素以内的图片。",
        statusText: "识别未开始",
      });
      return;
    }

    set({ isScanning: true, errorMessage: null, statusText: "正在识别图形区域" });

    try {
      const sourceImage = await loadImage(state.imageDocument.url);
      const canvas = document.createElement("canvas");
      canvas.width = state.imageDocument.width;
      canvas.height = state.imageDocument.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        throw new Error("Canvas is unavailable");
      }

      context.drawImage(sourceImage, 0, 0);
      const imageData = context.getImageData(0, 0, state.imageDocument.width, state.imageDocument.height);
      const nextSlices = findConnectedRegions(imageData, {
        mode: state.scanMode,
        alphaThreshold: state.scanAlphaThreshold,
        backgroundColor: state.scanBackgroundColor,
        colorTolerance: state.scanColorTolerance,
        minArea: state.scanMinArea,
        minSize: state.scanMinSize,
        padding: state.scanPadding,
        nameOffset: replaceExisting ? 0 : state.slices.length,
      });

      if (nextSlices.length === 0) {
        set({
          errorMessage: "没有识别到可用区域。可以降低阈值、减小最小面积，或切换识别方式再试。",
          statusText: "未识别到区域",
        });
        return;
      }

      get().pushHistory();
      set((current) => ({
        slices: replaceExisting ? nextSlices : [...current.slices, ...nextSlices],
        selectedSliceId: nextSlices[0].id,
        activeTool: "select",
        statusText: `已识别 ${nextSlices.length} 个区域`,
      }));
    } catch {
      set({
        errorMessage: "智能识别失败，请换一张图片或调整参数后再试。",
        statusText: "识别失败",
      });
    } finally {
      set({ isScanning: false });
    }
  },
  openFile: async (file) => {
    set({ errorMessage: null });

    if (!isAcceptedImageFile(file)) {
      set({ errorMessage: "暂时只支持 PNG、JPG/JPEG、WebP 图片。", statusText: "导入失败" });
      return;
    }

    try {
      const mimeType = file.type || getMimeTypeFromFileName(file.name);
      const imageFile = file.type ? file : new File([file], file.name, { type: mimeType });
      const url = URL.createObjectURL(imageFile);
      const bitmap = await createImageBitmap(imageFile);
      const hasAlpha = await detectAlphaChannel(bitmap);

      set((state) => ({
        imageDocument: replaceImage(state.imageDocument, {
          fileName: file.name,
          fileSize: file.size,
          mimeType,
          width: bitmap.width,
          height: bitmap.height,
          hasAlpha,
          url,
        }),
        slices: [],
        pastSlices: [],
        futureSlices: [],
        selectedSliceId: null,
        pan: { x: 0, y: 0 },
        zoom: calculateFitZoom(bitmap.width, bitmap.height),
        statusText: "图片已导入",
        pointerInfo: "坐标 0, 0",
      }));
      bitmap.close();
    } catch {
      set({ errorMessage: "图片解析失败，请换一张图片再试。", statusText: "导入失败" });
    }
  },
  openDroppedFile: async (file) => {
    if (isAcceptedImageFile(file)) {
      await get().openFile(file);
      return;
    }

    if (file.name.endsWith(".ist-project.json")) {
      await get().openProjectFile(file);
      return;
    }

    if (file.name.endsWith(".custom-preset.json")) {
      await get().openCustomPresetFile(file);
      return;
    }

    set({ errorMessage: "拖入文件暂时只支持图片、项目文件和自定义预设。", statusText: "拖拽导入失败" });
  },
  handleOpenImageClick: async (fileInput) => {
    if (isTauriRuntime()) {
      try {
        const file = await openImageFromDesktopDialog();
        if (file) {
          await get().openFile(file);
          return;
        }
      } catch {
        // Fall through to the browser file picker.
      }
    }

    fileInput?.click();
  },
  openProjectFile: async (file) => {
    try {
      set({ errorMessage: null, statusText: "正在打开项目" });
      const project = JSON.parse(await file.text());

      if (!isSavedProject(project)) {
        throw new Error("Invalid project file");
      }

      const imageFile = dataUrlToFile(project.image.dataUrl, project.image.fileName, project.image.mimeType);
      const url = URL.createObjectURL(imageFile);
      const bitmap = await createImageBitmap(imageFile);
      const restoredSlices = project.slices.map((slice) => ({
        ...slice,
        id: slice.id || crypto.randomUUID(),
      }));
      const restoredSelectedId =
        project.selectedSliceId && restoredSlices.some((slice) => slice.id === project.selectedSliceId)
          ? project.selectedSliceId
          : restoredSlices[0]?.id ?? null;

      set((state) => ({
        imageDocument: replaceImage(state.imageDocument, {
          fileName: project.image.fileName,
          fileSize: project.image.fileSize,
          mimeType: project.image.mimeType,
          width: bitmap.width,
          height: bitmap.height,
          hasAlpha: project.image.hasAlpha,
          url,
        }),
        slices: restoredSlices,
        pastSlices: [],
        futureSlices: [],
        selectedSliceId: restoredSelectedId,
        pan: { x: 0, y: 0 },
        zoom: calculateFitZoom(bitmap.width, bitmap.height),
        pointerInfo: "坐标 0, 0",
        statusText: "项目已打开",
        exportFormat: project.settings.exportFormat,
        exportScope: project.settings.exportScope,
        targetPlatform: project.settings.targetPlatform,
        enabledWebOutputIds: project.settings.enabledWebOutputIds,
        enabledAndroidOutputIds: project.settings.enabledAndroidOutputIds,
        enabledIosOutputIds: project.settings.enabledIosOutputIds,
        androidResourceName: project.settings.androidResourceName,
        filePrefix: project.settings.filePrefix,
        jpgBackground: project.settings.jpgBackground,
        gridMode: project.settings.gridMode,
        gridWidth: project.settings.gridWidth,
        gridHeight: project.settings.gridHeight,
        gridStartX: project.settings.gridStartX,
        gridStartY: project.settings.gridStartY,
        gridGapX: project.settings.gridGapX,
        gridGapY: project.settings.gridGapY,
        gridRows: project.settings.gridRows,
        gridColumns: project.settings.gridColumns,
        gridOrder: project.settings.gridOrder,
        scanMode: project.settings.scanMode,
        scanAlphaThreshold: project.settings.scanAlphaThreshold,
        scanBackgroundColor: project.settings.scanBackgroundColor,
        scanColorTolerance: project.settings.scanColorTolerance,
        scanMinArea: project.settings.scanMinArea,
        scanMinSize: project.settings.scanMinSize,
        scanPadding: project.settings.scanPadding,
        customIconOutputs: project.settings.customIconOutputs,
        enabledCustomOutputIds: project.settings.enabledCustomOutputIds,
      }));
      bitmap.close();
    } catch {
      set({
        errorMessage: "项目文件无法打开，请确认它是有效的 .ist-project.json 文件。",
        statusText: "项目打开失败",
      });
    }
  },
  saveProjectFile: async () => {
    const state = get();
    if (!state.imageDocument) {
      set({ statusText: "请先导入图片" });
      return;
    }

    try {
      set({ errorMessage: null, statusText: "正在保存项目" });
      const dataUrl = await blobUrlToDataUrl(state.imageDocument.url);
      const settings: ProjectSettings = {
        exportFormat: state.exportFormat,
        exportScope: state.exportScope,
        targetPlatform: state.targetPlatform,
        enabledWebOutputIds: state.enabledWebOutputIds,
        enabledAndroidOutputIds: state.enabledAndroidOutputIds,
        enabledIosOutputIds: state.enabledIosOutputIds,
        androidResourceName: state.androidResourceName,
        filePrefix: state.filePrefix,
        jpgBackground: state.jpgBackground,
        gridMode: state.gridMode,
        gridWidth: state.gridWidth,
        gridHeight: state.gridHeight,
        gridStartX: state.gridStartX,
        gridStartY: state.gridStartY,
        gridGapX: state.gridGapX,
        gridGapY: state.gridGapY,
        gridRows: state.gridRows,
        gridColumns: state.gridColumns,
        gridOrder: state.gridOrder,
        scanMode: state.scanMode,
        scanAlphaThreshold: state.scanAlphaThreshold,
        scanBackgroundColor: state.scanBackgroundColor,
        scanColorTolerance: state.scanColorTolerance,
        scanMinArea: state.scanMinArea,
        scanMinSize: state.scanMinSize,
        scanPadding: state.scanPadding,
        customIconOutputs: state.customIconOutputs,
        enabledCustomOutputIds: state.enabledCustomOutputIds,
      };
      const blob = new Blob(
        [
          JSON.stringify(
            {
              version: 1,
              savedAt: new Date().toISOString(),
              image: {
                fileName: state.imageDocument.fileName,
                fileSize: state.imageDocument.fileSize,
                mimeType: state.imageDocument.mimeType,
                width: state.imageDocument.width,
                height: state.imageDocument.height,
                hasAlpha: state.imageDocument.hasAlpha,
                dataUrl,
              },
              slices: state.slices,
              selectedSliceId: state.selectedSliceId,
              settings,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      await saveBlob(
        blob,
        `${sanitizeFileName(state.filePrefix || state.imageDocument.fileName || "image-slicing")}.ist-project.json`,
      );
      set({ statusText: "项目已保存" });
    } catch {
      set({ errorMessage: "项目保存失败，请稍后再试。", statusText: "项目保存失败" });
    }
  },
  openCustomPresetFile: async (file) => {
    try {
      const preset = JSON.parse(await file.text());
      if (!isCustomPresetFile(preset)) {
        throw new Error("Invalid custom preset file");
      }

      const restoredOutputs = preset.outputs.map((output) => ({
        ...output,
        id: output.id || crypto.randomUUID(),
        width: Math.max(Math.round(output.width), 1),
        height: Math.max(Math.round(output.height), 1),
        fileName: sanitizeCustomOutputFileName(output.fileName, output.width, output.height),
      }));

      set({
        customIconOutputs: restoredOutputs,
        enabledCustomOutputIds: restoredOutputs.map((output) => output.id),
        targetPlatform: "custom",
        errorMessage: null,
        statusText: "自定义预设已打开",
      });
    } catch {
      set({
        errorMessage: "自定义预设无法打开，请确认它是有效的 custom-preset.json 文件。",
        statusText: "预设打开失败",
      });
    }
  },
  saveCustomPresetFile: async () => {
    try {
      const { customIconOutputs, filePrefix } = get();
      const blob = new Blob(
        [
          JSON.stringify(
            {
              version: 1,
              savedAt: new Date().toISOString(),
              outputs: customIconOutputs,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      await saveBlob(blob, `${sanitizeFileName(filePrefix || "custom-icon-preset")}.custom-preset.json`);
      set({ statusText: "自定义预设已保存" });
    } catch {
      set({ errorMessage: "自定义预设保存失败，请稍后再试。", statusText: "预设保存失败" });
    }
  },
  handleExport: async () => {
    const state = get();
    if (!state.imageDocument) {
      set({ statusText: "请先导入图片" });
      return;
    }

    set({ isExporting: true, errorMessage: null, statusText: "正在导出" });

    try {
      const result = await runExport({
        imageDocument: state.imageDocument,
        slices: state.slices,
        exportScope: state.exportScope,
        selectedSliceId: state.selectedSliceId,
        targetPlatform: state.targetPlatform,
        enabledWebOutputIds: state.enabledWebOutputIds,
        enabledAndroidOutputIds: state.enabledAndroidOutputIds,
        enabledIosOutputIds: state.enabledIosOutputIds,
        enabledCustomOutputIds: state.enabledCustomOutputIds,
        customIconOutputs: state.customIconOutputs,
        androidResourceName: state.androidResourceName,
        filePrefix: state.filePrefix,
        exportFormat: state.exportFormat,
        jpgBackground: state.jpgBackground,
      });

      if (result.ok) {
        set({ statusText: result.statusText });
        return;
      }

      set({ errorMessage: result.errorMessage, statusText: result.statusText });
    } catch {
      set({ errorMessage: "导出失败，请检查图片和选区后再试。", statusText: "导出失败" });
    } finally {
      set({ isExporting: false });
    }
  },
}));
