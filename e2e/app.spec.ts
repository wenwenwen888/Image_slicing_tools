import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { createRgbaPng, createSolidPng } from "./png";

const SAMPLE_PNG = createSolidPng(200, 200);
const TRANSPARENT_ICON_SHEET = createRgbaPng(180, 120, (x, y) => {
  const inFirstIcon = x >= 20 && x < 56 && y >= 20 && y < 56;
  const inSecondIcon = x >= 92 && x < 130 && y >= 26 && y < 64;
  const inText = x >= 18 && x < 150 && y >= 92 && y < 100;
  return inFirstIcon || inSecondIcon || inText ? [28, 84, 210, 255] : [0, 0, 0, 0];
});
const SOLID_BACKGROUND_ICON_SHEET = createRgbaPng(180, 120, (x, y) => {
  const inIcon = x >= 62 && x < 118 && y >= 32 && y < 88;
  return inIcon ? [22, 163, 74, 255] : [245, 245, 245, 255];
});
const NON_WHITE_BACKGROUND_ICON = createRgbaPng(120, 120, (x, y) => {
  const inIcon = x >= 35 && x < 86 && y >= 35 && y < 86;
  return inIcon ? [225, 30, 38, 255] : [8, 25, 42, 255];
});
const GRADIENT_WITH_LABEL = createRgbaPng(200, 100, (x, y) => {
  const inLabel = x >= 78 && x < 122 && y >= 40 && y < 60;
  return inLabel ? [255, 255, 255, 255] : [120 + Math.round(x * 0.5), 55 + Math.round(y * 0.6), 25 + Math.round(x * 0.2), 255];
});
const FOREGROUND_OVERLAY_SCREEN = createRgbaPng(240, 360, (x, y) => {
  const inDialog = x >= 35 && x < 205 && y >= 92 && y < 320;
  const inLeftStatus = x >= 14 && x < 42 && y >= 14 && y < 25;
  const inRightStatus = x >= 176 && x < 226 && y >= 13 && y < 26;
  if (inDialog || inLeftStatus || inRightStatus) {
    return [248, 248, 248, 255];
  }
  return [20 + Math.round(x / 3), 30 + Math.round(y / 5), 70 + Math.round(x / 6), 255];
});

async function createClosedTextPng(page: Page) {
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 260;
    canvas.height = 100;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas unavailable");
    }

    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#80868b";
    context.font = "700 72px Arial";
    context.textBaseline = "middle";
    context.fillText("OOO", 20, 52);
    return canvas.toDataURL("image/png").split(",")[1];
  });

  return Buffer.from(base64, "base64");
}

async function importImage(page: Page, name: string, buffer: Buffer) {
  await page.getByTestId("image-file-input").setInputFiles({
    name,
    mimeType: "image/png",
    buffer,
  });
  await expect(page.getByTestId("source-image")).toBeVisible();
  await expect(page.getByTestId("status-text")).toHaveText("图片已导入");
}

async function importSampleImage(page: Page) {
  await importImage(page, "sample.png", SAMPLE_PNG);
}

async function dropImage(page: Page, name: string, buffer: Buffer) {
  const dataTransfer = await page.evaluateHandle(
    ({ fileName, base64 }) => {
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], fileName, { type: "image/png" }));
      return transfer;
    },
    { fileName: name, base64: buffer.toString("base64") },
  );
  const canvas = page.getByTestId("canvas-panel");

  await canvas.dispatchEvent("dragenter", { dataTransfer });
  await expect(canvas).toHaveClass(/is-dragging-over/);
  await canvas.dispatchEvent("drop", { dataTransfer });
  await expect(page.getByTestId("source-image")).toBeVisible();
  await expect(page.getByTestId("status-text")).toHaveText("图片已导入");
}

async function sampleSourcePixel(page: Page, x: number, y: number) {
  return page.getByTestId("source-image").evaluate(
    (image, point) => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas unavailable");
      }
      context.drawImage(image, 0, 0);
      return Array.from(context.getImageData(point.x, point.y, 1, 1).data);
    },
    { x, y },
  );
}

async function createRectSlice(page: Page, start = 0.2, end = 0.7, expectedCount = 1) {
  const image = page.getByTestId("source-image");
  const box = await image.boundingBox();
  if (!box) {
    throw new Error("source image has no bounding box");
  }

  await page.getByTestId("tool-rect").click();
  await page.mouse.move(box.x + box.width * start, box.y + box.height * start);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * end, box.y + box.height * end);
  await page.mouse.up();
  await expect(page.getByTestId("slice-list-item")).toHaveCount(expectedCount);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByRole("heading", { name: "图片切图工具" })).toBeVisible();
});

test("可以导入 PNG 图片并显示在画布中", async ({ page }) => {
  await importSampleImage(page);
  await page.getByTestId("image-info-button").click();
  await expect(page.getByTestId("image-info-modal")).toBeVisible();
  await expect(page.getByText("sample.png")).toBeVisible();
  await expect(page.getByText("200 x 200")).toBeVisible();
  await expect(page.getByTestId("export-transparent-background")).toBeChecked();
});

test("可以把图片拖入画布并导入", async ({ page }) => {
  await dropImage(page, "dropped.png", SAMPLE_PNG);
  await page.getByTestId("image-info-button").click();
  await expect(page.getByText("dropped.png")).toBeVisible();
});

test("导入图片后默认居中显示", async ({ page }) => {
  await importImage(page, "wide.png", createSolidPng(900, 180));
  const panel = await page.getByTestId("canvas-panel").boundingBox();
  const image = await page.getByTestId("source-image").boundingBox();
  expect(panel).toBeTruthy();
  expect(image).toBeTruthy();

  expect(Math.abs(panel!.x + panel!.width / 2 - (image!.x + image!.width / 2))).toBeLessThanOrEqual(2);
  expect(Math.abs(panel!.y + panel!.height / 2 - (image!.y + image!.height / 2))).toBeLessThanOrEqual(2);
});

test("可以在设置中切换为英文并查看关于信息", async ({ page }) => {
  const settingsButton = page.getByTestId("settings-button");
  await expect(page.locator(".brand-area").getByTestId("settings-button")).toBeVisible();
  await expect(page.locator(".top-actions").getByTestId("settings-button")).toHaveCount(0);
  await settingsButton.click();
  await expect(page.getByTestId("settings-modal")).toBeVisible();
  await expect(page.getByText("Lam Wan")).toBeVisible();
  await page.getByTestId("language-select").selectOption("en");
  await expect(page.getByRole("heading", { name: "Image Slicing Tools" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Image" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("不支持的文件会给出明确提示", async ({ page }) => {
  await page.getByTestId("image-file-input").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByTestId("error-message").first()).toHaveText("暂时只支持 PNG、JPG/JPEG、WebP 图片。");
  await expect(page.getByTestId("status-text")).toHaveText("导入失败");
});

test("可以用矩形工具创建选区", async ({ page }) => {
  await importSampleImage(page);
  await createRectSlice(page);
  await expect(page.getByTestId("slice-list-item")).toContainText("slice_1");
  await expect(page.getByTestId("status-text")).toHaveText("矩形选区已创建");
});

test("可以按固定比例创建圆形切片", async ({ page }) => {
  await importSampleImage(page);
  await page.getByTestId("tool-circle").click();
  const image = page.getByTestId("source-image");
  const box = await image.boundingBox();
  if (!box) {
    throw new Error("source image has no bounding box");
  }

  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7);
  await page.mouse.up();

  await expect(page.getByTestId("slice-list-item")).toContainText(/(99 x 99|100 x 100)/);
  await expect(page.getByTestId("slice-box")).toHaveClass(/ellipse/);
});

test("左侧工具栏不再显示正方形和椭圆工具", async ({ page }) => {
  await expect(page.getByTestId("tool-square")).toHaveCount(0);
  await expect(page.getByTestId("tool-ellipse")).toHaveCount(0);
});

test("画笔可以取色、调整大小并写入图片", async ({ page }) => {
  await importSampleImage(page);
  await page.getByTestId("tool-brush").click();
  await expect(page.getByTestId("brush-panel")).toBeVisible();
  const canvas = page.getByTestId("canvas-panel");
  const image = page.getByTestId("source-image");
  const box = await image.boundingBox();
  if (!box) {
    throw new Error("source image has no bounding box");
  }
  await page.getByTestId("brush-pick-color").click();
  const pickerCursor = await canvas.evaluate((element) => getComputedStyle(element).cursor);
  expect(pickerCursor).toContain("data:image/svg+xml");
  await page.mouse.click(box.x + 2, box.y + 2);
  await expect(page.getByTestId("brush-color")).toHaveValue("#dc2828");
  await page.getByTestId("brush-color").evaluate((input) => {
    const colorInput = input as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setValue?.call(colorInput, "#16a34a");
    colorInput.dispatchEvent(new Event("input", { bubbles: true }));
    colorInput.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByTestId("brush-color")).toHaveValue("#16a34a");
  await page.getByTestId("brush-size").fill("24");
  await page.getByLabel("关闭工具设置").click();
  await expect(page.getByTestId("brush-panel")).toHaveCount(0);
  await expect(page.getByTestId("tool-brush")).toHaveClass(/active/);

  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5);
  await expect(page.getByTestId("brush-cursor")).toBeVisible();
  await expect(page.getByTestId("brush-cursor")).toHaveCSS("width", "24px");
  await expect(canvas).toHaveCSS("cursor", "none");
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5);
  await page.mouse.up();
  await expect(page.getByTestId("status-text")).toHaveText("画笔涂抹已应用");
  await expect.poll(() => sampleSourcePixel(page, 100, 100)).toEqual([22, 163, 74, 255]);

  const undoButton = page.getByRole("button", { name: "撤销" });
  const redoButton = page.getByRole("button", { name: "重做" });
  await expect(undoButton).toBeEnabled();
  await undoButton.click();
  await expect(page.getByTestId("status-text")).toHaveText("已撤销图片编辑");
  await expect.poll(() => sampleSourcePixel(page, 100, 100)).toEqual([220, 40, 40, 255]);
  await expect(redoButton).toBeEnabled();
  await redoButton.click();
  await expect.poll(() => sampleSourcePixel(page, 100, 100)).toEqual([22, 163, 74, 255]);
});

test("任意工具下都可以从图片外拖动画布", async ({ page }) => {
  await importSampleImage(page);
  await page.getByTestId("tool-brush").click();
  const panel = await page.getByTestId("canvas-panel").boundingBox();
  const before = await page.getByTestId("source-image").boundingBox();
  if (!panel || !before) {
    throw new Error("canvas has no bounding box");
  }

  const startX = panel.x + panel.width - 24;
  const startY = panel.y + panel.height / 2;
  expect(startX).toBeGreaterThan(before.x + before.width);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 48, startY + 28);
  await page.mouse.up();

  const after = await page.getByTestId("source-image").boundingBox();
  expect(after).toBeTruthy();
  expect(after!.x).toBeLessThan(before.x - 40);
  expect(after!.y).toBeGreaterThan(before.y + 20);
  await expect(page.getByTestId("tool-brush")).toHaveClass(/active/);
});

test("智能消除可以恢复文字下方的渐变背景", async ({ page }) => {
  await importImage(page, "gradient-label.png", GRADIENT_WITH_LABEL);
  await page.getByTestId("tool-smart-erase").click();
  const image = page.getByTestId("source-image");
  const box = await image.boundingBox();
  if (!box) {
    throw new Error("source image has no bounding box");
  }

  await page.mouse.move(box.x + box.width * 0.36, box.y + box.height * 0.32);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.64, box.y + box.height * 0.68);
  await page.mouse.up();
  await expect(page.getByTestId("smart-erase-box")).toBeVisible();
  await page.getByTestId("apply-smart-erase").click();
  await expect(page.getByTestId("status-text")).toHaveText("智能消除已完成");
  await expect.poll(() => sampleSourcePixel(page, 100, 50)).toEqual([170, 85, 45, 255]);
  await page.getByRole("button", { name: "撤销" }).click();
  await expect(page.getByTestId("status-text")).toHaveText("已撤销图片编辑");
  await expect.poll(() => sampleSourcePixel(page, 100, 50)).toEqual([255, 255, 255, 255]);
  await page.getByRole("button", { name: "重做" }).click();
  await expect.poll(() => sampleSourcePixel(page, 100, 50)).toEqual([170, 85, 45, 255]);
});

test("可以批量导出多个启用切片为 ZIP", async ({ page }) => {
  await importSampleImage(page);
  await page.getByTestId("tool-grid").click();
  await page.getByTestId("grid-mode").selectOption("equal");
  await page.getByRole("button", { name: "替换生成" }).click();
  await expect(page.getByTestId("slice-list-item")).toHaveCount(9);

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-button").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("slice.zip");

  const zipPath = await download.path();
  expect(zipPath).toBeTruthy();
  const zip = await JSZip.loadAsync(await readFile(zipPath!));
  const files = Object.keys(zip.files).sort();
  expect(files).toHaveLength(9);
  expect(files[0]).toMatch(/^slice_001_grid_r1_c1_001\.png$/);
  await expect(page.getByTestId("status-text")).toHaveText("已导出 9 个切片");
});

test("可以从右键菜单单独导出当前选区", async ({ page }) => {
  await importSampleImage(page);
  await createRectSlice(page);
  await createRectSlice(page, 0.08, 0.18, 2);

  await page.getByTestId("slice-box").nth(1).click({ button: "right" });
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("context-export-slice").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("slice_001_slice_2.png");
  await expect(page.getByTestId("status-text")).toHaveText("已导出 1 个切片");
});

test("可以智能清除大面积前景并撤销", async ({ page }) => {
  await importImage(page, "foreground-screen.png", FOREGROUND_OVERLAY_SCREEN);
  await page.locator(".image-stage").click({ button: "right", position: { x: 8, y: 180 } });
  await page.getByTestId("context-clear-foreground").click();
  await expect(page.getByTestId("status-text")).toHaveText("前景元素已智能清除", { timeout: 15_000 });

  const restored = await sampleSourcePixel(page, 120, 200);
  expect(restored[0]).toBeLessThan(100);
  expect(restored[1]).toBeLessThan(110);
  expect(restored[2]).toBeLessThan(130);

  await page.getByRole("button", { name: "撤销" }).click();
  await expect.poll(() => sampleSourcePixel(page, 120, 200)).toEqual([248, 248, 248, 255]);
});

test("可以导出 Web icon 资源包", async ({ page }) => {
  await importSampleImage(page);
  await createRectSlice(page);
  await page.getByTestId("target-platform").selectOption("web");

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-button").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("slice_web_icons.zip");

  const zip = await JSZip.loadAsync(await readFile((await download.path())!));
  expect(zip.file("web-icons/slice_001_slice_1_16x16.png")).toBeTruthy();
  expect(zip.file("web-icons/slice_001_slice_1_32x32.png")).toBeTruthy();
  expect(zip.file("web-icons/slice_001_slice_1_192x192.png")).toBeTruthy();
  expect(zip.file("web-icons/manifest-icons.json")).toBeNull();
  expect(zip.file("web-icons/html-links.txt")).toBeNull();
  expect(zip.file("web-icons/export-report.md")).toBeNull();
  await expect(page.getByTestId("status-text")).toHaveText("已导出 Web 切图：1 个切片");
});

test("智能识别默认过滤疑似文字并直接追加切片", async ({ page }) => {
  await importImage(page, "icons-with-text.png", TRANSPARENT_ICON_SHEET);
  await page.getByTestId("tool-scan").click();
  await page.getByTestId("scan-detect-preview").click();

  await expect(page.getByTestId("slice-list-item")).toHaveCount(2);
  await expect(page.getByTestId("status-text")).toHaveText("已追加 2 个识别切片");
});

test("打开文字识别后会保留文字候选区域", async ({ page }) => {
  await importImage(page, "icons-with-text.png", TRANSPARENT_ICON_SHEET);
  await page.getByTestId("tool-scan").click();
  await page.getByText("高级识别调节").click();
  await page.getByTestId("scan-include-text").check();
  await page.getByTestId("scan-detect-preview").click();

  await expect(page.getByTestId("slice-list-item")).toHaveCount(3);
});

test("可以从画布取背景色后识别纯色背景 icon", async ({ page }) => {
  await importImage(page, "solid-background-icon.png", SOLID_BACKGROUND_ICON_SHEET);
  await page.getByTestId("tool-scan").click();
  const image = page.getByTestId("source-image");
  const box = await image.boundingBox();
  if (!box) {
    throw new Error("source image has no bounding box");
  }

  await page.getByTestId("scan-pick-background").click();
  await page.mouse.click(box.x + 4, box.y + 4);
  await expect(page.getByTestId("tool-popover")).toBeVisible();
  await expect(page.getByTestId("scan-background-color")).toHaveValue("#f5f5f5");
  await expect(page.getByTestId("status-text")).toHaveText("背景色已取样");

  await page.getByTestId("scan-detect-preview").click();
  await expect(page.getByTestId("slice-list-item")).toHaveCount(1);
});

test("可以关闭当前图片并清空画布", async ({ page }) => {
  await importSampleImage(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("close-image-button").click();
  await expect(page.getByTestId("source-image")).toHaveCount(0);
  await expect(page.getByTestId("canvas-empty-open")).toBeVisible();
});

test("可以右键删除选区并移除所有选区", async ({ page }) => {
  await importSampleImage(page);
  await createRectSlice(page);
  await createRectSlice(page, 0.08, 0.18, 2);
  await expect(page.getByTestId("slice-list-item")).toHaveCount(2);

  const firstSlice = page.getByTestId("slice-box").first();
  await firstSlice.click({ button: "right" });
  await expect(page.getByTestId("context-smart-erase")).toBeVisible();
  await page.getByTestId("context-delete-slice").click();
  await expect(page.getByTestId("slice-list-item")).toHaveCount(1);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByText("切片列表").click();
  await page.getByTestId("clear-slices-button").click();
  await expect(page.getByTestId("slice-list-item")).toHaveCount(0);
});

test("可以用选区右上角关闭按钮删除选区", async ({ page }) => {
  await importSampleImage(page);
  await createRectSlice(page);

  await page.getByTestId("slice-close-button").click();
  await expect(page.getByTestId("slice-list-item")).toHaveCount(0);
  await expect(page.getByTestId("status-text")).toHaveText("选区已删除");
});

test("导出透明背景可以自动处理非白色底", async ({ page }) => {
  await importImage(page, "dark-bg-icon.png", NON_WHITE_BACKGROUND_ICON);
  await createRectSlice(page, 0.12, 0.88);
  const image = page.getByTestId("source-image");
  const box = await image.boundingBox();
  if (!box) {
    throw new Error("source image has no bounding box");
  }

  await page.getByTestId("export-pick-background").click();
  await page.mouse.click(box.x + 4, box.y + 4);
  await expect(page.getByTestId("export-background-color")).toHaveValue("#08192a");

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-button").click();
  const download = await downloadPromise;
  const filePath = await download.path();
  expect(filePath).toBeTruthy();

  const dataUrl = `data:image/png;base64,${(await readFile(filePath!)).toString("base64")}`;
  const alpha = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas unavailable");
    }
    context.drawImage(image, 0, 0);
    return {
      corner: context.getImageData(1, 1, 1, 1).data[3],
      center: context.getImageData(Math.floor(image.width / 2), Math.floor(image.height / 2), 1, 1).data[3],
    };
  }, dataUrl);

  expect(alpha.corner).toBe(0);
  expect(alpha.center).toBe(255);
});

test("Android 小尺寸导出会先清理背景再缩放", async ({ page }) => {
  await importImage(page, "dark-bg-icon.png", NON_WHITE_BACKGROUND_ICON);
  await createRectSlice(page, 0.02, 0.98);
  const image = page.getByTestId("source-image");
  const box = await image.boundingBox();
  if (!box) {
    throw new Error("source image has no bounding box");
  }

  await page.getByTestId("export-pick-background").click();
  await page.mouse.click(box.x + 2, box.y + 2);
  await page.getByTestId("target-platform").selectOption("android");
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-button").click();
  const download = await downloadPromise;
  const zip = await JSZip.loadAsync(await readFile((await download.path())!));
  const mdpiPath = Object.keys(zip.files).find((path) => path.includes("mipmap-mdpi") && path.endsWith(".png"));
  expect(mdpiPath).toBeTruthy();
  const png = await zip.file(mdpiPath!)!.async("base64");

  const alpha = await page.evaluate(async (source) => {
    const exported = new Image();
    exported.src = `data:image/png;base64,${source}`;
    await exported.decode();
    const canvas = document.createElement("canvas");
    canvas.width = exported.width;
    canvas.height = exported.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas unavailable");
    }
    context.drawImage(exported, 0, 0);
    return {
      corner: context.getImageData(1, 1, 1, 1).data[3],
      center: context.getImageData(Math.floor(exported.width / 2), Math.floor(exported.height / 2), 1, 1).data[3],
    };
  }, png);

  expect(alpha.corner).toBeLessThan(16);
  expect(alpha.center).toBeGreaterThan(240);
});

test("导出透明背景会清理闭合文字内孔并羽化边缘", async ({ page }) => {
  await importImage(page, "closed-text.png", await createClosedTextPng(page));
  await createRectSlice(page, 0.02, 0.98);

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-button").click();
  const download = await downloadPromise;
  const filePath = await download.path();
  expect(filePath).toBeTruthy();

  const dataUrl = `data:image/png;base64,${(await readFile(filePath!)).toString("base64")}`;
  const alpha = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas unavailable");
    }
    context.drawImage(image, 0, 0);

    function scanAlpha(left: number, top: number, width: number, height: number) {
      const data = context.getImageData(left, top, width, height).data;
      let min = 255;
      let max = 0;
      let partial = 0;
      for (let index = 3; index < data.length; index += 4) {
        min = Math.min(min, data[index]);
        max = Math.max(max, data[index]);
        if (data[index] > 0 && data[index] < 255) {
          partial += 1;
        }
      }

      return { min, max, partial };
    }

    return {
      corner: context.getImageData(2, 2, 1, 1).data[3],
      hole: scanAlpha(40, 30, 30, 30),
      body: scanAlpha(20, 18, 55, 60),
      edge: scanAlpha(14, 12, 190, 70),
    };
  }, dataUrl);

  expect(alpha.corner).toBe(0);
  expect(alpha.hole.min).toBe(0);
  expect(alpha.body.max).toBeGreaterThan(180);
  expect(alpha.edge.partial).toBeGreaterThan(0);
});
