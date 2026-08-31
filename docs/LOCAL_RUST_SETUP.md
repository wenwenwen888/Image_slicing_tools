# 项目内 Rust 工具链说明

如果仓库里有 `.local-rust`，桌面命令会优先用它：

- Cargo Home：`.local-rust/cargo`
- Rustup Home：`.local-rust/rustup`

没有这份目录时，会改用系统里已安装的 `rustc` / `cargo`。脚本不再依赖 Codex 或 macOS 专用路径，Windows、macOS、Linux 都可以用。

## 常用命令

推荐走 npm scripts（跨平台）：

```sh
pnpm desktop:dev
pnpm desktop:build
```

验证 Rust（可选）：

```sh
node scripts/with-project-rust.mjs rustc --version
node scripts/with-project-rust.mjs cargo --version
```

Windows PowerShell 也可以直接跑：

```powershell
.\scripts\desktop-dev.ps1
.\scripts\desktop-build.ps1
```

macOS / Linux 仍可使用：

```sh
scripts/desktop-dev.sh
scripts/desktop-build.sh
```

## 清理

如果后续想移除项目内 Rust，可以删除：

```sh
.local-rust
```
