import {
  BoxSelect,
  Download,
  FileUp,
  FolderOpen,
  Grid3X3,
  MousePointer2,
  Plus,
  Redo2,
  Save,
  ScanSearch,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import JSZip from "jszip";
import {
  ChangeEvent,
  DragEvent,
  PointerEvent,
  WheelEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type ImageDocument = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  width: number;
  height: number;
  hasAlpha: boolean;
  url: string;
};

type PanState = {
  x: number;
  y: number;
};

type ToolId = "select" | "rect" | "grid" | "scan";

type SliceRegion = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  enabled: boolean;
  locked: boolean;
};

type ResizeHandle = "nw" | "ne" | "sw" | "se";
type ExportFormat = "png" | "jpg" | "webp";
type ExportScope = "selected" | "enabled";
type TargetPlatform = "generic" | "android" | "ios" | "web" | "custom";
type GridMode = "fixed" | "equal";
type GridOrder = "row" | "column";
type ScanMode = "auto" | "alpha" | "color";

type WebIconOutput = {
  id: string;
  label: string;
  width: number;
  height: number;
  fileName: string;
  purpose?: "any" | "maskable";
};

type AndroidIconOutput = {
  id: string;
  label: string;
  density: "mdpi" | "hdpi" | "xhdpi" | "xxhdpi" | "xxxhdpi";
  width: number;
  height: number;
  directory: string;
};

type IosIconOutput = {
  id: string;
  label: string;
  idiom: "iphone" | "ipad" | "ios-marketing";
  size: string;
  scale: "1x" | "2x" | "3x";
  width: number;
  height: number;
  fileName: string;
};

type CustomIconOutput = {
  id: string;
  label: string;
  width: number;
  height: number;
  fileName: string;
};

type SavedProject = {
  version: 1;
  savedAt: string;
  image: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    width: number;
    height: number;
    hasAlpha: boolean;
    dataUrl: string;
  };
  slices: SliceRegion[];
  selectedSliceId: string | null;
  settings: {
    exportFormat: ExportFormat;
    exportScope: ExportScope;
    targetPlatform: TargetPlatform;
    enabledWebOutputIds: string[];
    enabledAndroidOutputIds: string[];
    enabledIosOutputIds: string[];
    androidResourceName: string;
    filePrefix: string;
    jpgBackground: string;
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
    customIconOutputs: CustomIconOutput[];
    enabledCustomOutputIds: string[];
  };
};

type CustomPresetFile = {
  version: 1;
  savedAt: string;
  outputs: CustomIconOutput[];
};

type Interaction =
  | { mode: "pan"; pointerX: number; pointerY: number; pan: PanState }
  | { mode: "create"; sliceId: string; startX: number; startY: number }
  | { mode: "move"; sliceId: string; pointerX: number; pointerY: number; original: SliceRegion }
  | {
      mode: "resize";
      sliceId: string;
      pointerX: number;
      pointerY: number;
      original: SliceRegion;
      handle: ResizeHandle;
    };

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

const tools: Array<{ id: ToolId; label: string; icon: typeof MousePointer2 }> = [
  { id: "select", label: "选择", icon: MousePointer2 },
  { id: "rect", label: "矩形", icon: BoxSelect },
  { id: "grid", label: "网格", icon: Grid3X3 },
  { id: "scan", label: "识别", icon: ScanSearch },
];

const WEB_ICON_OUTPUTS: WebIconOutput[] = [
  { id: "favicon-16", label: "Favicon 16", width: 16, height: 16, fileName: "favicon-16x16.png" },
  { id: "favicon-32", label: "Favicon 32", width: 32, height: 32, fileName: "favicon-32x32.png" },
  { id: "favicon-48", label: "Favicon 48", width: 48, height: 48, fileName: "favicon-48x48.png" },
  { id: "apple-touch-180", label: "Apple Touch 180", width: 180, height: 180, fileName: "apple-touch-icon.png" },
  { id: "pwa-192", label: "PWA 192", width: 192, height: 192, fileName: "icon-192x192.png", purpose: "any" },
  { id: "pwa-512", label: "PWA 512", width: 512, height: 512, fileName: "icon-512x512.png", purpose: "any" },
  {
    id: "maskable-512",
    label: "Maskable 512",
    width: 512,
    height: 512,
    fileName: "maskable-icon-512x512.png",
    purpose: "maskable",
  },
];

const ANDROID_ICON_OUTPUTS: AndroidIconOutput[] = [
  { id: "launcher-mdpi", label: "Launcher mdpi", density: "mdpi", width: 48, height: 48, directory: "mipmap-mdpi" },
  { id: "launcher-hdpi", label: "Launcher hdpi", density: "hdpi", width: 72, height: 72, directory: "mipmap-hdpi" },
  { id: "launcher-xhdpi", label: "Launcher xhdpi", density: "xhdpi", width: 96, height: 96, directory: "mipmap-xhdpi" },
  {
    id: "launcher-xxhdpi",
    label: "Launcher xxhdpi",
    density: "xxhdpi",
    width: 144,
    height: 144,
    directory: "mipmap-xxhdpi",
  },
  {
    id: "launcher-xxxhdpi",
    label: "Launcher xxxhdpi",
    density: "xxxhdpi",
    width: 192,
    height: 192,
    directory: "mipmap-xxxhdpi",
  },
];

const IOS_ICON_OUTPUTS: IosIconOutput[] = [
  {
    id: "iphone-notification-2x",
    label: "iPhone Notification 2x",
    idiom: "iphone",
    size: "20x20",
    scale: "2x",
    width: 40,
    height: 40,
    fileName: "iphone-notification-20@2x.png",
  },
  {
    id: "iphone-notification-3x",
    label: "iPhone Notification 3x",
    idiom: "iphone",
    size: "20x20",
    scale: "3x",
    width: 60,
    height: 60,
    fileName: "iphone-notification-20@3x.png",
  },
  {
    id: "iphone-settings-2x",
    label: "iPhone Settings 2x",
    idiom: "iphone",
    size: "29x29",
    scale: "2x",
    width: 58,
    height: 58,
    fileName: "iphone-settings-29@2x.png",
  },
  {
    id: "iphone-settings-3x",
    label: "iPhone Settings 3x",
    idiom: "iphone",
    size: "29x29",
    scale: "3x",
    width: 87,
    height: 87,
    fileName: "iphone-settings-29@3x.png",
  },
  {
    id: "iphone-spotlight-2x",
    label: "iPhone Spotlight 2x",
    idiom: "iphone",
    size: "40x40",
    scale: "2x",
    width: 80,
    height: 80,
    fileName: "iphone-spotlight-40@2x.png",
  },
  {
    id: "iphone-spotlight-3x",
    label: "iPhone Spotlight 3x",
    idiom: "iphone",
    size: "40x40",
    scale: "3x",
    width: 120,
    height: 120,
    fileName: "iphone-spotlight-40@3x.png",
  },
  {
    id: "iphone-app-2x",
    label: "iPhone App 2x",
    idiom: "iphone",
    size: "60x60",
    scale: "2x",
    width: 120,
    height: 120,
    fileName: "iphone-app-60@2x.png",
  },
  {
    id: "iphone-app-3x",
    label: "iPhone App 3x",
    idiom: "iphone",
    size: "60x60",
    scale: "3x",
    width: 180,
    height: 180,
    fileName: "iphone-app-60@3x.png",
  },
  {
    id: "ipad-app-2x",
    label: "iPad App 2x",
    idiom: "ipad",
    size: "76x76",
    scale: "2x",
    width: 152,
    height: 152,
    fileName: "ipad-app-76@2x.png",
  },
  {
    id: "ipad-pro-app-2x",
    label: "iPad Pro App 2x",
    idiom: "ipad",
    size: "83.5x83.5",
    scale: "2x",
    width: 167,
    height: 167,
    fileName: "ipad-pro-app-83_5@2x.png",
  },
  {
    id: "app-store-1024",
    label: "App Store 1024",
    idiom: "ios-marketing",
    size: "1024x1024",
    scale: "1x",
    width: 1024,
    height: 1024,
    fileName: "ios-marketing-1024.png",
  },
];

const DEFAULT_CUSTOM_ICON_OUTPUTS: CustomIconOutput[] = [
  { id: "custom-64", label: "Icon 64", width: 64, height: 64, fileName: "icon-64x64.png" },
  { id: "custom-128", label: "Icon 128", width: 128, height: 128, fileName: "icon-128x128.png" },
  { id: "custom-256", label: "Icon 256", width: 256, height: 256, fileName: "icon-256x256.png" },
];

export function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const customPresetInputRef = useRef<HTMLInputElement>(null);
  const canvasPanelRef = useRef<HTMLElement>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const [imageDocument, setImageDocument] = useState<ImageDocument | null>(null);
  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [slices, setSlices] = useState<SliceRegion[]>([]);
  const [pastSlices, setPastSlices] = useState<SliceRegion[][]>([]);
  const [futureSlices, setFutureSlices] = useState<SliceRegion[][]>([]);
  const [selectedSliceId, setSelectedSliceId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [statusText, setStatusText] = useState("就绪");
  const [pointerInfo, setPointerInfo] = useState("坐标 0, 0");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exportScope, setExportScope] = useState<ExportScope>("enabled");
  const [targetPlatform, setTargetPlatform] = useState<TargetPlatform>("generic");
  const [enabledWebOutputIds, setEnabledWebOutputIds] = useState<string[]>([
    "favicon-16",
    "favicon-32",
    "favicon-48",
    "apple-touch-180",
    "pwa-192",
    "pwa-512",
  ]);
  const [enabledAndroidOutputIds, setEnabledAndroidOutputIds] = useState<string[]>(
    ANDROID_ICON_OUTPUTS.map((output) => output.id),
  );
  const [enabledIosOutputIds, setEnabledIosOutputIds] = useState<string[]>(
    IOS_ICON_OUTPUTS.map((output) => output.id),
  );
  const [androidResourceName, setAndroidResourceName] = useState("ic_launcher");
  const [filePrefix, setFilePrefix] = useState("slice");
  const [jpgBackground, setJpgBackground] = useState("#ffffff");
  const [isExporting, setIsExporting] = useState(false);
  const [gridMode, setGridMode] = useState<GridMode>("fixed");
  const [gridWidth, setGridWidth] = useState(128);
  const [gridHeight, setGridHeight] = useState(128);
  const [gridStartX, setGridStartX] = useState(0);
  const [gridStartY, setGridStartY] = useState(0);
  const [gridGapX, setGridGapX] = useState(0);
  const [gridGapY, setGridGapY] = useState(0);
  const [gridRows, setGridRows] = useState(3);
  const [gridColumns, setGridColumns] = useState(3);
  const [gridOrder, setGridOrder] = useState<GridOrder>("row");
  const [scanMode, setScanMode] = useState<ScanMode>("auto");
  const [scanAlphaThreshold, setScanAlphaThreshold] = useState(16);
  const [scanBackgroundColor, setScanBackgroundColor] = useState("#ffffff");
  const [scanColorTolerance, setScanColorTolerance] = useState(24);
  const [scanMinArea, setScanMinArea] = useState(64);
  const [scanMinSize, setScanMinSize] = useState(4);
  const [scanPadding, setScanPadding] = useState(2);
  const [isScanning, setIsScanning] = useState(false);
  const [customIconOutputs, setCustomIconOutputs] = useState<CustomIconOutput[]>(DEFAULT_CUSTOM_ICON_OUTPUTS);
  const [enabledCustomOutputIds, setEnabledCustomOutputIds] = useState<string[]>(
    DEFAULT_CUSTOM_ICON_OUTPUTS.map((output) => output.id),
  );

  const selectedSlice = slices.find((slice) => slice.id === selectedSliceId) ?? null;
  const enabledWebOutputs = WEB_ICON_OUTPUTS.filter((output) => enabledWebOutputIds.includes(output.id));
  const enabledAndroidOutputs = ANDROID_ICON_OUTPUTS.filter((output) => enabledAndroidOutputIds.includes(output.id));
  const enabledIosOutputs = IOS_ICON_OUTPUTS.filter((output) => enabledIosOutputIds.includes(output.id));
  const enabledCustomOutputs = customIconOutputs.filter((output) => enabledCustomOutputIds.includes(output.id));
  const platformOutputCount =
    targetPlatform === "android"
      ? enabledAndroidOutputs.length
      : targetPlatform === "ios"
        ? enabledIosOutputs.length
        : targetPlatform === "web"
          ? enabledWebOutputs.length
          : targetPlatform === "custom"
            ? enabledCustomOutputs.length
            : 1;

  useEffect(() => {
    return () => {
      if (imageDocument) {
        URL.revokeObjectURL(imageDocument.url);
      }
    };
  }, [imageDocument]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.key === "Delete" || event.key === "Backspace") && selectedSliceId) {
        event.preventDefault();
        deleteSlice(selectedSliceId);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSliceId, slices]);

  useEffect(() => {
    function handleWindowDragOver(event: globalThis.DragEvent) {
      event.preventDefault();
      if (Array.from(event.dataTransfer?.types ?? []).includes("Files")) {
        setIsDraggingOver(true);
      }
    }

    function handleWindowDrop(event: globalThis.DragEvent) {
      event.preventDefault();
      setIsDraggingOver(false);
      const file = Array.from(event.dataTransfer?.files ?? [])[0];

      if (file) {
        void openDroppedFile(file);
      }
    }

    function handleWindowDragLeave(event: globalThis.DragEvent) {
      if (event.clientX <= 0 || event.clientY <= 0) {
        setIsDraggingOver(false);
      }
    }

    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("drop", handleWindowDrop);
    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, []);

  async function openFile(file: File) {
    setErrorMessage(null);

    if (!isAcceptedImageFile(file)) {
      setErrorMessage("暂时只支持 PNG、JPG/JPEG、WebP 图片。");
      setStatusText("导入失败");
      return;
    }

    try {
      const mimeType = file.type || getMimeTypeFromFileName(file.name);
      const imageFile = file.type ? file : new File([file], file.name, { type: mimeType });
      const url = URL.createObjectURL(imageFile);
      const bitmap = await createImageBitmap(imageFile);
      const hasAlpha = await detectAlphaChannel(bitmap);

      setImageDocument((current) => {
        if (current) {
          URL.revokeObjectURL(current.url);
        }

        return {
          fileName: file.name,
          fileSize: file.size,
          mimeType,
          width: bitmap.width,
          height: bitmap.height,
          hasAlpha,
          url,
        };
      });

      setSlices([]);
      setPastSlices([]);
      setFutureSlices([]);
      setSelectedSliceId(null);
      setPan({ x: 0, y: 0 });
      setZoom(calculateFitZoom(bitmap.width, bitmap.height));
      setStatusText("图片已导入");
      setPointerInfo("坐标 0, 0");
      bitmap.close();
    } catch {
      setErrorMessage("图片解析失败，请换一张图片再试。");
      setStatusText("导入失败");
    }
  }

  async function openImageFromDesktopDialog() {
    try {
      const [{ open }, { readFile }] = await Promise.all([
        import("@tauri-apps/plugin-dialog"),
        import("@tauri-apps/plugin-fs"),
      ]);
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "webp"],
          },
        ],
      });

      if (!selected || Array.isArray(selected)) {
        return false;
      }

      const bytes = await readFile(selected);
      const fileName = selected.split(/[\\/]/).pop() ?? "image";
      const mimeType = getMimeTypeFromFileName(fileName);
      const file = new File([new Blob([bytes], { type: mimeType })], fileName, { type: mimeType });
      await openFile(file);
      return true;
    } catch {
      return false;
    }
  }

  async function handleOpenImageClick() {
    if (isTauriRuntime()) {
      const opened = await openImageFromDesktopDialog();
      if (opened) {
        return;
      }
    }

    fileInputRef.current?.click();
  }

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

  async function handleCustomPresetFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      await openCustomPresetFile(file);
    }
    event.target.value = "";
  }

  async function saveProjectFile() {
    if (!imageDocument) {
      setStatusText("请先导入图片");
      return;
    }

    try {
      setErrorMessage(null);
      setStatusText("正在保存项目");
      const dataUrl = await blobUrlToDataUrl(imageDocument.url);
      const project: SavedProject = {
        version: 1,
        savedAt: new Date().toISOString(),
        image: {
          fileName: imageDocument.fileName,
          fileSize: imageDocument.fileSize,
          mimeType: imageDocument.mimeType,
          width: imageDocument.width,
          height: imageDocument.height,
          hasAlpha: imageDocument.hasAlpha,
          dataUrl,
        },
        slices,
        selectedSliceId,
        settings: {
          exportFormat,
          exportScope,
          targetPlatform,
          enabledWebOutputIds,
          enabledAndroidOutputIds,
          enabledIosOutputIds,
          androidResourceName,
          filePrefix,
          jpgBackground,
          gridMode,
          gridWidth,
          gridHeight,
          gridStartX,
          gridStartY,
          gridGapX,
          gridGapY,
          gridRows,
          gridColumns,
          gridOrder,
          scanMode,
          scanAlphaThreshold,
          scanBackgroundColor,
          scanColorTolerance,
          scanMinArea,
          scanMinSize,
          scanPadding,
          customIconOutputs,
          enabledCustomOutputIds,
        },
      };

      const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
      await saveBlob(blob, `${sanitizeFileName(filePrefix || imageDocument.fileName || "image-slicing")}.ist-project.json`);
      setStatusText("项目已保存");
    } catch {
      setErrorMessage("项目保存失败，请稍后再试。");
      setStatusText("项目保存失败");
    }
  }

  async function openProjectFile(file: File) {
    try {
      setErrorMessage(null);
      setStatusText("正在打开项目");
      const project = JSON.parse(await file.text()) as SavedProject;

      if (!isSavedProject(project)) {
        throw new Error("Invalid project file");
      }

      const imageFile = dataUrlToFile(project.image.dataUrl, project.image.fileName, project.image.mimeType);
      const url = URL.createObjectURL(imageFile);
      const bitmap = await createImageBitmap(imageFile);

      setImageDocument((current) => {
        if (current) {
          URL.revokeObjectURL(current.url);
        }

        return {
          fileName: project.image.fileName,
          fileSize: project.image.fileSize,
          mimeType: project.image.mimeType,
          width: bitmap.width,
          height: bitmap.height,
          hasAlpha: project.image.hasAlpha,
          url,
        };
      });

      const restoredSlices = project.slices.map((slice) => ({
        ...slice,
        id: slice.id || crypto.randomUUID(),
      }));
      const restoredSelectedId =
        project.selectedSliceId && restoredSlices.some((slice) => slice.id === project.selectedSliceId)
          ? project.selectedSliceId
          : restoredSlices[0]?.id ?? null;

      setSlices(restoredSlices);
      setPastSlices([]);
      setFutureSlices([]);
      setSelectedSliceId(restoredSelectedId);
      restoreProjectSettings(project.settings);
      setPan({ x: 0, y: 0 });
      setZoom(calculateFitZoom(bitmap.width, bitmap.height));
      setPointerInfo("坐标 0, 0");
      setStatusText("项目已打开");
      bitmap.close();
    } catch {
      setErrorMessage("项目文件无法打开，请确认它是有效的 .ist-project.json 文件。");
      setStatusText("项目打开失败");
    }
  }

  function restoreProjectSettings(settings: SavedProject["settings"]) {
    setExportFormat(settings.exportFormat);
    setExportScope(settings.exportScope);
    setTargetPlatform(settings.targetPlatform);
    setEnabledWebOutputIds(settings.enabledWebOutputIds);
    setEnabledAndroidOutputIds(settings.enabledAndroidOutputIds);
    setEnabledIosOutputIds(settings.enabledIosOutputIds);
    setAndroidResourceName(settings.androidResourceName);
    setFilePrefix(settings.filePrefix);
    setJpgBackground(settings.jpgBackground);
    setGridMode(settings.gridMode);
    setGridWidth(settings.gridWidth);
    setGridHeight(settings.gridHeight);
    setGridStartX(settings.gridStartX);
    setGridStartY(settings.gridStartY);
    setGridGapX(settings.gridGapX);
    setGridGapY(settings.gridGapY);
    setGridRows(settings.gridRows);
    setGridColumns(settings.gridColumns);
    setGridOrder(settings.gridOrder);
    setScanMode(settings.scanMode);
    setScanAlphaThreshold(settings.scanAlphaThreshold);
    setScanBackgroundColor(settings.scanBackgroundColor);
    setScanColorTolerance(settings.scanColorTolerance);
    setScanMinArea(settings.scanMinArea);
    setScanMinSize(settings.scanMinSize);
    setScanPadding(settings.scanPadding);
    setCustomIconOutputs(settings.customIconOutputs);
    setEnabledCustomOutputIds(settings.enabledCustomOutputIds);
  }

  async function saveCustomPresetFile() {
    try {
      const preset: CustomPresetFile = {
        version: 1,
        savedAt: new Date().toISOString(),
        outputs: customIconOutputs,
      };
      const blob = new Blob([JSON.stringify(preset, null, 2)], { type: "application/json" });
      await saveBlob(blob, `${sanitizeFileName(filePrefix || "custom-icon-preset")}.custom-preset.json`);
      setStatusText("自定义预设已保存");
    } catch {
      setErrorMessage("自定义预设保存失败，请稍后再试。");
      setStatusText("预设保存失败");
    }
  }

  async function openCustomPresetFile(file: File) {
    try {
      const preset = JSON.parse(await file.text()) as CustomPresetFile;

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

      setCustomIconOutputs(restoredOutputs);
      setEnabledCustomOutputIds(restoredOutputs.map((output) => output.id));
      setTargetPlatform("custom");
      setErrorMessage(null);
      setStatusText("自定义预设已打开");
    } catch {
      setErrorMessage("自定义预设无法打开，请确认它是有效的 custom-preset.json 文件。");
      setStatusText("预设打开失败");
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDraggingOver(false);

    const file = Array.from(event.dataTransfer.files).find((item) => isAcceptedImageFile(item)) ?? event.dataTransfer.files[0];

    if (file) {
      void openDroppedFile(file);
    }
  }

  async function openDroppedFile(file: File) {
    if (isAcceptedImageFile(file)) {
      await openFile(file);
      return;
    }

    if (file.name.endsWith(".ist-project.json")) {
      await openProjectFile(file);
      return;
    }

    if (file.name.endsWith(".custom-preset.json")) {
      await openCustomPresetFile(file);
      return;
    }

    setErrorMessage("拖入文件暂时只支持图片、项目文件和自定义预设。");
    setStatusText("拖拽导入失败");
  }

  function changeZoom(nextZoom: number) {
    setZoom(clamp(nextZoom, MIN_ZOOM, MAX_ZOOM));
  }

  function fitToWindow() {
    if (!imageDocument) {
      return;
    }

    setPan({ x: 0, y: 0 });
    setZoom(calculateFitZoom(imageDocument.width, imageDocument.height));
    setStatusText("已适应窗口");
  }

  function handleWheel(event: WheelEvent<HTMLElement>) {
    if (!imageDocument) {
      return;
    }

    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    changeZoom(zoom + delta);
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (!imageDocument) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    if (activeTool === "rect") {
      const point = getImagePoint(event);
      if (!point) {
        return;
      }

      pushHistory();
      const sliceId = crypto.randomUUID();
      const nextSlice: SliceRegion = {
        id: sliceId,
        name: `slice_${slices.length + 1}`,
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        enabled: true,
        locked: false,
      };

      setSlices((current) => [...current, nextSlice]);
      setSelectedSliceId(sliceId);
      interactionRef.current = { mode: "create", sliceId, startX: point.x, startY: point.y };
      setStatusText("创建矩形选区");
      return;
    }

    interactionRef.current = {
      mode: "pan",
      pointerX: event.clientX,
      pointerY: event.clientY,
      pan,
    };
    setSelectedSliceId(null);
    setIsPanning(true);
    setStatusText("拖动画布");
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    updatePointerInfo(event);

    const interaction = interactionRef.current;
    if (!interaction || !imageDocument) {
      return;
    }

    if (interaction.mode === "pan") {
      setPan({
        x: interaction.pan.x + event.clientX - interaction.pointerX,
        y: interaction.pan.y + event.clientY - interaction.pointerY,
      });
      return;
    }

    if (interaction.mode === "create") {
      const point = getImagePoint(event);
      if (!point) {
        return;
      }

      updateSlice(
        interaction.sliceId,
        normalizeRect(
          interaction.startX,
          interaction.startY,
          point.x - interaction.startX,
          point.y - interaction.startY,
          imageDocument,
        ),
      );
      return;
    }

    if (interaction.mode === "move") {
      const deltaX = (event.clientX - interaction.pointerX) / zoom;
      const deltaY = (event.clientY - interaction.pointerY) / zoom;
      updateSlice(interaction.sliceId, {
        x: Math.round(clamp(interaction.original.x + deltaX, 0, imageDocument.width - interaction.original.width)),
        y: Math.round(clamp(interaction.original.y + deltaY, 0, imageDocument.height - interaction.original.height)),
      });
      return;
    }

    if (interaction.mode === "resize") {
      const deltaX = (event.clientX - interaction.pointerX) / zoom;
      const deltaY = (event.clientY - interaction.pointerY) / zoom;
      updateSlice(interaction.sliceId, resizeSlice(interaction.original, interaction.handle, deltaX, deltaY, imageDocument));
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    const interaction = interactionRef.current;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (interaction?.mode === "create") {
      const createdSlice = slices.find((slice) => slice.id === interaction.sliceId);
      if (createdSlice && (createdSlice.width < 3 || createdSlice.height < 3)) {
        setSlices((current) => current.filter((slice) => slice.id !== interaction.sliceId));
        setSelectedSliceId(null);
        setStatusText("选区太小，已取消");
      } else {
        setActiveTool("select");
        setStatusText("矩形选区已创建");
      }
    } else if (interaction?.mode === "move") {
      setStatusText("选区已移动");
    } else if (interaction?.mode === "resize") {
      setStatusText("选区尺寸已调整");
    } else {
      setStatusText(imageDocument ? "图片查看中" : "就绪");
    }

    interactionRef.current = null;
    setIsPanning(false);
  }

  function handleSlicePointerDown(event: PointerEvent<HTMLDivElement>, slice: SliceRegion) {
    event.stopPropagation();
    if (!imageDocument || slice.locked) {
      return;
    }

    pushHistory();
    canvasPanelRef.current?.setPointerCapture(event.pointerId);
    setSelectedSliceId(slice.id);
    interactionRef.current = {
      mode: "move",
      sliceId: slice.id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      original: slice,
    };
    setStatusText("移动选区");
  }

  function handleResizePointerDown(
    event: PointerEvent<HTMLButtonElement>,
    slice: SliceRegion,
    handle: ResizeHandle,
  ) {
    event.stopPropagation();
    if (!imageDocument || slice.locked) {
      return;
    }

    pushHistory();
    canvasPanelRef.current?.setPointerCapture(event.pointerId);
    setSelectedSliceId(slice.id);
    interactionRef.current = {
      mode: "resize",
      sliceId: slice.id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      original: slice,
      handle,
    };
    setStatusText("调整选区尺寸");
  }

  function updatePointerInfo(event: PointerEvent<HTMLElement>) {
    const point = getImagePoint(event);
    if (!point) {
      setPointerInfo("坐标 --, --");
      return;
    }

    setPointerInfo(`坐标 ${point.x}, ${point.y}`);
  }

  function getImagePoint(event: PointerEvent<HTMLElement>) {
    if (!imageDocument || !canvasPanelRef.current) {
      return null;
    }

    const rect = canvasPanelRef.current.getBoundingClientRect();
    const centerX = rect.width / 2 + pan.x;
    const centerY = rect.height / 2 + pan.y;
    const imageX = Math.round((event.clientX - rect.left - centerX) / zoom + imageDocument.width / 2);
    const imageY = Math.round((event.clientY - rect.top - centerY) / zoom + imageDocument.height / 2);

    if (imageX < 0 || imageY < 0 || imageX > imageDocument.width || imageY > imageDocument.height) {
      return null;
    }

    return { x: imageX, y: imageY };
  }

  function updateSlice(sliceId: string, patch: Partial<SliceRegion>) {
    setSlices((current) =>
      current.map((slice) => (slice.id === sliceId ? { ...slice, ...patch } : slice)),
    );
  }

  function deleteSlice(sliceId: string) {
    pushHistory();
    setSlices((current) => current.filter((slice) => slice.id !== sliceId));
    setSelectedSliceId((current) => (current === sliceId ? null : current));
    setStatusText("选区已删除");
  }

  function pushHistory() {
    setPastSlices((current) => [...current, slices]);
    setFutureSlices([]);
  }

  function undo() {
    if (pastSlices.length === 0) {
      return;
    }

    const previous = pastSlices[pastSlices.length - 1];
    setPastSlices((current) => current.slice(0, -1));
    setFutureSlices((current) => [slices, ...current]);
    setSlices(previous);
    setSelectedSliceId((current) =>
      current && previous.some((slice) => slice.id === current) ? current : previous.at(-1)?.id ?? null,
    );
    setStatusText("已撤销");
  }

  function redo() {
    if (futureSlices.length === 0) {
      return;
    }

    const next = futureSlices[0];
    setFutureSlices((current) => current.slice(1));
    setPastSlices((current) => [...current, slices]);
    setSlices(next);
    setSelectedSliceId((current) =>
      current && next.some((slice) => slice.id === current) ? current : next.at(-1)?.id ?? null,
    );
    setStatusText("已重做");
  }

  function handleNumericChange(field: "x" | "y" | "width" | "height", value: string) {
    if (!selectedSlice || !imageDocument) {
      return;
    }

    const numericValue = Number.parseInt(value || "0", 10);
    if (Number.isNaN(numericValue)) {
      return;
    }

    const nextValue = Math.round(numericValue);
    pushHistory();
    if (field === "x") {
      updateSlice(selectedSlice.id, {
        x: clamp(nextValue, 0, imageDocument.width - selectedSlice.width),
      });
    }

    if (field === "y") {
      updateSlice(selectedSlice.id, {
        y: clamp(nextValue, 0, imageDocument.height - selectedSlice.height),
      });
    }

    if (field === "width") {
      updateSlice(selectedSlice.id, {
        width: clamp(nextValue, 1, imageDocument.width - selectedSlice.x),
      });
    }

    if (field === "height") {
      updateSlice(selectedSlice.id, {
        height: clamp(nextValue, 1, imageDocument.height - selectedSlice.y),
      });
    }
  }

  async function handleExport() {
    if (!imageDocument) {
      setStatusText("请先导入图片");
      return;
    }

    const exportSlices = getExportSlices();
    const exportIssue = validateExport(exportSlices, imageDocument);
    if (exportIssue) {
      setErrorMessage(exportIssue);
      setStatusText("导出前检查未通过");
      return;
    }

    if (targetPlatform === "web" && enabledWebOutputs.length === 0) {
      setErrorMessage("请至少选择一个 Web icon 尺寸。");
      setStatusText("导出前检查未通过");
      return;
    }

    if (targetPlatform === "android" && enabledAndroidOutputs.length === 0) {
      setErrorMessage("请至少选择一个 Android density。");
      setStatusText("导出前检查未通过");
      return;
    }

    if (targetPlatform === "ios" && enabledIosOutputs.length === 0) {
      setErrorMessage("请至少选择一个 iOS icon 尺寸。");
      setStatusText("导出前检查未通过");
      return;
    }

    if (targetPlatform === "custom" && enabledCustomOutputs.length === 0) {
      setErrorMessage("请至少启用一个自定义尺寸。");
      setStatusText("导出前检查未通过");
      return;
    }

    if (targetPlatform === "android" && !isValidAndroidResourceName(androidResourceName)) {
      setErrorMessage("Android 资源名只能使用小写字母、数字和下划线，并且不能以数字开头。");
      setStatusText("导出前检查未通过");
      return;
    }

    setIsExporting(true);
    setErrorMessage(null);
    setStatusText("正在导出");

    try {
      const sourceImage = await loadImage(imageDocument.url);

      if (targetPlatform === "web") {
        await exportWebIconPackage(sourceImage, exportSlices);
        setStatusText(`已导出 Web 资源包：${exportSlices.length} 个切片`);
        return;
      }

      if (targetPlatform === "android") {
        await exportAndroidIconPackage(sourceImage, exportSlices);
        setStatusText(`已导出 Android 资源包：${exportSlices.length} 个切片`);
        return;
      }

      if (targetPlatform === "ios") {
        await exportIosIconPackage(sourceImage, exportSlices);
        setStatusText(`已导出 iOS 资源包：${exportSlices.length} 个切片`);
        return;
      }

      if (targetPlatform === "custom") {
        await exportCustomIconPackage(sourceImage, exportSlices);
        setStatusText(`已导出自定义资源包：${exportSlices.length} 个切片`);
        return;
      }

      const extension = getExtension(exportFormat);

      if (exportSlices.length === 1) {
        const slice = exportSlices[0];
        const blob = await renderSlice(sourceImage, slice, exportFormat, jpgBackground);
        await saveBlob(blob, `${buildFileName(filePrefix, slice, 1)}.${extension}`);
      } else {
        const zip = new JSZip();
        for (let index = 0; index < exportSlices.length; index += 1) {
          const slice = exportSlices[index];
          const blob = await renderSlice(sourceImage, slice, exportFormat, jpgBackground);
          zip.file(`${buildFileName(filePrefix, slice, index + 1)}.${extension}`, blob);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        await saveBlob(zipBlob, `${sanitizeFileName(filePrefix || "slices")}.zip`);
      }

      setStatusText(`已导出 ${exportSlices.length} 个切片`);
    } catch {
      setErrorMessage("导出失败，请检查图片和选区后再试。");
      setStatusText("导出失败");
    } finally {
      setIsExporting(false);
    }
  }

  function getExportSlices() {
    if (exportScope === "selected") {
      return selectedSlice ? [selectedSlice] : [];
    }

    return slices.filter((slice) => slice.enabled);
  }

  async function exportWebIconPackage(sourceImage: HTMLImageElement, exportSlices: SliceRegion[]) {
    if (enabledWebOutputs.length === 0) {
      throw new Error("No web icon outputs selected");
    }

    const zip = new JSZip();
    const manifestIcons: Array<{ src: string; sizes: string; type: string; purpose?: string }> = [];
    const htmlLinks: string[] = [];
    const reportLines = [
      "# Web Icon Export Report",
      "",
      `Source: ${imageDocument?.fileName ?? "unknown"}`,
      `Slices: ${exportSlices.length}`,
      `Outputs per slice: ${enabledWebOutputs.length}`,
      "",
    ];

    for (let sliceIndex = 0; sliceIndex < exportSlices.length; sliceIndex += 1) {
      const slice = exportSlices[sliceIndex];
      const sliceFolder = sanitizeFileName(slice.name || `slice_${sliceIndex + 1}`);
      const outputRoot = exportSlices.length === 1 ? "web-icons" : `web-icons/${sliceFolder}`;

      reportLines.push(`## ${slice.name}`);
      reportLines.push(`Original slice: ${slice.width} x ${slice.height}`);

      for (const output of enabledWebOutputs) {
        const blob = await renderSlice(sourceImage, slice, "png", jpgBackground, {
          width: output.width,
          height: output.height,
        });
        const filePath = `${outputRoot}/${output.fileName}`;
        zip.file(filePath, blob);

        reportLines.push(`- ${output.fileName}: ${output.width} x ${output.height}`);

        if (exportSlices.length === 1) {
          const publicPath = `/${output.fileName}`;
          if (output.id.startsWith("favicon")) {
            htmlLinks.push(
              `<link rel="icon" type="image/png" sizes="${output.width}x${output.height}" href="${publicPath}">`,
            );
          }

          if (output.id.startsWith("apple-touch")) {
            htmlLinks.push(`<link rel="apple-touch-icon" sizes="${output.width}x${output.height}" href="${publicPath}">`);
          }

          if (output.id.startsWith("pwa") || output.id.startsWith("maskable")) {
            manifestIcons.push({
              src: publicPath,
              sizes: `${output.width}x${output.height}`,
              type: "image/png",
              purpose: output.purpose,
            });
          }
        }
      }

      reportLines.push("");
    }

    if (exportSlices.length === 1) {
      zip.file("web-icons/manifest-icons.json", JSON.stringify({ icons: manifestIcons }, null, 2));
      zip.file("web-icons/html-links.txt", `${htmlLinks.join("\n")}\n`);
    }

    zip.file("web-icons/export-report.md", `${reportLines.join("\n")}\n`);
    const zipBlob = await zip.generateAsync({ type: "blob" });
    await saveBlob(zipBlob, `${sanitizeFileName(filePrefix || "web-icons")}_web_icons.zip`);
  }

  async function exportAndroidIconPackage(sourceImage: HTMLImageElement, exportSlices: SliceRegion[]) {
    const zip = new JSZip();
    const safeResourceName = sanitizeAndroidResourceName(androidResourceName);
    const reportLines = [
      "# Android Icon Export Report",
      "",
      `Source: ${imageDocument?.fileName ?? "unknown"}`,
      `Resource name: ${safeResourceName}`,
      `Slices: ${exportSlices.length}`,
      `Densities per slice: ${enabledAndroidOutputs.length}`,
      "",
    ];

    for (let sliceIndex = 0; sliceIndex < exportSlices.length; sliceIndex += 1) {
      const slice = exportSlices[sliceIndex];
      const sliceFolder = exportSlices.length === 1 ? "" : `${sanitizeFileName(slice.name)}/`;

      reportLines.push(`## ${slice.name}`);
      reportLines.push(`Original slice: ${slice.width} x ${slice.height}`);

      for (const output of enabledAndroidOutputs) {
        const blob = await renderSlice(sourceImage, slice, "png", jpgBackground, {
          width: output.width,
          height: output.height,
        });
        const path = `android-res/${sliceFolder}res/${output.directory}/${safeResourceName}.png`;
        zip.file(path, blob);
        reportLines.push(`- ${output.directory}/${safeResourceName}.png: ${output.width} x ${output.height}`);
      }

      reportLines.push("");
    }

    zip.file("android-res/export-report.md", `${reportLines.join("\n")}\n`);
    const zipBlob = await zip.generateAsync({ type: "blob" });
    await saveBlob(zipBlob, `${sanitizeFileName(filePrefix || "android-icons")}_android_icons.zip`);
  }

  async function exportIosIconPackage(sourceImage: HTMLImageElement, exportSlices: SliceRegion[]) {
    const zip = new JSZip();
    const reportLines = [
      "# iOS App Icon Export Report",
      "",
      `Source: ${imageDocument?.fileName ?? "unknown"}`,
      `Slices: ${exportSlices.length}`,
      `Outputs per slice: ${enabledIosOutputs.length}`,
      "",
    ];

    for (let sliceIndex = 0; sliceIndex < exportSlices.length; sliceIndex += 1) {
      const slice = exportSlices[sliceIndex];
      const sliceFolder =
        exportSlices.length === 1 ? "Assets.xcassets/AppIcon.appiconset" : `Assets.xcassets/${sanitizeFileName(slice.name)}.appiconset`;
      const contentsImages: Array<{
        filename: string;
        idiom: string;
        size: string;
        scale: string;
      }> = [];

      reportLines.push(`## ${slice.name}`);
      reportLines.push(`Original slice: ${slice.width} x ${slice.height}`);

      for (const output of enabledIosOutputs) {
        const blob = await renderSlice(sourceImage, slice, "png", jpgBackground, {
          width: output.width,
          height: output.height,
        });
        zip.file(`${sliceFolder}/${output.fileName}`, blob);
        contentsImages.push({
          filename: output.fileName,
          idiom: output.idiom,
          size: output.size,
          scale: output.scale,
        });
        reportLines.push(`- ${output.fileName}: ${output.width} x ${output.height}`);
      }

      zip.file(
        `${sliceFolder}/Contents.json`,
        JSON.stringify(
          {
            images: contentsImages,
            info: {
              author: "xcode",
              version: 1,
            },
          },
          null,
          2,
        ),
      );
      reportLines.push("");
    }

    zip.file("ios-icons/export-report.md", `${reportLines.join("\n")}\n`);
    const zipBlob = await zip.generateAsync({ type: "blob" });
    await saveBlob(zipBlob, `${sanitizeFileName(filePrefix || "ios-icons")}_ios_icons.zip`);
  }

  async function exportCustomIconPackage(sourceImage: HTMLImageElement, exportSlices: SliceRegion[]) {
    const zip = new JSZip();
    const reportLines = [
      "# Custom Icon Export Report",
      "",
      `Source: ${imageDocument?.fileName ?? "unknown"}`,
      `Slices: ${exportSlices.length}`,
      `Outputs per slice: ${enabledCustomOutputs.length}`,
      "",
    ];

    for (let sliceIndex = 0; sliceIndex < exportSlices.length; sliceIndex += 1) {
      const slice = exportSlices[sliceIndex];
      const sliceFolder = exportSlices.length === 1 ? "custom-icons" : `custom-icons/${sanitizeFileName(slice.name)}`;

      reportLines.push(`## ${slice.name}`);
      reportLines.push(`Original slice: ${slice.width} x ${slice.height}`);

      for (const output of enabledCustomOutputs) {
        const blob = await renderSlice(sourceImage, slice, "png", jpgBackground, {
          width: output.width,
          height: output.height,
        });
        const fileName = sanitizeCustomOutputFileName(output.fileName, output.width, output.height);
        zip.file(`${sliceFolder}/${fileName}`, blob);
        reportLines.push(`- ${fileName}: ${output.width} x ${output.height}`);
      }

      reportLines.push("");
    }

    zip.file(
      "custom-icons/custom-preset.json",
      JSON.stringify(
        {
          version: 1,
          savedAt: new Date().toISOString(),
          outputs: customIconOutputs,
        },
        null,
        2,
      ),
    );
    zip.file("custom-icons/export-report.md", `${reportLines.join("\n")}\n`);
    const zipBlob = await zip.generateAsync({ type: "blob" });
    await saveBlob(zipBlob, `${sanitizeFileName(filePrefix || "custom-icons")}_custom_icons.zip`);
  }

  function toggleWebOutput(outputId: string, enabled: boolean) {
    setEnabledWebOutputIds((current) => {
      if (enabled) {
        return current.includes(outputId) ? current : [...current, outputId];
      }

      return current.filter((id) => id !== outputId);
    });
  }

  function toggleAndroidOutput(outputId: string, enabled: boolean) {
    setEnabledAndroidOutputIds((current) => {
      if (enabled) {
        return current.includes(outputId) ? current : [...current, outputId];
      }

      return current.filter((id) => id !== outputId);
    });
  }

  function toggleIosOutput(outputId: string, enabled: boolean) {
    setEnabledIosOutputIds((current) => {
      if (enabled) {
        return current.includes(outputId) ? current : [...current, outputId];
      }

      return current.filter((id) => id !== outputId);
    });
  }

  function toggleCustomOutput(outputId: string, enabled: boolean) {
    setEnabledCustomOutputIds((current) => {
      if (enabled) {
        return current.includes(outputId) ? current : [...current, outputId];
      }

      return current.filter((id) => id !== outputId);
    });
  }

  function updateCustomOutput(outputId: string, patch: Partial<CustomIconOutput>) {
    setCustomIconOutputs((current) =>
      current.map((output) => (output.id === outputId ? { ...output, ...patch } : output)),
    );
  }

  function addCustomOutput() {
    const id = crypto.randomUUID();
    const size = 512;
    const nextOutput: CustomIconOutput = {
      id,
      label: `Icon ${size}`,
      width: size,
      height: size,
      fileName: `icon-${size}x${size}.png`,
    };

    setCustomIconOutputs((current) => [...current, nextOutput]);
    setEnabledCustomOutputIds((current) => [...current, id]);
    setStatusText("已添加自定义尺寸");
  }

  function removeCustomOutput(outputId: string) {
    setCustomIconOutputs((current) => current.filter((output) => output.id !== outputId));
    setEnabledCustomOutputIds((current) => current.filter((id) => id !== outputId));
    setStatusText("已删除自定义尺寸");
  }

  function generateGridSlices(replaceExisting: boolean) {
    if (!imageDocument) {
      setStatusText("请先导入图片");
      return;
    }

    const nextSlices = buildGridSlices({
      imageDocument,
      mode: gridMode,
      cellWidth: gridWidth,
      cellHeight: gridHeight,
      startX: gridStartX,
      startY: gridStartY,
      gapX: gridGapX,
      gapY: gridGapY,
      rows: gridRows,
      columns: gridColumns,
      order: gridOrder,
      nameOffset: replaceExisting ? 0 : slices.length,
    });

    if (nextSlices.length === 0) {
      setErrorMessage("当前网格参数没有生成有效切片，请检查尺寸、起点和行列数量。");
      setStatusText("网格生成失败");
      return;
    }

    pushHistory();
    setErrorMessage(null);
    setSlices((current) => (replaceExisting ? nextSlices : [...current, ...nextSlices]));
    setSelectedSliceId(nextSlices[0].id);
    setActiveTool("select");
    setStatusText(`已生成 ${nextSlices.length} 个网格切片`);
  }

  async function detectIconSlices(replaceExisting: boolean) {
    if (!imageDocument) {
      setStatusText("请先导入图片");
      return;
    }

    if (imageDocument.width * imageDocument.height > 16_000_000) {
      setErrorMessage("当前图片过大，智能识别基础版暂时建议处理 1600 万像素以内的图片。");
      setStatusText("识别未开始");
      return;
    }

    setIsScanning(true);
    setErrorMessage(null);
    setStatusText("正在识别图形区域");

    try {
      const sourceImage = await loadImage(imageDocument.url);
      const canvas = document.createElement("canvas");
      canvas.width = imageDocument.width;
      canvas.height = imageDocument.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        throw new Error("Canvas is unavailable");
      }

      context.drawImage(sourceImage, 0, 0);
      const imageData = context.getImageData(0, 0, imageDocument.width, imageDocument.height);
      const nextSlices = findConnectedRegions(imageData, {
        mode: scanMode,
        alphaThreshold: scanAlphaThreshold,
        backgroundColor: scanBackgroundColor,
        colorTolerance: scanColorTolerance,
        minArea: scanMinArea,
        minSize: scanMinSize,
        padding: scanPadding,
        nameOffset: replaceExisting ? 0 : slices.length,
      });

      if (nextSlices.length === 0) {
        setErrorMessage("没有识别到可用区域。可以降低阈值、减小最小面积，或切换识别方式再试。");
        setStatusText("未识别到区域");
        return;
      }

      pushHistory();
      setSlices((current) => (replaceExisting ? nextSlices : [...current, ...nextSlices]));
      setSelectedSliceId(nextSlices[0].id);
      setActiveTool("select");
      setStatusText(`已识别 ${nextSlices.length} 个区域`);
    } catch {
      setErrorMessage("智能识别失败，请换一张图片或调整参数后再试。");
      setStatusText("识别失败");
    } finally {
      setIsScanning(false);
    }
  }

  const zoomLabel = `${Math.round(zoom * 100)}%`;
  const selectedSizeLabel = selectedSlice
    ? `尺寸 ${selectedSlice.width} x ${selectedSlice.height}`
    : "尺寸 0 x 0";

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <span className="brand-mark">IS</span>
          <div>
            <h1>Image Slicing Tools</h1>
            <p>跨平台图片切图工作台</p>
          </div>
        </div>

        <nav className="top-actions" aria-label="主要操作">
          <input
            accept="image/png,image/jpeg,image/webp"
            className="file-input"
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
          <input
            accept="application/json,.json,.custom-preset.json"
            className="file-input"
            onChange={(event) => void handleCustomPresetFileChange(event)}
            ref={customPresetInputRef}
            type="file"
          />
          <button className="button primary" onClick={() => void handleOpenImageClick()} type="button">
            <FolderOpen size={16} />
            打开图片
          </button>
          <button className="icon-button" onClick={() => projectInputRef.current?.click()} type="button" aria-label="打开项目">
            <FileUp size={16} />
          </button>
          <button
            className="icon-button"
            disabled={!imageDocument}
            onClick={() => void saveProjectFile()}
            type="button"
            aria-label="保存项目"
          >
            <Save size={16} />
          </button>
          <button
            className="icon-button"
            disabled={pastSlices.length === 0}
            onClick={undo}
            type="button"
            aria-label="撤销"
          >
            <Undo2 size={16} />
          </button>
          <button
            className="icon-button"
            disabled={futureSlices.length === 0}
            onClick={redo}
            type="button"
            aria-label="重做"
          >
            <Redo2 size={16} />
          </button>
          <span className="divider" />
          <button
            className="icon-button"
            disabled={!imageDocument}
            onClick={() => changeZoom(zoom - 0.1)}
            type="button"
            aria-label="缩小"
          >
            <ZoomOut size={16} />
          </button>
          <button className="zoom-value" disabled={!imageDocument} onClick={fitToWindow} type="button">
            {zoomLabel}
          </button>
          <button
            className="icon-button"
            disabled={!imageDocument}
            onClick={() => changeZoom(zoom + 0.1)}
            type="button"
            aria-label="放大"
          >
            <ZoomIn size={16} />
          </button>
          <button
            className="button"
            disabled={
              !imageDocument ||
              getExportSlices().length === 0 ||
              platformOutputCount === 0 ||
              isExporting
            }
            onClick={() => void handleExport()}
            type="button"
          >
            <Download size={16} />
            {isExporting ? "导出中" : "导出"}
          </button>
        </nav>
      </header>

      <section className="workspace">
        <aside className="tool-rail" aria-label="切图工具">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const disabled = !imageDocument && tool.id !== "select";
            return (
              <button
                className={activeTool === tool.id ? "tool-button active" : "tool-button"}
                disabled={disabled}
                onClick={() => setActiveTool(tool.id)}
                type="button"
                key={tool.label}
                title={tool.label}
              >
                <Icon size={20} />
                <span>{tool.label}</span>
              </button>
            );
          })}
        </aside>

        <section
          className={[
            "canvas-panel",
            imageDocument ? "has-image" : "",
            activeTool === "rect" ? "is-rect-tool" : "",
            isPanning ? "is-panning" : "",
            isDraggingOver ? "is-dragging-over" : "",
          ].join(" ")}
          aria-label="图片画布"
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDraggingOver(false);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          ref={canvasPanelRef}
        >
          {imageDocument ? (
            <div
              className="image-stage"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                width: imageDocument.width,
                height: imageDocument.height,
              }}
            >
              <img alt={imageDocument.fileName} draggable={false} src={imageDocument.url} />
              {slices.map((slice) => {
                const selected = slice.id === selectedSliceId;
                return (
                  <div
                    className={selected ? "slice-box selected" : "slice-box"}
                    key={slice.id}
                    onPointerDown={(event) => handleSlicePointerDown(event, slice)}
                    style={{
                      left: slice.x,
                      top: slice.y,
                      width: slice.width,
                      height: slice.height,
                    }}
                  >
                    <span className="slice-label">{slice.name}</span>
                    {selected && (
                      <>
                        <button
                          aria-label="左上角缩放"
                          className="resize-handle nw"
                          onPointerDown={(event) => handleResizePointerDown(event, slice, "nw")}
                          type="button"
                        />
                        <button
                          aria-label="右上角缩放"
                          className="resize-handle ne"
                          onPointerDown={(event) => handleResizePointerDown(event, slice, "ne")}
                          type="button"
                        />
                        <button
                          aria-label="左下角缩放"
                          className="resize-handle sw"
                          onPointerDown={(event) => handleResizePointerDown(event, slice, "sw")}
                          type="button"
                        />
                        <button
                          aria-label="右下角缩放"
                          className="resize-handle se"
                          onPointerDown={(event) => handleResizePointerDown(event, slice, "se")}
                          type="button"
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="canvas-empty-state">
              <div className="empty-icon">
                <FolderOpen size={36} />
              </div>
              <h2>拖入图片或点击打开图片</h2>
              <p>支持 PNG、JPG/JPEG、WebP。导入后可以缩放、拖动画布，并在右侧查看图片信息。</p>
              {errorMessage && <div className="error-message">{errorMessage}</div>}
            </div>
          )}
        </section>

        <aside className="inspector" aria-label="属性面板">
          <section className="panel-section">
            <h2>图片信息</h2>
            {imageDocument ? (
              <dl className="info-list">
                <div>
                  <dt>文件名</dt>
                  <dd>{imageDocument.fileName}</dd>
                </div>
                <div>
                  <dt>尺寸</dt>
                  <dd>
                    {imageDocument.width} x {imageDocument.height}
                  </dd>
                </div>
                <div>
                  <dt>大小</dt>
                  <dd>{formatFileSize(imageDocument.fileSize)}</dd>
                </div>
                <div>
                  <dt>格式</dt>
                  <dd>{formatMimeType(imageDocument.mimeType)}</dd>
                </div>
                <div>
                  <dt>透明通道</dt>
                  <dd>{imageDocument.hasAlpha ? "有" : "无"}</dd>
                </div>
              </dl>
            ) : (
              <div className="empty-list">尚未导入图片</div>
            )}
          </section>

          <section className="panel-section">
            <div className="panel-heading">
              <h2>当前选区</h2>
              <button
                className="mini-button danger"
                disabled={!selectedSlice}
                onClick={() => selectedSlice && deleteSlice(selectedSlice.id)}
                type="button"
              >
                <Trash2 size={14} />
                删除
              </button>
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
          </section>

          <section className="panel-section">
            <h2>切片列表</h2>
            {slices.length > 0 ? (
              <div className="slice-list">
                {slices.map((slice) => (
                  <button
                    className={slice.id === selectedSliceId ? "slice-list-item selected" : "slice-list-item"}
                    key={slice.id}
                    onClick={() => setSelectedSliceId(slice.id)}
                    type="button"
                  >
                    <span className="slice-list-name">{slice.name}</span>
                    <span>
                      {slice.width} x {slice.height}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-list">暂无切片</div>
            )}
          </section>

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
                  <input
                    onChange={(event) => setScanBackgroundColor(event.target.value)}
                    type="color"
                    value={scanBackgroundColor}
                  />
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

            <p className="hint-text">
              透明背景会识别非透明图形；纯色背景会识别与背景色差异明显的区域。
            </p>

            <div className="action-row">
              <button
                className="button"
                disabled={!imageDocument || isScanning}
                onClick={() => void detectIconSlices(true)}
                type="button"
              >
                替换识别
              </button>
              <button
                className="button"
                disabled={!imageDocument || isScanning}
                onClick={() => void detectIconSlices(false)}
                type="button"
              >
                追加识别
              </button>
            </div>
          </section>

          <section className="panel-section">
            <h2>网格切图</h2>
            <label className="field">
              生成方式
              <select onChange={(event) => setGridMode(event.target.value as GridMode)} value={gridMode}>
                <option value="fixed">固定尺寸</option>
                <option value="equal">按行列均分</option>
              </select>
            </label>

            <div className="field-grid">
              <label>
                行数
                <input
                  min={1}
                  onChange={(event) => setGridRows(parsePositiveInt(event.target.value, 1))}
                  type="number"
                  value={gridRows}
                />
              </label>
              <label>
                列数
                <input
                  min={1}
                  onChange={(event) => setGridColumns(parsePositiveInt(event.target.value, 1))}
                  type="number"
                  value={gridColumns}
                />
              </label>
            </div>

            {gridMode === "fixed" && (
              <>
                <div className="field-grid">
                  <label>
                    宽
                    <input
                      min={1}
                      onChange={(event) => setGridWidth(parsePositiveInt(event.target.value, 1))}
                      type="number"
                      value={gridWidth}
                    />
                  </label>
                  <label>
                    高
                    <input
                      min={1}
                      onChange={(event) => setGridHeight(parsePositiveInt(event.target.value, 1))}
                      type="number"
                      value={gridHeight}
                    />
                  </label>
                </div>

                <div className="field-grid">
                  <label>
                    起点 X
                    <input
                      min={0}
                      onChange={(event) => setGridStartX(parseNonNegativeInt(event.target.value))}
                      type="number"
                      value={gridStartX}
                    />
                  </label>
                  <label>
                    起点 Y
                    <input
                      min={0}
                      onChange={(event) => setGridStartY(parseNonNegativeInt(event.target.value))}
                      type="number"
                      value={gridStartY}
                    />
                  </label>
                </div>

                <div className="field-grid">
                  <label>
                    横向间距
                    <input
                      min={0}
                      onChange={(event) => setGridGapX(parseNonNegativeInt(event.target.value))}
                      type="number"
                      value={gridGapX}
                    />
                  </label>
                  <label>
                    纵向间距
                    <input
                      min={0}
                      onChange={(event) => setGridGapY(parseNonNegativeInt(event.target.value))}
                      type="number"
                      value={gridGapY}
                    />
                  </label>
                </div>
              </>
            )}

            <label className="field">
              编号顺序
              <select onChange={(event) => setGridOrder(event.target.value as GridOrder)} value={gridOrder}>
                <option value="row">按行优先</option>
                <option value="column">按列优先</option>
              </select>
            </label>

            <div className="action-row">
              <button
                className="button"
                disabled={!imageDocument}
                onClick={() => generateGridSlices(true)}
                type="button"
              >
                替换生成
              </button>
              <button
                className="button"
                disabled={!imageDocument}
                onClick={() => generateGridSlices(false)}
                type="button"
              >
                追加生成
              </button>
            </div>
          </section>

          <section className="panel-section">
            <h2>导出设置</h2>
            {errorMessage && <div className="error-message compact">{errorMessage}</div>}
            <label className="field">
              导出范围
              <select
                onChange={(event) => setExportScope(event.target.value as ExportScope)}
                value={exportScope}
              >
                <option value="enabled">全部启用切片</option>
                <option value="selected">当前选区</option>
              </select>
            </label>
            <label className="field">
              文件名前缀
              <input
                onChange={(event) => setFilePrefix(event.target.value)}
                placeholder="slice"
                value={filePrefix}
              />
            </label>
            <label className="field">
              目标平台
              <select
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
                  <input
                    onChange={(event) => setAndroidResourceName(sanitizeAndroidResourceName(event.target.value))}
                    value={androidResourceName}
                  />
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
                  <button className="button" onClick={() => customPresetInputRef.current?.click()} type="button">
                    <FileUp size={16} />
                    打开预设
                  </button>
                  <button className="button" onClick={() => void saveCustomPresetFile()} type="button">
                    <Download size={16} />
                    保存预设
                  </button>
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
                        <input
                          onChange={(event) => updateCustomOutput(output.id, { label: event.target.value })}
                          value={output.label}
                        />
                      </label>
                      <div className="field-grid">
                        <label>
                          宽
                          <input
                            min={1}
                            onChange={(event) =>
                              updateCustomOutput(output.id, { width: parsePositiveInt(event.target.value, 1) })
                            }
                            type="number"
                            value={output.width}
                          />
                        </label>
                        <label>
                          高
                          <input
                            min={1}
                            onChange={(event) =>
                              updateCustomOutput(output.id, { height: parsePositiveInt(event.target.value, 1) })
                            }
                            type="number"
                            value={output.height}
                          />
                        </label>
                      </div>
                      <label>
                        文件名
                        <input
                          onChange={(event) => updateCustomOutput(output.id, { fileName: event.target.value })}
                          value={output.fileName}
                        />
                      </label>
                      <button
                        className="mini-button danger"
                        disabled={customIconOutputs.length <= 1}
                        onClick={() => removeCustomOutput(output.id)}
                        type="button"
                      >
                        <Trash2 size={14} />
                        删除
                      </button>
                    </div>
                  ))}
                </div>
                <button className="button export-panel-button" onClick={addCustomOutput} type="button">
                  <Plus size={16} />
                  添加尺寸
                </button>
              </div>
            )}
            {targetPlatform === "generic" && exportFormat === "jpg" && (
              <label className="field">
                JPG 背景色
                <input
                  onChange={(event) => setJpgBackground(event.target.value)}
                  type="color"
                  value={jpgBackground}
                />
              </label>
            )}
            <button
              className="button export-panel-button"
              disabled={
                !imageDocument ||
                getExportSlices().length === 0 ||
                platformOutputCount === 0 ||
                isExporting
              }
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
                      : `导出 ${getExportSlices().length} 个切片`}
            </button>
          </section>
        </aside>
      </section>

      <footer className="status-bar">
        <span>{pointerInfo}</span>
        <span>{selectedSizeLabel}</span>
        <span>缩放 {zoomLabel}</span>
        <span>{statusText}</span>
      </footer>
    </main>
  );
}

function calculateFitZoom(imageWidth: number, imageHeight: number) {
  const panel = document.querySelector(".canvas-panel");

  if (!(panel instanceof HTMLElement)) {
    return 1;
  }

  const rect = panel.getBoundingClientRect();
  const availableWidth = Math.max(rect.width - 80, 1);
  const availableHeight = Math.max(rect.height - 80, 1);
  return clamp(Math.min(availableWidth / imageWidth, availableHeight / imageHeight, 1), MIN_ZOOM, MAX_ZOOM);
}

async function detectAlphaChannel(bitmap: ImageBitmap) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(bitmap.width, 512);
  canvas.height = Math.min(bitmap.height, 512);

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return false;
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 255) {
      return true;
    }
  }

  return false;
}

function resizeSlice(
  original: SliceRegion,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
  imageDocument: ImageDocument,
) {
  let nextX = original.x;
  let nextY = original.y;
  let nextWidth = original.width;
  let nextHeight = original.height;

  if (handle.includes("w")) {
    nextX = original.x + deltaX;
    nextWidth = original.width - deltaX;
  }

  if (handle.includes("e")) {
    nextWidth = original.width + deltaX;
  }

  if (handle.includes("n")) {
    nextY = original.y + deltaY;
    nextHeight = original.height - deltaY;
  }

  if (handle.includes("s")) {
    nextHeight = original.height + deltaY;
  }

  return normalizeRect(nextX, nextY, nextWidth, nextHeight, imageDocument);
}

function normalizeRect(
  x: number,
  y: number,
  width: number,
  height: number,
  imageDocument: ImageDocument,
): Pick<SliceRegion, "x" | "y" | "width" | "height"> {
  const left = clamp(Math.min(x, x + width), 0, imageDocument.width);
  const top = clamp(Math.min(y, y + height), 0, imageDocument.height);
  const right = clamp(Math.max(x, x + width), 0, imageDocument.width);
  const bottom = clamp(Math.max(y, y + height), 0, imageDocument.height);

  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.max(Math.round(right - left), 1),
    height: Math.max(Math.round(bottom - top), 1),
  };
}

function validateExport(slices: SliceRegion[], imageDocument: ImageDocument) {
  if (slices.length === 0) {
    return "没有可导出的切片。请先创建选区，或启用至少一个切片。";
  }

  const invalidSlice = slices.find(
    (slice) =>
      slice.width <= 0 ||
      slice.height <= 0 ||
      slice.x < 0 ||
      slice.y < 0 ||
      slice.x + slice.width > imageDocument.width ||
      slice.y + slice.height > imageDocument.height,
  );

  if (invalidSlice) {
    return `切片 ${invalidSlice.name} 的尺寸或位置不合法。`;
  }

  return null;
}

function buildGridSlices({
  imageDocument,
  mode,
  cellWidth,
  cellHeight,
  startX,
  startY,
  gapX,
  gapY,
  rows,
  columns,
  order,
  nameOffset,
}: {
  imageDocument: ImageDocument;
  mode: GridMode;
  cellWidth: number;
  cellHeight: number;
  startX: number;
  startY: number;
  gapX: number;
  gapY: number;
  rows: number;
  columns: number;
  order: GridOrder;
  nameOffset: number;
}) {
  const normalizedRows = Math.max(Math.round(rows), 1);
  const normalizedColumns = Math.max(Math.round(columns), 1);
  const normalizedCellWidth =
    mode === "equal" ? Math.floor(imageDocument.width / normalizedColumns) : Math.max(Math.round(cellWidth), 1);
  const normalizedCellHeight =
    mode === "equal" ? Math.floor(imageDocument.height / normalizedRows) : Math.max(Math.round(cellHeight), 1);
  const normalizedStartX = mode === "equal" ? 0 : Math.max(Math.round(startX), 0);
  const normalizedStartY = mode === "equal" ? 0 : Math.max(Math.round(startY), 0);
  const normalizedGapX = mode === "equal" ? 0 : Math.max(Math.round(gapX), 0);
  const normalizedGapY = mode === "equal" ? 0 : Math.max(Math.round(gapY), 0);
  const positions: Array<{ row: number; column: number }> = [];

  if (order === "row") {
    for (let row = 0; row < normalizedRows; row += 1) {
      for (let column = 0; column < normalizedColumns; column += 1) {
        positions.push({ row, column });
      }
    }
  } else {
    for (let column = 0; column < normalizedColumns; column += 1) {
      for (let row = 0; row < normalizedRows; row += 1) {
        positions.push({ row, column });
      }
    }
  }

  return positions
    .map((position, index): SliceRegion | null => {
      const x = normalizedStartX + position.column * (normalizedCellWidth + normalizedGapX);
      const y = normalizedStartY + position.row * (normalizedCellHeight + normalizedGapY);

      if (
        x < 0 ||
        y < 0 ||
        x + normalizedCellWidth > imageDocument.width ||
        y + normalizedCellHeight > imageDocument.height
      ) {
        return null;
      }

      return {
        id: crypto.randomUUID(),
        name: `grid_r${position.row + 1}_c${position.column + 1}`,
        x,
        y,
        width: normalizedCellWidth,
        height: normalizedCellHeight,
        enabled: true,
        locked: false,
      };
    })
    .filter((slice): slice is SliceRegion => Boolean(slice))
    .map((slice, index) => ({
      ...slice,
      name: `${slice.name}_${String(nameOffset + index + 1).padStart(3, "0")}`,
    }));
}

function findConnectedRegions(
  imageData: ImageData,
  {
    mode,
    alphaThreshold,
    backgroundColor,
    colorTolerance,
    minArea,
    minSize,
    padding,
    nameOffset,
  }: {
    mode: ScanMode;
    alphaThreshold: number;
    backgroundColor: string;
    colorTolerance: number;
    minArea: number;
    minSize: number;
    padding: number;
    nameOffset: number;
  },
) {
  const { width, height } = imageData;
  const foreground = createForegroundMask(imageData, {
    mode,
    alphaThreshold,
    backgroundColor,
    colorTolerance,
  });
  const visited = new Uint8Array(width * height);
  const regions: Array<{ x: number; y: number; width: number; height: number; area: number }> = [];

  for (let startIndex = 0; startIndex < visited.length; startIndex += 1) {
    if (visited[startIndex]) {
      continue;
    }

    if (!foreground[startIndex]) {
      visited[startIndex] = 1;
      continue;
    }

    const stack = [startIndex];
    visited[startIndex] = 1;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    while (stack.length > 0) {
      const pixelIndex = stack.pop();
      if (pixelIndex === undefined) {
        continue;
      }

      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbors = [
        x > 0 ? pixelIndex - 1 : -1,
        x < width - 1 ? pixelIndex + 1 : -1,
        y > 0 ? pixelIndex - width : -1,
        y < height - 1 ? pixelIndex + width : -1,
      ];

      for (const neighborIndex of neighbors) {
        if (neighborIndex < 0 || visited[neighborIndex]) {
          continue;
        }

        visited[neighborIndex] = 1;
        if (foreground[neighborIndex]) {
          stack.push(neighborIndex);
        }
      }
    }

    const regionWidth = maxX - minX + 1;
    const regionHeight = maxY - minY + 1;

    if (area >= minArea && regionWidth >= minSize && regionHeight >= minSize) {
      const paddedX = Math.max(minX - padding, 0);
      const paddedY = Math.max(minY - padding, 0);
      const paddedRight = Math.min(maxX + padding + 1, width);
      const paddedBottom = Math.min(maxY + padding + 1, height);

      regions.push({
        x: paddedX,
        y: paddedY,
        width: paddedRight - paddedX,
        height: paddedBottom - paddedY,
        area,
      });
    }
  }

  return regions
    .sort((left, right) => left.y - right.y || left.x - right.x || right.area - left.area)
    .map((region, index): SliceRegion => ({
      id: crypto.randomUUID(),
      name: `icon_${String(nameOffset + index + 1).padStart(3, "0")}`,
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      enabled: true,
      locked: false,
    }));
}

function createForegroundMask(
  imageData: ImageData,
  {
    mode,
    alphaThreshold,
    backgroundColor,
    colorTolerance,
  }: {
    mode: ScanMode;
    alphaThreshold: number;
    backgroundColor: string;
    colorTolerance: number;
  },
) {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  const mask = new Uint8Array(totalPixels);
  const transparentPixels = countTransparentPixels(data, alphaThreshold);

  if (mode === "alpha" || (mode === "auto" && transparentPixels > 0)) {
    let foregroundPixels = 0;

    for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += 1) {
      if (data[pixelIndex * 4 + 3] > alphaThreshold) {
        mask[pixelIndex] = 1;
        foregroundPixels += 1;
      }
    }

    if (mode === "alpha" && foregroundPixels < totalPixels * 0.86) {
      return mask;
    }

    if (mode === "auto") {
      return mask;
    }
  }

  const background = mode === "color" ? parseHexColor(backgroundColor) : estimateEdgeBackgroundColor(imageData);
  const backgroundMask = createEdgeBackgroundMask(imageData, background, colorTolerance, alphaThreshold);

  for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += 1) {
    if (!backgroundMask[pixelIndex] && data[pixelIndex * 4 + 3] > alphaThreshold) {
      mask[pixelIndex] = 1;
    }
  }

  return mask;
}

function createEdgeBackgroundMask(
  imageData: ImageData,
  background: { r: number; g: number; b: number },
  colorTolerance: number,
  alphaThreshold: number,
) {
  const { data, width, height } = imageData;
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];

  function isBackground(pixelIndex: number) {
    const dataIndex = pixelIndex * 4;
    const alpha = data[dataIndex + 3];

    if (alpha <= alphaThreshold) {
      return true;
    }

    return (
      colorDistance(
        data[dataIndex],
        data[dataIndex + 1],
        data[dataIndex + 2],
        background.r,
        background.g,
        background.b,
      ) <= colorTolerance
    );
  }

  function addSeed(pixelIndex: number) {
    if (!visited[pixelIndex] && isBackground(pixelIndex)) {
      visited[pixelIndex] = 1;
      stack.push(pixelIndex);
    }
  }

  for (let x = 0; x < width; x += 1) {
    addSeed(x);
    addSeed((height - 1) * width + x);
  }

  for (let y = 0; y < height; y += 1) {
    addSeed(y * width);
    addSeed(y * width + width - 1);
  }

  while (stack.length > 0) {
    const pixelIndex = stack.pop();
    if (pixelIndex === undefined) {
      continue;
    }

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    const neighbors = [
      x > 0 ? pixelIndex - 1 : -1,
      x < width - 1 ? pixelIndex + 1 : -1,
      y > 0 ? pixelIndex - width : -1,
      y < height - 1 ? pixelIndex + width : -1,
    ];

    for (const neighborIndex of neighbors) {
      if (neighborIndex < 0 || visited[neighborIndex] || !isBackground(neighborIndex)) {
        continue;
      }

      visited[neighborIndex] = 1;
      stack.push(neighborIndex);
    }
  }

  return visited;
}

function estimateEdgeBackgroundColor(imageData: ImageData) {
  const { data, width, height } = imageData;
  const sampleIndexes = [
    0,
    width - 1,
    (height - 1) * width,
    width * height - 1,
    Math.floor(width / 2),
    (height - 1) * width + Math.floor(width / 2),
    Math.floor(height / 2) * width,
    Math.floor(height / 2) * width + width - 1,
  ];
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (const pixelIndex of sampleIndexes) {
    const dataIndex = pixelIndex * 4;
    if (data[dataIndex + 3] === 0) {
      continue;
    }

    red += data[dataIndex];
    green += data[dataIndex + 1];
    blue += data[dataIndex + 2];
    count += 1;
  }

  if (count === 0) {
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: Math.round(red / count),
    g: Math.round(green / count),
    b: Math.round(blue / count),
  };
}

function countTransparentPixels(data: Uint8ClampedArray, alphaThreshold: number) {
  let count = 0;

  for (let dataIndex = 3; dataIndex < data.length; dataIndex += 4) {
    if (data[dataIndex] <= alphaThreshold) {
      count += 1;
    }
  }

  return count;
}

async function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed"));
    image.src = url;
  });
}

async function renderSlice(
  image: HTMLImageElement,
  slice: SliceRegion,
  format: ExportFormat,
  jpgBackground: string,
  outputSize?: { width: number; height: number },
) {
  const canvas = document.createElement("canvas");
  canvas.width = outputSize?.width ?? slice.width;
  canvas.height = outputSize?.height ?? slice.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is unavailable");
  }

  if (format === "jpg") {
    context.fillStyle = jpgBackground;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(
    image,
    slice.x,
    slice.y,
    slice.width,
    slice.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvasToBlob(canvas, getMimeType(format), format === "jpg" ? 0.92 : undefined);
}

async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Canvas export failed"));
      },
      mimeType,
      quality,
    );
  });
}

async function saveBlob(blob: Blob, fileName: string) {
  if (isTauriRuntime()) {
    const [{ save }, { writeFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const extension = fileName.split(".").pop() ?? "png";
    const selectedPath = await save({
      defaultPath: fileName,
      filters: [
        {
          name: extension.toUpperCase(),
          extensions: [extension],
        },
      ],
    });

    if (!selectedPath) {
      return;
    }

    await writeFile(selectedPath, new Uint8Array(await blob.arrayBuffer()));
    return;
  }

  downloadBlob(blob, fileName);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildFileName(prefix: string, slice: SliceRegion, index: number) {
  const safePrefix = sanitizeFileName(prefix || "slice");
  const safeSliceName = sanitizeFileName(slice.name || `slice_${index}`);
  const sequence = String(index).padStart(3, "0");
  return `${safePrefix}_${sequence}_${safeSliceName}`;
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "slice";
}

function sanitizeAndroidResourceName(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) {
    return "ic_launcher";
  }

  if (/^[0-9]/.test(normalized)) {
    return `ic_${normalized}`;
  }

  return normalized;
}

function isValidAndroidResourceName(value: string) {
  return /^[a-z_][a-z0-9_]*$/.test(value);
}

function isSavedProject(value: unknown): value is SavedProject {
  if (!value || typeof value !== "object") {
    return false;
  }

  const project = value as SavedProject;
  return (
    project.version === 1 &&
    Boolean(project.image?.dataUrl) &&
    ACCEPTED_IMAGE_TYPES.includes(project.image.mimeType) &&
    Array.isArray(project.slices) &&
    Boolean(project.settings)
  );
}

function isCustomPresetFile(value: unknown): value is CustomPresetFile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const preset = value as CustomPresetFile;
  return (
    preset.version === 1 &&
    Array.isArray(preset.outputs) &&
    preset.outputs.every(
      (output) =>
        Boolean(output.id) &&
        Boolean(output.label) &&
        Number.isFinite(output.width) &&
        Number.isFinite(output.height) &&
        output.width > 0 &&
        output.height > 0,
    )
  );
}

async function blobUrlToDataUrl(url: string) {
  const blob = await fetch(url).then((response) => response.blob());
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Project image serialization failed"));
    };
    reader.onerror = () => reject(new Error("Project image serialization failed"));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToFile(dataUrl: string, fileName: string, mimeType: string) {
  const [meta, data] = dataUrl.split(",");
  const base64 = meta.includes(";base64");
  const binaryString = base64 ? atob(data) : decodeURIComponent(data);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return new File([bytes], fileName, { type: mimeType });
}

function sanitizeCustomOutputFileName(fileName: string, width: number, height: number) {
  const safeName = sanitizeFileName(fileName || `icon-${width}x${height}`);
  return safeName.endsWith(".png") ? safeName : `${safeName}.png`;
}

function parseHexColor(value: string) {
  const normalized = value.replace("#", "");
  const parsed = Number.parseInt(normalized.length === 3 ? normalized.replace(/(.)/g, "$1$1") : normalized, 16);

  if (Number.isNaN(parsed)) {
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) {
  const deltaR = r1 - r2;
  const deltaG = g1 - g2;
  const deltaB = b1 - b2;
  return Math.sqrt(deltaR * deltaR + deltaG * deltaG + deltaB * deltaB);
}

function getMimeType(format: ExportFormat) {
  if (format === "jpg") {
    return "image/jpeg";
  }

  return `image/${format}`;
}

function getExtension(format: ExportFormat) {
  return format === "jpg" ? "jpg" : format;
}

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

function getMimeTypeFromFileName(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  return "image/png";
}

function isAcceptedImageFile(file: File) {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return true;
  }

  return /\.(png|jpe?g|webp)$/i.test(file.name);
}

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value || String(fallback), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(parsed, 1);
}

function parseNonNegativeInt(value: string) {
  const parsed = Number.parseInt(value || "0", 10);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.max(parsed, 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") {
    return "JPG/JPEG";
  }

  return mimeType.replace("image/", "").toUpperCase();
}
