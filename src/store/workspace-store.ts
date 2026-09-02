import { create } from "zustand";
import { DEFAULT_CUSTOM_ICON_OUTPUTS, DEFAULT_WEB_OUTPUT_IDS, MAX_SCAN_PIXELS, MAX_ZOOM, MIN_ZOOM } from "../core/constants";
import { blobUrlToDataUrl, dataUrlToFile, getMimeTypeFromFileName, isAcceptedImageFile } from "../core/files";
import { runExport } from "../core/export";
import { calculateFitZoom, detectAlphaChannel, loadImage } from "../core/image";
import { getInitialLanguage, LANGUAGE_STORAGE_KEY, type Language } from "../core/i18n";
import { clamp } from "../core/geometry";
import { buildGridSlices } from "../core/grid";
import { sanitizeAndroidResourceName, sanitizeCustomOutputFileName, sanitizeFileName } from "../core/naming";
import { ANDROID_ICON_OUTPUTS, IOS_ICON_OUTPUTS } from "../core/presets";
import { isCustomPresetFile, isSavedProject, type ProjectSettings } from "../core/project";
import { findConnectedRegions } from "../core/scan";
import { findOpaqueBounds } from "../core/trim";
import type {
  CustomIconOutput,
  AspectRatioPreset,
  ExportFormat,
  ExportMode,
  ExportScope,
  GridMode,
  GridOrder,
  ImageDocument,
  PanState,
  ScanMergeStrategy,
  ScanMode,
  SliceRegion,
  SliceShape,
  TargetPlatform,
  ToolId,
} from "../core/types";
import { openImageFromDesktopDialog } from "../platform/open-image";
import { isTauriRuntime } from "../platform/runtime";
import { openPath, saveBlob } from "../platform/save";

type WorkspaceState = {
  language: Language;
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
  exportMode: ExportMode;
  exportScope: ExportScope;
  targetPlatform: TargetPlatform;
  enabledWebOutputIds: string[];
  enabledAndroidOutputIds: string[];
  enabledIosOutputIds: string[];
  androidResourceName: string;
  filePrefix: string;
  jpgBackground: string;
  exportTransparentBackground: boolean;
  isExporting: boolean;
  lastExportDirectory: string | null;
  defaultSliceShape: SliceShape;
  defaultCornerRadius: number;
  aspectRatioPreset: AspectRatioPreset;
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
  scanMergeStrategy: ScanMergeStrategy;
  scanMergeDistance: number;
  scanBridgeGap: number;
  scanIgnoreText: boolean;
  scanAlphaThreshold: number;
  scanBackgroundColor: string;
  scanColorTolerance: number;
  scanMinArea: number;
  scanMinSize: number;
  scanPadding: number;
  isScanning: boolean;
  isPickingScanBackground: boolean;
  scanPreviewSlices: SliceRegion[];
  customIconOutputs: CustomIconOutput[];
  enabledCustomOutputIds: string[];
  setActiveTool: (tool: ToolId) => void;
  setLanguage: (language: Language) => void;
  setIsPanning: (isPanning: boolean) => void;
  setIsDraggingOver: (isDraggingOver: boolean) => void;
  setPan: (pan: PanState) => void;
  setPointerInfo: (pointerInfo: string) => void;
  setStatusText: (statusText: string) => void;
  setSelectedSliceId: (selectedSliceId: string | null) => void;
  setExportFormat: (exportFormat: ExportFormat) => void;
  setExportMode: (exportMode: ExportMode) => void;
  setExportScope: (exportScope: ExportScope) => void;
  setTargetPlatform: (targetPlatform: TargetPlatform) => void;
  setFilePrefix: (filePrefix: string) => void;
  setJpgBackground: (jpgBackground: string) => void;
  setExportTransparentBackground: (exportTransparentBackground: boolean) => void;
  setAndroidResourceName: (androidResourceName: string) => void;
  setDefaultSliceShape: (defaultSliceShape: SliceShape) => void;
  setDefaultCornerRadius: (defaultCornerRadius: number) => void;
  setAspectRatioPreset: (aspectRatioPreset: AspectRatioPreset) => void;
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
  setScanMergeStrategy: (scanMergeStrategy: ScanMergeStrategy) => void;
  setScanMergeDistance: (scanMergeDistance: number) => void;
  setScanBridgeGap: (scanBridgeGap: number) => void;
  setScanIgnoreText: (scanIgnoreText: boolean) => void;
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
  clearSlices: () => void;
  closeCurrentImage: () => void;
  undo: () => void;
  redo: () => void;
  handleNumericChange: (field: "x" | "y" | "width" | "height", value: string) => void;
  trimSelectedSlice: () => Promise<void>;
  trimAllSlices: () => Promise<void>;
  toggleWebOutput: (outputId: string, enabled: boolean) => void;
  toggleAndroidOutput: (outputId: string, enabled: boolean) => void;
  toggleIosOutput: (outputId: string, enabled: boolean) => void;
  toggleCustomOutput: (outputId: string, enabled: boolean) => void;
  updateCustomOutput: (outputId: string, patch: Partial<CustomIconOutput>) => void;
  addCustomOutput: () => void;
  removeCustomOutput: (outputId: string) => void;
  generateGridSlices: (replaceExisting: boolean) => void;
  detectIconSlices: (replaceExisting: boolean) => Promise<void>;
  applyScanPreview: (replaceExisting: boolean) => void;
  removeScanPreviewSlice: (sliceId: string) => void;
  clearScanPreview: () => void;
  startPickScanBackground: () => void;
  startPickExportBackground: () => void;
  sampleScanBackgroundAt: (x: number, y: number) => Promise<void>;
  openFile: (file: File) => Promise<void>;
  openDroppedFile: (file: File) => Promise<void>;
  handleOpenImageClick: (fileInput: HTMLInputElement | null) => Promise<void>;
  openProjectFile: (file: File) => Promise<void>;
  saveProjectFile: () => Promise<void>;
  openCustomPresetFile: (file: File) => Promise<void>;
  saveCustomPresetFile: () => Promise<void>;
  openLastExportDirectory: () => Promise<void>;
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
  language: getInitialLanguage(),
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
  exportMode: "zip",
  exportScope: "enabled",
  targetPlatform: "generic",
  enabledWebOutputIds: DEFAULT_WEB_OUTPUT_IDS,
  enabledAndroidOutputIds: ANDROID_ICON_OUTPUTS.map((output) => output.id),
  enabledIosOutputIds: IOS_ICON_OUTPUTS.map((output) => output.id),
  androidResourceName: "ic_launcher",
  filePrefix: "slice",
  jpgBackground: "#ffffff",
  exportTransparentBackground: true,
  isExporting: false,
  lastExportDirectory: null,
  defaultSliceShape: "rect",
  defaultCornerRadius: 12,
  aspectRatioPreset: "free",
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
  scanMergeStrategy: "nearby",
  scanMergeDistance: 8,
  scanBridgeGap: 1,
  scanIgnoreText: true,
  scanAlphaThreshold: 16,
  scanBackgroundColor: "#ffffff",
  scanColorTolerance: 24,
  scanMinArea: 64,
  scanMinSize: 4,
  scanPadding: 2,
  isScanning: false,
  isPickingScanBackground: false,
  scanPreviewSlices: [],
  customIconOutputs: DEFAULT_CUSTOM_ICON_OUTPUTS,
  enabledCustomOutputIds: DEFAULT_CUSTOM_ICON_OUTPUTS.map((output) => output.id),
  setLanguage: (language) => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    set({ language });
  },
  setActiveTool: (activeTool) => set({ activeTool }),
  setIsPanning: (isPanning) => set({ isPanning }),
  setIsDraggingOver: (isDraggingOver) => set({ isDraggingOver }),
  setPan: (pan) => set({ pan }),
  setPointerInfo: (pointerInfo) => set({ pointerInfo }),
  setStatusText: (statusText) => set({ statusText }),
  setSelectedSliceId: (selectedSliceId) => set({ selectedSliceId }),
  setExportFormat: (exportFormat) => set({ exportFormat }),
  setExportMode: (exportMode) => set({ exportMode }),
  setExportScope: (exportScope) => set({ exportScope }),
  setTargetPlatform: (targetPlatform) => set({ targetPlatform }),
  setFilePrefix: (filePrefix) => set({ filePrefix }),
  setJpgBackground: (jpgBackground) => set({ jpgBackground }),
  setExportTransparentBackground: (exportTransparentBackground) => set({ exportTransparentBackground }),
  setAndroidResourceName: (androidResourceName) => set({ androidResourceName: sanitizeAndroidResourceName(androidResourceName) }),
  setDefaultSliceShape: (defaultSliceShape) => set({ defaultSliceShape }),
  setDefaultCornerRadius: (defaultCornerRadius) => set({ defaultCornerRadius }),
  setAspectRatioPreset: (aspectRatioPreset) => set({ aspectRatioPreset }),
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
  setScanMergeStrategy: (scanMergeStrategy) => set({ scanMergeStrategy }),
  setScanMergeDistance: (scanMergeDistance) => set({ scanMergeDistance }),
  setScanBridgeGap: (scanBridgeGap) => set({ scanBridgeGap }),
  setScanIgnoreText: (scanIgnoreText) => set({ scanIgnoreText }),
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
  clearSlices: () => {
    const { slices } = get();
    if (slices.length === 0) {
      set({ statusText: "没有可移除的选区" });
      return;
    }

    get().pushHistory();
    set({ slices: [], selectedSliceId: null, scanPreviewSlices: [], statusText: "已移除所有选区" });
  },
  closeCurrentImage: () => {
    set((state) => ({
      imageDocument: replaceImage(state.imageDocument, null),
      slices: [],
      pastSlices: [],
      futureSlices: [],
      selectedSliceId: null,
      scanPreviewSlices: [],
      isPickingScanBackground: false,
      pan: { x: 0, y: 0 },
      zoom: 1,
      pointerInfo: "坐标 0, 0",
      statusText: "当前图片已关闭",
      errorMessage: null,
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
  trimSelectedSlice: async () => {
    const { selectedSliceId } = get();
    if (!selectedSliceId) {
      set({ statusText: "请先选择一个切片" });
      return;
    }

    await trimSlices([selectedSliceId], get, set);
  },
  trimAllSlices: async () => {
    const sliceIds = get()
      .slices.filter((slice) => !slice.locked)
      .map((slice) => slice.id);
    await trimSlices(sliceIds, get, set);
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
      shape: state.defaultSliceShape,
      cornerRadius: state.defaultCornerRadius,
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
      activeTool: "grid",
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
        mergeStrategy: state.scanMergeStrategy,
        mergeDistance: state.scanMergeDistance,
        bridgeGap: state.scanBridgeGap,
        ignoreText: state.scanIgnoreText,
      });

      if (nextSlices.length === 0) {
        set({
          errorMessage: "没有识别到可用区域。可以降低阈值、减小最小面积，或切换识别方式再试。",
          statusText: "未识别到区域",
        });
        return;
      }

      state.pushHistory();
      set((current) => ({
        slices: replaceExisting ? nextSlices : [...current.slices, ...nextSlices],
        scanPreviewSlices: [],
        selectedSliceId: nextSlices[0].id,
        activeTool: "select",
        statusText: replaceExisting ? `已替换为 ${nextSlices.length} 个识别切片` : `已追加 ${nextSlices.length} 个识别切片`,
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
  applyScanPreview: (replaceExisting) => {
    const state = get();
    if (state.scanPreviewSlices.length === 0) {
      set({ statusText: "没有可应用的识别预览" });
      return;
    }

    const nextSlices = state.scanPreviewSlices.map((slice) => ({ ...slice, id: crypto.randomUUID() }));
    state.pushHistory();
    set((current) => ({
      slices: replaceExisting ? nextSlices : [...current.slices, ...nextSlices],
      scanPreviewSlices: [],
      selectedSliceId: nextSlices[0]?.id ?? null,
      activeTool: "select",
      statusText: replaceExisting ? `已替换为 ${nextSlices.length} 个识别切片` : `已追加 ${nextSlices.length} 个识别切片`,
    }));
  },
  removeScanPreviewSlice: (sliceId) => {
    set((state) => ({
      scanPreviewSlices: state.scanPreviewSlices.filter((slice) => slice.id !== sliceId),
      selectedSliceId: state.selectedSliceId === sliceId ? null : state.selectedSliceId,
      statusText: "已移除一个误识别区域",
    }));
  },
  clearScanPreview: () => set({ scanPreviewSlices: [], statusText: "识别预览已清空" }),
  startPickScanBackground: () => {
    if (!get().imageDocument) {
      set({ statusText: "请先导入图片" });
      return;
    }

    set({ activeTool: "scan", scanMode: "color", isPickingScanBackground: true, statusText: "点击画布取背景色" });
  },
  startPickExportBackground: () => {
    if (!get().imageDocument) {
      set({ statusText: "请先导入图片" });
      return;
    }

    set({ exportTransparentBackground: true, isPickingScanBackground: true, statusText: "点击画布取导出透明背景色" });
  },
  sampleScanBackgroundAt: async (x, y) => {
    const state = get();
    if (!state.imageDocument) {
      return;
    }

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
      const pixel = context.getImageData(x, y, 1, 1).data;
      set({
        scanBackgroundColor: toHexColor(pixel[0], pixel[1], pixel[2]),
        isPickingScanBackground: false,
        statusText: "背景色已取样",
      });
    } catch {
      set({ errorMessage: "背景色取样失败，请重新点击画布。", statusText: "取样失败", isPickingScanBackground: false });
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
        scanPreviewSlices: [],
        isPickingScanBackground: false,
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
        }
        return;
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
        scanPreviewSlices: [],
        isPickingScanBackground: false,
        pan: { x: 0, y: 0 },
        zoom: calculateFitZoom(bitmap.width, bitmap.height),
        pointerInfo: "坐标 0, 0",
        statusText: "项目已打开",
        exportFormat: project.settings.exportFormat,
        exportMode: project.settings.exportMode ?? "zip",
        exportScope: project.settings.exportScope,
        targetPlatform: project.settings.targetPlatform,
        enabledWebOutputIds: project.settings.enabledWebOutputIds,
        enabledAndroidOutputIds: project.settings.enabledAndroidOutputIds,
        enabledIosOutputIds: project.settings.enabledIosOutputIds,
        androidResourceName: project.settings.androidResourceName,
        filePrefix: project.settings.filePrefix,
        jpgBackground: project.settings.jpgBackground,
        exportTransparentBackground:
          project.settings.exportTransparentBackground ?? project.settings.scanTransparentBackground ?? true,
        defaultSliceShape: project.settings.defaultSliceShape ?? "rect",
        defaultCornerRadius: project.settings.defaultCornerRadius ?? 12,
        aspectRatioPreset: project.settings.aspectRatioPreset ?? "free",
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
        scanMergeStrategy: project.settings.scanMergeStrategy ?? "nearby",
        scanMergeDistance: project.settings.scanMergeDistance ?? 8,
        scanBridgeGap: project.settings.scanBridgeGap ?? 1,
        scanIgnoreText: project.settings.scanIgnoreText ?? true,
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
        exportMode: state.exportMode,
        exportScope: state.exportScope,
        targetPlatform: state.targetPlatform,
        enabledWebOutputIds: state.enabledWebOutputIds,
        enabledAndroidOutputIds: state.enabledAndroidOutputIds,
        enabledIosOutputIds: state.enabledIosOutputIds,
        androidResourceName: state.androidResourceName,
        filePrefix: state.filePrefix,
        jpgBackground: state.jpgBackground,
        exportTransparentBackground: state.exportTransparentBackground,
        defaultSliceShape: state.defaultSliceShape,
        defaultCornerRadius: state.defaultCornerRadius,
        aspectRatioPreset: state.aspectRatioPreset,
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
        scanMergeStrategy: state.scanMergeStrategy,
        scanMergeDistance: state.scanMergeDistance,
        scanBridgeGap: state.scanBridgeGap,
        scanIgnoreText: state.scanIgnoreText,
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
  openLastExportDirectory: async () => {
    const { lastExportDirectory } = get();
    if (!lastExportDirectory) {
      set({ statusText: "还没有可打开的导出目录" });
      return;
    }

    try {
      await openPath(lastExportDirectory);
    } catch {
      set({ errorMessage: "导出目录无法打开，请确认目录还存在。", statusText: "打开目录失败" });
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
        exportMode: state.exportMode,
        transparentBackground:
          state.exportTransparentBackground ? { color: state.scanBackgroundColor, tolerance: state.scanColorTolerance } : null,
      });

      if (result.ok) {
        set({ statusText: result.statusText, lastExportDirectory: result.exportDirectory ?? state.lastExportDirectory });
        return;
      }

      set({ errorMessage: result.errorMessage, statusText: result.statusText });
    } catch (error) {
      set({
        errorMessage: `导出失败：${getErrorMessage(error)}`,
        statusText: "导出失败",
      });
    } finally {
      set({ isExporting: false });
    }
  },
}));

async function trimSlices(
  sliceIds: string[],
  get: () => WorkspaceState,
  set: (
    partial:
      | Partial<WorkspaceState>
      | ((state: WorkspaceState) => Partial<WorkspaceState>),
  ) => void,
) {
  const state = get();
  if (!state.imageDocument) {
    set({ statusText: "请先导入图片" });
    return;
  }

  const candidates = state.slices.filter((slice) => sliceIds.includes(slice.id) && !slice.locked);
  if (candidates.length === 0) {
    set({ statusText: "没有可收紧的切片" });
    return;
  }

  try {
    const sourceImage = await loadImage(state.imageDocument.url);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("Canvas is unavailable");
    }

    const updates = new Map<string, Partial<SliceRegion>>();
    for (const slice of candidates) {
      canvas.width = slice.width;
      canvas.height = slice.height;
      context.clearRect(0, 0, slice.width, slice.height);
      context.drawImage(sourceImage, slice.x, slice.y, slice.width, slice.height, 0, 0, slice.width, slice.height);
      const bounds = findOpaqueBounds(context.getImageData(0, 0, slice.width, slice.height), state.scanAlphaThreshold);

      if (!bounds) {
        continue;
      }

      if (bounds.x === 0 && bounds.y === 0 && bounds.width === slice.width && bounds.height === slice.height) {
        continue;
      }

      updates.set(slice.id, {
        x: slice.x + bounds.x,
        y: slice.y + bounds.y,
        width: bounds.width,
        height: bounds.height,
      });
    }

    if (updates.size === 0) {
      set({ statusText: "切片已经贴合透明边" });
      return;
    }

    state.pushHistory();
    set((current) => ({
      slices: current.slices.map((slice) => {
        const patch = updates.get(slice.id);
        return patch ? { ...slice, ...patch } : slice;
      }),
      statusText: `已收紧 ${updates.size} 个切片`,
    }));
  } catch {
    set({ errorMessage: "透明边收紧失败，请换一张图片或重新导入后再试。", statusText: "收紧失败" });
  }
}

function toHexColor(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((value) => Math.max(0, Math.min(Math.round(value), 255)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "请检查保存位置、图片和选区后再试。";
}
