import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  downloadAndInstall: vi.fn(),
  relaunch: vi.fn(),
  resourceDir: vi.fn(),
}));

vi.mock("./runtime", () => ({ isTauriRuntime: () => true }));
vi.mock("@tauri-apps/api/path", () => ({ resourceDir: mocks.resourceDir }));
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
    mocks.relaunch.mockResolvedValue(undefined);
  });

  it("从应用程序目录运行时下载、安装并重启", async () => {
    mocks.resourceDir.mockResolvedValue("/Applications/图片切图工具.app/Contents/Resources");

    const result = await checkForAppUpdate();
    expect(result.status).toBe("available");
    if (result.status !== "available") {
      return;
    }

    await result.install();

    expect(mocks.resourceDir).toHaveBeenCalledOnce();
    expect(mocks.downloadAndInstall).toHaveBeenCalledOnce();
    expect(mocks.relaunch).toHaveBeenCalledOnce();
  });

  it("从已挂载 DMG 运行时给出明确错误且不下载", async () => {
    mocks.resourceDir.mockResolvedValue("/Volumes/图片切图工具/图片切图工具.app/Contents/Resources");

    const result = await checkForAppUpdate();
    expect(result.status).toBe("available");
    if (result.status !== "available") {
      return;
    }

    await expect(result.install()).rejects.toMatchObject({
      code: "running-from-dmg",
    });
    expect(mocks.downloadAndInstall).not.toHaveBeenCalled();
    expect(mocks.relaunch).not.toHaveBeenCalled();
  });
});
