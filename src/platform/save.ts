import { isTauriRuntime } from "./runtime";

export type DirectoryExportFile = {
  path: string;
  content: Blob | string | Uint8Array;
};

export async function saveBlob(blob: Blob, fileName: string) {
  if (isTauriRuntime()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { invoke } = await import("@tauri-apps/api/core");
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

    await invoke("write_binary_file", {
      path: selectedPath,
      bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
    });
    return;
  }

  downloadBlob(blob, fileName);
}

export async function saveFilesToDirectory(files: DirectoryExportFile[], defaultDirectoryName: string) {
  if (!isTauriRuntime()) {
    throw new Error("Directory export is only available in the desktop app.");
  }

  const { open } = await import("@tauri-apps/plugin-dialog");
  const { invoke } = await import("@tauri-apps/api/core");
  const selectedPath = await open({
    defaultPath: defaultDirectoryName,
    directory: true,
    multiple: false,
    title: "选择导出目录",
  });

  if (!selectedPath || Array.isArray(selectedPath)) {
    return null;
  }

  for (const file of files) {
    const content = await normalizeFileContent(file.content);
    await invoke("write_binary_file", {
      path: joinPath(selectedPath, file.path),
      bytes: Array.from(content),
    });
  }

  return selectedPath;
}

export async function openPath(path: string) {
  if (!isTauriRuntime()) {
    return;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("open_path", { path });
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

function joinPath(root: string, relativePath: string) {
  const cleanRoot = root.replace(/[\\/]+$/, "");
  const cleanRelativePath = relativePath.replace(/^[\\/]+/, "").replace(/\\/g, "/");
  return `${cleanRoot}/${cleanRelativePath}`;
}

async function normalizeFileContent(content: DirectoryExportFile["content"]) {
  if (typeof content === "string") {
    return new TextEncoder().encode(content);
  }

  if (content instanceof Blob) {
    return new Uint8Array(await content.arrayBuffer());
  }

  return content;
}
