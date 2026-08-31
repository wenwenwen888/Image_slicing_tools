import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { createSolidPng } from "./png";

const SAMPLE_PNG = createSolidPng(200, 200);

async function importSampleImage(page: Page) {
  await page.getByTestId("image-file-input").setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: SAMPLE_PNG,
  });
  await expect(page.getByTestId("source-image")).toBeVisible();
  await expect(page.getByTestId("status-text")).toHaveText("图片已导入");
}

async function createRectSlice(page: Page) {
  const image = page.getByTestId("source-image");
  const box = await image.boundingBox();
  if (!box) {
    throw new Error("source image has no bounding box");
  }

  await page.getByTestId("tool-rect").click();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7);
  await page.mouse.up();
  await expect(page.getByTestId("slice-list-item")).toHaveCount(1);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Image Slicing Tools" })).toBeVisible();
});

test("可以导入 PNG 图片并显示在画布中", async ({ page }) => {
  await importSampleImage(page);
  await expect(page.getByText("sample.png")).toBeVisible();
  await expect(page.getByText("200 x 200")).toBeVisible();
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
