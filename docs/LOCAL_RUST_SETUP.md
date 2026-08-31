# 项目内 Rust 工具链说明

Rust 已安装到当前项目目录下：

- Cargo Home：`.local-rust/cargo`
- Rustup Home：`.local-rust/rustup`

这个安装不会修改系统 PATH，也不会写入默认的用户级 `~/.cargo` 或 `~/.rustup`。

## 常用命令

验证 Rust：

```sh
scripts/with-project-rust.sh rustc --version
scripts/with-project-rust.sh cargo --version
```

启动桌面端开发模式：

```sh
scripts/desktop-dev.sh
```

构建桌面端安装包：

```sh
scripts/desktop-build.sh
```

## 清理

如果后续想移除项目内 Rust，可以删除：

```sh
.local-rust
```

