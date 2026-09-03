import { getMimeTypeFromFileName } from "../core/files";

export async function readDesktopFile(path: string) {
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const bytes = await readFile(path);
  const fileName = path.split(/[\\/]/).pop() ?? "file";
  const mimeType = fileName.toLowerCase().endsWith(".json") ? "application/json" : getMimeTypeFromFileName(fileName);
  return new File([bytes], fileName, { type: mimeType });
}

export async function openImageFromDesktopDialog() {
  const { open } = await import("@tauri-apps/plugin-dialog");
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
    return null;
  }

  return readDesktopFile(selected);
}
