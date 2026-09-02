# Image Slicing Tools

Image Slicing Tools 是一个跨平台图片切图工具，面向 macOS、Windows 和网页端。它可以导入 PNG、JPG/JPEG、WebP 图片，手动绘制切片区域，智能识别图片里的 icon 或图形元素，并按通用、Android、iOS、Web、自定义尺寸导出切图。

作者：Lam Wan

当前版本：0.1.2

## 主要功能

- 导入 PNG、JPG/JPEG、WebP 图片。
- 支持拖入图片、点击打开图片、缩放画布、拖动画布。
- 支持矩形、圆角矩形、正方形、圆形、椭圆选区。
- 支持右键删除选区、选区右上角快速关闭、移除所有选区。
- 支持网格切图，可按固定尺寸或行列均分生成切片。
- 支持智能识别 icon，并可过滤文字、合并相近区域、调节识别参数。
- 支持导出透明背景，自动识别纯色背景并处理边缘残留。
- 支持通用导出 PNG/JPG/WebP。
- 支持 Android、iOS、Web 平台尺寸切图，按目标尺寸框等比缩放，保留原比例。
- 支持自定义导出尺寸和预设文件。
- 桌面端支持直接导出到文件夹。
- 设置里支持中文 / English 切换、关于信息、检查更新。

## 使用方式

1. 点击“打开图片”，或把图片拖入画布。
2. 在左侧选择矩形、圆角、圆形、网格或识别工具。
3. 创建或识别切片后，可以在画布上拖动、缩放、删除选区。
4. 在右侧“导出设置”里选择导出范围、目标平台、格式和透明背景选项。
5. 点击“导出”，网页端会下载 ZIP，桌面端可选择 ZIP 或直接导出到文件夹。

## 平台尺寸导出说明

Android、iOS、Web 的尺寸导出用于普通 icon / 图片切图，不是应用启动图标生成器。

- 不会强制把图片压成 1:1。
- 会按目标尺寸框等比缩放，保留原始比例。
- 文件名沿用通用命名规则，并附加实际导出尺寸。
- 不会导出 AppIcon、manifest、XML、export-report.md 等配置文件。

## 开发

```bash
pnpm install
pnpm run dev
```

启动 macOS / Windows 桌面端开发模式：

```bash
pnpm run desktop:dev
```

构建前端：

```bash
pnpm run build
```

构建桌面安装包：

```bash
pnpm run desktop:build
```

## 测试

```bash
pnpm run test
pnpm run test:e2e
```

## 发布 Release

本项目提供 GitHub Actions 发布流程。推送 tag 后会自动构建 macOS 和 Windows 安装包，并上传到 GitHub Release。

```bash
git tag v0.1.2
git push origin v0.1.2
```

在线更新依赖 Tauri updater 签名。当前私钥未设置密码，仓库只需配置这个 GitHub Secret：

- `TAURI_SIGNING_PRIVATE_KEY`

当前 updater endpoint 指向：

```text
https://github.com/wenwenwen888/Image_slicing_tools/releases/latest/download/latest.json
```
