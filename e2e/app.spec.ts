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

test("可以导出 Web icon 资源包", async ({ page }) => {
  await importSampleImage(page);
  await createRectSlice(page);
  await page.getByTestId("target-platform").selectOption("web");

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-button").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("slice_web_icons.zip");

  const zip = await JSZip.loadAsync(await readFile((await download.path())!));
  expect(zip.file("web-icons/favicon-16x16.png")).toBeTruthy();
  expect(zip.file("web-icons/favicon-32x32.png")).toBeTruthy();
  expect(zip.file("web-icons/icon-192x192.png")).toBeTruthy();
  expect(zip.file("web-icons/manifest-icons.json")).toBeTruthy();
  expect(zip.file("web-icons/html-links.txt")).toBeTruthy();
  expect(zip.file("web-icons/export-report.md")).toBeTruthy();

  const manifest = JSON.parse((await zip.file("web-icons/manifest-icons.json")?.async("string")) ?? "{}");
  expect(manifest.icons.length).toBeGreaterThan(0);
  await expect(page.getByTestId("status-text")).toHaveText("已导出 Web 资源包：1 个切片");
});

test("智能识别默认过滤疑似文字并先生成预览", async ({ page }) => {
  await importImage(page, "icons-with-text.png", TRANSPARENT_ICON_SHEET);
  await page.getByTestId("tool-scan").click();
  await page.getByTestId("scan-detect-preview").click();

  await expect(page.getByTestId("scan-preview-item")).toHaveCount(2);
  await expect(page.getByTestId("slice-list-item")).toHaveCount(0);

  await page.getByTestId("scan-apply-replace").click();
  await expect(page.getByTestId("slice-list-item")).toHaveCount(2);
  await expect(page.getByTestId("status-text")).toHaveText("已替换为 2 个识别切片");
});

test("打开文字识别后会保留文字候选区域", async ({ page }) => {
  await importImage(page, "icons-with-text.png", TRANSPARENT_ICON_SHEET);
  await page.getByTestId("tool-scan").click();
  await page.getByText("识别参数").click();
  await page.getByTestId("scan-include-text").check();
  await page.getByTestId("scan-detect-preview").click();

  await expect(page.getByTestId("scan-preview-item")).toHaveCount(3);
  await page.getByTestId("scan-remove-preview-item").last().click();
  await expect(page.getByTestId("scan-preview-item")).toHaveCount(2);
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
  await expect(page.getByTestId("scan-preview-item")).toHaveCount(1);
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
