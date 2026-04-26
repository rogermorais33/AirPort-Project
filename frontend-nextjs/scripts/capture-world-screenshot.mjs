import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.WORLD_BASE_URL ?? "http://127.0.0.1:3000";
const outputPath = process.env.WORLD_SCREENSHOT_PATH ?? "test-results/world/world-redesign.png";
const movementRecipe = process.env.WORLD_CAPTURE_MOVE ?? "";
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
    args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
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

  if (movementRecipe.trim().length > 0) {
    const moves = movementRecipe
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [key, durationMs] = entry.split(":");
        const duration = Number(durationMs);
        return { key, duration: Number.isFinite(duration) ? duration : 350 };
      });

    for (const move of moves) {
      if (!move.key) {
        continue;
      }
      const key = keyAliases.get(move.key) ?? move.key;
      await page.keyboard.down(key);
      await page.waitForTimeout(move.duration);
      await page.keyboard.up(key);
      await page.waitForTimeout(120);
    }
  }

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
