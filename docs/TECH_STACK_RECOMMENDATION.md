# 技术栈建议

## 1. 推荐结论

建议采用：

- 前端：React + TypeScript + Vite
- 桌面端：Tauri 2
- 图片处理核心：Canvas / OffscreenCanvas + Web Worker
- 状态管理：Zustand
- 样式：普通 CSS 或 CSS Modules
- 图标：lucide-react
- 文件导出：浏览器 Blob + JSZip
- 测试：Vitest + Playwright

整体方向是“网页端优先、桌面端复用”。先把切图工具做成完整 Web App，再用 Tauri 打包 macOS 和 Windows 桌面端。这样可以减少重复开发，后续也方便发布网页版。

## 2. 为什么推荐这套方案

### 2.1 Tauri 2 作为桌面端壳

Tauri 2 支持使用 Web 前端构建跨平台应用，并通过系统原生 WebView 降低应用体积。它适合这个项目，因为切图工具的主要界面和交互可以用 Web 技术完成，桌面端只需要补充文件系统、导出目录、系统菜单等能力。

优点：

- macOS 和 Windows 可共用同一套前端界面。
- 应用体积通常比 Electron 更轻。
- 安全模型更严格，适合本地图片处理工具。
- 后续可扩展到 Linux，甚至移动端方向。

需要注意：

- 需要引入 Rust 工具链。
- 某些桌面能力需要写少量 Rust 命令。
- Windows/macOS 打包和签名仍需要单独配置。

### 2.2 React + TypeScript + Vite

React 适合构建这种包含画布、工具栏、属性面板、切片列表和导出面板的交互型应用。TypeScript 能让图像区域、切片数据、导出规格等核心模型更稳定。Vite 的开发体验轻量，适合快速起步。

优点：

- 开发速度快。
- 生态成熟。
- 组件拆分清晰。
- Web 端和 Tauri 桌面端都能复用。

### 2.3 Canvas / OffscreenCanvas + Web Worker

第一版切图不需要一开始就引入复杂图像处理库。矩形裁切、缩放导出、透明区域扫描、网格预览等能力都可以先用 Canvas 完成。

Web Worker 用于处理耗时任务：

- 批量导出。
- 多尺寸 icon 生成。
- 透明边距检测。
- 智能识别 icon 的连通区域分析。

这样可以避免主界面卡顿。

### 2.4 暂不优先选择 Electron

Electron 也能完成需求，而且生态成熟，但它会内置 Chromium 和 Node.js，应用体积更大。这个项目的 UI 简单、桌面能力不复杂，Tauri 更适合先做轻量工具。

什么时候考虑 Electron：

- 后续需要大量 Node.js 原生生态能力。
- 团队不想维护 Rust 侧代码。
- 需要更统一的 Chromium 渲染表现。
- 对包体大小不敏感。

## 3. 建议技术架构

```text
Image Slicing Tools
├─ Web UI
│  ├─ React 页面和组件
│  ├─ Canvas 画布交互
│  ├─ 切片列表和属性面板
│  └─ 导出设置面板
├─ Core
│  ├─ 图片加载与解码
│  ├─ 选区模型
│  ├─ 网格生成
│  ├─ 裁切与缩放
│  ├─ 平台 icon 规格
│  └─ 命名规则
├─ Workers
│  ├─ 批量导出
│  ├─ 多尺寸生成
│  ├─ 透明边距检测
│  └─ 智能识别
├─ Desktop Adapter
│  ├─ Tauri 文件选择
│  ├─ Tauri 目录选择
│  ├─ Tauri 写入文件
│  └─ 打开导出目录
└─ Web Adapter
   ├─ 浏览器文件导入
   ├─ Blob 下载
   └─ ZIP 下载
```

## 4. 前端 UI 建议

UI 先做简单、清楚、像工具，不做复杂视觉。

### 4.1 页面布局

- 顶部：打开图片、撤销、重做、缩放、导出。
- 左侧：工具按钮，先放选择、矩形、网格、智能识别占位。
- 中间：图片画布。
- 右侧：当前选区属性、切片列表、导出设置。
- 底部：坐标、尺寸、缩放比例、当前状态。

### 4.2 第一版视觉原则

- 以浅色界面为主，后续再加深色模式。
- 使用简单边框和灰阶背景。
- 选区边框使用明显颜色。
- 不做复杂动画。
- 图标按钮配 tooltip。
- 所有核心操作都提供文字标签或可理解的图标。

## 5. 核心数据模型建议

### 5.1 ImageDocument

表示当前打开的图片。

```ts
type ImageDocument = {
  id: string;
  fileName: string;
  width: number;
  height: number;
  mimeType: string;
  hasAlpha: boolean;
  source: File | Blob;
};
```

### 5.2 SliceRegion

表示一个切片区域。

```ts
type SliceRegion = {
  id: string;
  name: string;
  type: "rect" | "ellipse" | "polygon" | "freeform";
  x: number;
  y: number;
  width: number;
  height: number;
  enabled: boolean;
  locked: boolean;
  groupId?: string;
};
```

### 5.3 ExportPreset

表示导出规格。

```ts
type ExportPreset = {
  id: string;
  name: string;
  target: "generic" | "android" | "ios" | "web" | "custom";
  format: "png" | "jpg" | "webp";
  scales: number[];
  sizes: ExportSize[];
  namingRule: NamingRule;
  directoryRule?: DirectoryRule;
};
```

### 5.4 PlatformIconPreset

表示平台 icon 尺寸包。

```ts
type PlatformIconPreset = {
  id: string;
  platform: "android" | "ios" | "web" | "custom";
  name: string;
  outputs: Array<{
    width: number;
    height: number;
    scale?: number;
    density?: "mdpi" | "hdpi" | "xhdpi" | "xxhdpi" | "xxxhdpi";
    fileName: string;
    directory?: string;
    purpose?: "any" | "maskable" | "monochrome";
  }>;
};
```

## 6. 图片处理策略

### 6.1 第一版

- 使用浏览器 `createImageBitmap` 或 `Image` 加载图片。
- 使用 Canvas 绘制原图。
- 使用 Canvas `drawImage` 执行矩形裁切和缩放。
- 使用 `toBlob` 导出 PNG/JPG/WebP。
- 使用 JSZip 打包多文件。

### 6.2 第二版

- 把批量导出、多尺寸生成放入 Web Worker。
- 支持透明边距检测。
- 支持按 alpha 连通区域识别 icon。
- 支持更多导出检查。

### 6.3 第三版

- 评估 Rust 图像处理能力，用于桌面端大图和高性能批处理。
- 评估 WebAssembly 图像库，用于网页端高性能处理。
- 引入视觉模型或 OCR 辅助命名。

## 7. 平台 icon 规格策略

平台 icon 尺寸规则不要写死在界面里，建议放在独立配置文件中。

```text
src/core/export-presets/
├─ android.ts
├─ ios.ts
├─ web.ts
└─ custom.ts
```

这样后续平台规范变化时，只需要更新配置和测试。

第一版建议内置：

- Web favicon：16、32、48 px。
- Web PWA：192、512 px。
- Android Legacy Launcher：48、72、96、144、192 px。
- iOS 主图：1024 px。

第二版再补齐：

- Android Adaptive Icon。
- iOS 完整 `AppIcon.appiconset`。
- Web manifest 片段。

## 8. 项目目录建议

```text
Image_slicing_tools
├─ docs
│  ├─ PRODUCT_REQUIREMENTS.md
│  ├─ TECH_STACK_RECOMMENDATION.md
│  └─ DEVELOPMENT_TASKS.md
├─ src
│  ├─ app
│  ├─ components
│  ├─ core
│  ├─ workers
│  ├─ platform
│  ├─ styles
│  └─ tests
├─ src-tauri
└─ package.json
```

当前文档已经在根目录，后续初始化项目后可以统一移动到 `docs/`。

## 9. 版本路线

### 9.1 MVP 技术目标

- 先跑通 Web 端。
- 完成基础画布。
- 完成矩形切图。
- 完成多选区列表。
- 完成 PNG/JPG 导出。
- 完成 Web icon 尺寸导出。

### 9.2 桌面端目标

- 接入 Tauri。
- 支持本地打开图片。
- 支持选择导出目录。
- 支持批量写入文件。
- 支持打开导出目录。

### 9.3 智能识别目标

- 先做透明背景 icon 识别。
- 再做纯色背景识别。
- 最后做边缘和视觉模型辅助识别。

## 10. 参考资料

- Tauri 官方文档：https://tauri.app/start/
- Electron 官方文档：https://www.electronjs.org/docs/latest/
- Vite 官方文档：https://vite.dev/guide/
- electron-builder 文档：https://www.electron.build/docs/

