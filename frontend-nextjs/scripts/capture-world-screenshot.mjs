import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.WORLD_BASE_URL ?? "http://127.0.0.1:3000";
const outputPath = process.env.WORLD_SCREENSHOT_PATH ?? "test-results/world/world-redesign.png";
const movementRecipe = process.env.WORLD_CAPTURE_MOVE ?? "";
const dragRecipe = process.env.WORLD_CAPTURE_DRAG ?? "";
const wheelDelta = Number(process.env.WORLD_CAPTURE_WHEEL ?? "");
const fullPage = process.env.WORLD_SCREENSHOT_FULLPAGE === "1";

const keyAliases = new Map([
  ["KeyW", "w"],
  ["KeyA", "a"],
  ["KeyS", "s"],
  ["KeyD", "d"],
  ["ShiftLeft", "Shift"],
  ["ShiftRight", "Shift"],
  ["Space", " "],
]);

async function run() {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const localLibCandidates = [
    "/tmp/playwright-libs/usr/lib/x86_64-linux-gnu",
    "/tmp/playwright-libs/lib/x86_64-linux-gnu",
  ];
  const localLibPaths = [];
  for (const candidate of localLibCandidates) {
    try {
      await fs.access(candidate);
      localLibPaths.push(candidate);
    } catch {
      // Optional dependency path.
    }
  }

  const launchEnv = { ...process.env };
  if (localLibPaths.length > 0) {
    const existing = process.env.LD_LIBRARY_PATH ? `${process.env.LD_LIBRARY_PATH}` : "";
    launchEnv.LD_LIBRARY_PATH = `${localLibPaths.join(":")}${existing ? `:${existing}` : ""}`;
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
    env: launchEnv,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();
  await page.goto(`${baseUrl}/world`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });

  try {
    await page.getByText("Docking into the world...").waitFor({ state: "hidden", timeout: 180_000 });
  } catch {
    await page.waitForTimeout(12_500);
  }

  await page.waitForFunction(
    () => {
      const canvas = document.querySelector("canvas");
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width <= 0 || canvas.height <= 0) {
        return false;
      }

      const gl =
        canvas.getContext("webgl2", { preserveDrawingBuffer: true }) ??
        canvas.getContext("webgl", { preserveDrawingBuffer: true });
      if (!gl) {
        return false;
      }

      const samples = [
        [0.5, 0.52],
        [0.34, 0.42],
        [0.66, 0.42],
        [0.5, 0.24],
      ];
      const pixel = new Uint8Array(4);

      for (const [xNorm, yNorm] of samples) {
        gl.readPixels(
          Math.floor(canvas.width * xNorm),
          Math.floor(canvas.height * yNorm),
          1,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixel,
        );
        if (pixel[0] + pixel[1] + pixel[2] > 36) {
          return true;
        }
      }

      return false;
    },
    { timeout: 90_000 },
  );

  await page.mouse.click(960, 540);

  if (movementRecipe.trim().length > 0) {
    const moves = movementRecipe
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [key, durationMs] = entry.split(":");
        const duration = Number(durationMs);
        const keys = key
          .split("+")
          .map((part) => part.trim())
          .filter(Boolean);
        return { keys, duration: Number.isFinite(duration) ? duration : 350 };
      });

    for (const move of moves) {
      if (move.keys.length === 0) {
        continue;
      }
      const keys = move.keys.map((key) => keyAliases.get(key) ?? key);
      for (const key of keys) {
        await page.keyboard.down(key);
      }
      await page.waitForTimeout(move.duration);
      for (const key of keys.slice().reverse()) {
        await page.keyboard.up(key);
      }
      await page.waitForTimeout(120);
    }
  }

  if (dragRecipe.trim().length > 0) {
    const [from, to] = dragRecipe.split(":");
    const [fromX, fromY] = from.split(",").map(Number);
    const [toX, toY] = to.split(",").map(Number);
    if ([fromX, fromY, toX, toY].every(Number.isFinite)) {
      await page.mouse.move(fromX, fromY);
      await page.mouse.down();
      await page.mouse.move(toX, toY, { steps: 18 });
      await page.mouse.up();
    }
  }

  if (Number.isFinite(wheelDelta) && wheelDelta !== 0) {
    await page.mouse.wheel(0, wheelDelta);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: outputPath, fullPage, timeout: 120_000 });

  await context.close();
  await browser.close();

  process.stdout.write(`Saved screenshot to ${outputPath}\n`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
