import { isTauriRuntime } from "./runtime";

export type UpdateInstallProgress = {
  phase: "downloading" | "installing" | "restarting";
  downloadedBytes: number;
  totalBytes: number | null;
};

export class UpdateInstallError extends Error {
  constructor(public readonly code: "running-from-dmg", message: string) {
    super(message);
    this.name = "UpdateInstallError";
  }
}

export type UpdateCheckResult =
  | { status: "desktop-only" }
  | { status: "latest" }
  | {
      status: "available";
      version: string;
      notes: string | null;
      install: (onProgress?: (progress: UpdateInstallProgress) => void) => Promise<void>;
    };

async function assertWritableInstallLocation() {
  const { executableDir } = await import("@tauri-apps/api/path");
  const executableDirectory = await executableDir();

  if (executableDirectory.startsWith("/Volumes/")) {
    throw new UpdateInstallError(
      "running-from-dmg",
      "The app is running from a mounted disk image and cannot update itself.",
    );
  }
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  if (!isTauriRuntime()) {
    return { status: "desktop-only" };
  }

  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check({ timeout: 30_000 });
  if (!update) {
    return { status: "latest" };
  }

  return {
    status: "available",
    version: update.version,
    notes: update.body ?? null,
    install: async (onProgress) => {
      await assertWritableInstallLocation();

      let downloadedBytes = 0;
      let totalBytes: number | null = null;
      await update.downloadAndInstall(
        (event) => {
          if (event.event === "Started") {
            downloadedBytes = 0;
            totalBytes = event.data.contentLength ?? null;
            onProgress?.({ phase: "downloading", downloadedBytes, totalBytes });
          } else if (event.event === "Progress") {
            downloadedBytes += event.data.chunkLength;
            onProgress?.({ phase: "downloading", downloadedBytes, totalBytes });
          } else {
            onProgress?.({ phase: "installing", downloadedBytes, totalBytes });
          }
        },
        { timeout: 300_000, restartAfterInstall: true },
      );

      onProgress?.({ phase: "restarting", downloadedBytes, totalBytes });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    },
  };
}
