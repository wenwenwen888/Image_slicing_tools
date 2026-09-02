import { isTauriRuntime } from "./runtime";

export type UpdateCheckResult =
  | { status: "desktop-only" }
  | { status: "latest" }
  | { status: "available"; version: string; notes: string | null; install: () => Promise<void> };

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  if (!isTauriRuntime()) {
    return { status: "desktop-only" };
  }

  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) {
    return { status: "latest" };
  }

  return {
    status: "available",
    version: update.version,
    notes: update.body ?? null,
    install: async () => {
      await update.downloadAndInstall();
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    },
  };
}
