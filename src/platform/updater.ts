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

const UPDATE_CHECK_DELAYS = [0, 800, 2_000];

function wait(delay: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, delay));
}

async function checkWithRetry() {
  const { check } = await import("@tauri-apps/plugin-updater");
  let lastError: unknown;

  for (const delay of UPDATE_CHECK_DELAYS) {
    if (delay > 0) {
      await wait(delay);
    }

    try {
      return await check({
        timeout: 30_000,
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function assertWritableInstallLocation() {
  const { invoke } = await import("@tauri-apps/api/core");
  const isOnReadOnlyVolume = await invoke<boolean>("is_app_on_read_only_volume");

  if (isOnReadOnlyVolume) {
    throw new UpdateInstallError(
      "running-from-dmg",
      "The app is running from a mounted disk image and cannot update itself.",
    );
  }

  await invoke("prepare_update_temp_directory");
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  if (!isTauriRuntime()) {
    return { status: "desktop-only" };
  }

  const update = await checkWithRetry();
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
