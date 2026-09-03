import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  downloadAndInstall: vi.fn(),
  invoke: vi.fn(),
  relaunch: vi.fn(),
}));

vi.mock("./runtime", () => ({ isTauriRuntime: () => true }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: mocks.relaunch }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: mocks.check }));

import { checkForAppUpdate } from "./updater";

describe("桌面端在线更新", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.check.mockResolvedValue({
      body: null,
      downloadAndInstall: mocks.downloadAndInstall,
      version: "0.1.4",
    });
    mocks.downloadAndInstall.mockResolvedValue(undefined);
    mocks.invoke.mockResolvedValue(false);
    mocks.relaunch.mockResolvedValue(undefined);
  });

  it("从应用程序目录运行时下载、安装并重启", async () => {
    const result = await checkForAppUpdate();
    expect(result.status).toBe("available");
    if (result.status !== "available") {
      return;
    }

    await result.install();

    expect(mocks.invoke).toHaveBeenCalledWith("is_app_on_read_only_volume");
    expect(mocks.invoke).toHaveBeenCalledWith("prepare_update_temp_directory");
    expect(mocks.downloadAndInstall).toHaveBeenCalledOnce();
    expect(mocks.relaunch).toHaveBeenCalledOnce();
  });

  it("从已挂载 DMG 运行时给出明确错误且不下载", async () => {
    mocks.invoke.mockResolvedValue(true);

    const result = await checkForAppUpdate();
    expect(result.status).toBe("available");
    if (result.status !== "available") {
      return;
    }

    await expect(result.install()).rejects.toMatchObject({
      code: "running-from-dmg",
    });
    expect(mocks.downloadAndInstall).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalledWith("prepare_update_temp_directory");
    expect(mocks.relaunch).not.toHaveBeenCalled();
  });
});
