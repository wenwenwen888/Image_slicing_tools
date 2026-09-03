# Image Slicing Tools

Image Slicing Tools 是一款面向设计、开发与内容制作场景的跨平台图片切图工具，可运行于 macOS、Windows 和现代浏览器。它提供手动选区、网格切分、图形识别、透明背景处理以及多尺寸批量导出能力，帮助用户在一个工作区内完成从图片导入到切片交付的完整流程。

## 功能特性

- 支持导入 PNG、JPG/JPEG 和 WebP 图片，也可直接将图片拖入画布。
- 提供矩形、圆角矩形、正方形、圆形和椭圆等手动选区工具。
- 支持按行列或固定尺寸生成网格切片。
- 支持智能识别图片中的 icon 与图形元素，可过滤文字、合并相邻区域并调整识别策略。
- 支持移动、缩放、删除单个选区，以及批量移除全部选区。
- 支持 PNG、JPG/JPEG 和 WebP 格式导出。
- 支持通用、Android、iOS、Web 和自定义尺寸批量导出。
- 支持纯色背景智能转透明，并对边缘残色和闭合区域进行处理。
- 桌面端可直接选择导出目录，网页端可将结果打包为 ZIP 下载。
- 支持中文与 English 界面切换，并提供桌面端在线更新检查。

## 获取应用

可前往 [GitHub Releases](https://github.com/wenwenwen888/Image_slicing_tools/releases/latest) 获取最新桌面版本：

- macOS：适用于 Apple Silicon 设备的 DMG 安装包。
- Windows：适用于 64 位 Windows 的安装程序。
- Web：可按照下方开发指南在本地浏览器中运行。

## 快速上手

1. 点击“打开图片”，或将图片拖入画布区域。
2. 从左侧工具栏选择形状、网格或智能识别工具。
3. 在画布中创建切片，并按需调整选区的位置和大小。
4. 在右侧导出设置中选择导出范围、格式、目标尺寸和透明背景选项。
5. 点击导出。桌面端可保存到指定目录，网页端会下载 ZIP 文件。

## 技术架构

| 模块 | 技术 | 用途 |
| --- | --- | --- |
| 用户界面 | React 19、TypeScript | 构建编辑器界面与交互组件 |
| 构建工具 | Vite 7 | 本地开发与前端产物构建 |
| 桌面运行时 | Tauri 2、Rust | macOS 与 Windows 原生应用封装 |
| 状态管理 | Zustand | 管理图片、选区和导出配置 |
| 文件导出 | Canvas API、JSZip | 图片处理与 ZIP 文件生成 |
| 自动化测试 | Vitest、Playwright | 核心逻辑测试与端到端验证 |

所有图片处理均在本地完成，项目不依赖远程图片处理服务。

## 本地开发

### 环境要求

- Node.js 22 或更高版本
- pnpm 11 或更高版本
- Rust stable，仅桌面端开发和构建需要

安装依赖：

```bash
pnpm install
```

启动 Web 开发环境：

```bash
pnpm run dev
```

默认访问地址为 `http://localhost:5173`。

启动桌面端开发环境：

```bash
pnpm run desktop:dev
```

## 项目结构

```text
src/
├── app/          应用入口与整体布局
├── components/   画布、工具栏、配置面板等界面组件
├── core/         识别、切片、图像处理与导出逻辑
├── platform/     Web 与桌面端平台能力适配
├── store/        工作区状态管理
└── styles/       全局样式

src-tauri/        Tauri 桌面端配置与 Rust 代码
scripts/          本地开发、构建与辅助脚本
e2e/              Playwright 端到端测试
```

## 测试

运行核心逻辑测试：

```bash
pnpm run test
```

运行端到端测试：

```bash
pnpm run test:e2e
```

## 构建

构建 Web 版本：

```bash
pnpm run build
```

构建当前系统对应的桌面安装包：

```bash
pnpm run desktop:build
```

构建产物位于 `dist/` 和 `src-tauri/target/release/bundle/` 目录。
