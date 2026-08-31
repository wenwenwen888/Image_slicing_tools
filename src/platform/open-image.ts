import { getMimeTypeFromFileName } from "../core/files";

export async function openImageFromDesktopDialog() {
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
    return null;
  }

  const bytes = await readFile(selected);
  const fileName = selected.split(/[\\/]/).pop() ?? "image";
  const mimeType = getMimeTypeFromFileName(fileName);
  return new File([new Blob([bytes], { type: mimeType })], fileName, { type: mimeType });
}
