import { isTauriRuntime } from "./runtime";

export async function saveBlob(blob: Blob, fileName: string) {
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
