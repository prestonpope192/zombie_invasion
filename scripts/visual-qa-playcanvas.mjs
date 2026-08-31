import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const host = "127.0.0.1";
const baseUrl = process.env.PLAYCANVAS_SMOKE_URL || `http://${host}:5191/`;
const outputDir = process.env.VISUAL_QA_OUTPUT || "output/qa/visual-showcase";
const captureUrl = new URL(baseUrl);
captureUrl.searchParams.set("showcase", "1");
captureUrl.searchParams.set("preserveDrawingBuffer", "1");
captureUrl.searchParams.set("glb", "0");

const scenarios = [
  { id: "desktop", width: 1280, height: 800, deviceScaleFactor: 1 },
  { id: "mobile", width: 390, height: 760, deviceScaleFactor: 1 },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function captureScenario(browser, scenario) {
  const page = await browser.newPage({ viewport: scenario, deviceScaleFactor: scenario.deviceScaleFactor });
  const errors = [];
  page.on("pageerror", (error) => errors.push({ type: "pageerror", message: error.message }));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push({ type: "console", message: message.text() });
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "failed";
    // The audio loader intentionally aborts a missing/unsupported menu sample
    // before switching to the procedural fallback. Keep real request failures.
    if (errorText === "net::ERR_ABORTED") return;
    errors.push({ type: "requestfailed", message: `${request.url()} ${errorText}` });
  });

  await page.goto(captureUrl.toString(), { waitUntil: "networkidle", timeout: 20000 });
  await page.evaluate(() => localStorage.setItem("zi_onboarded", "1"));
  await page.reload({ waitUntil: "networkidle", timeout: 20000 });
  await page.locator('[data-flow-action="primary"]').click();
  await page.waitForFunction(() => (window.render_game_to_text?.() ?? "").includes("phase=running"), null, { timeout: 5000 });
  await page.waitForTimeout(250);
  // Pass the five-second grace card so the screenshot shows the actual lane,
  // staged silhouettes, and environmental dressing instead of a modal.
  await page.evaluate(() => window.advanceTime?.(6200));
  const renderText = await page.evaluate(() => window.render_game_to_text?.() ?? "");
  const screenshotPath = `${outputDir}/${scenario.id}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: false });
  const canvasState = await page.evaluate(() => {
    const canvas = document.querySelector(".pc-slice-canvas");
    return {
      cssWidth: canvas?.getBoundingClientRect().width ?? 0,
      cssHeight: canvas?.getBoundingClientRect().height ?? 0,
      width: canvas?.width ?? 0,
      height: canvas?.height ?? 0,
      dataUrlBytes: canvas?.toDataURL?.("image/png")?.length ?? 0,
    };
  });
  const textLines = new Map(renderText.split("\\n").map((line) => line.split("=", 2)));
  const rubric = {
    showcaseMode: textLines.get("showcaseMode") === "true",
    heroComposition: textLines.get("composition") === "hero-lane-locked",
    coolMoonWarmLantern: textLines.get("lightingProfile") === "cool-moon-warm-lantern",
    nonBlankCanvas: canvasState.dataUrlBytes > 1000,
    viewportMatches: Math.abs(canvasState.cssWidth - scenario.width) <= 1 && Math.abs(canvasState.cssHeight - scenario.height) <= 1,
    browserErrors: errors.length === 0,
  };
  assert(Object.values(rubric).every(Boolean), `${scenario.id} visual rubric failed: ${JSON.stringify(rubric)}`);
  await writeFile(`${outputDir}/${scenario.id}.json`, JSON.stringify({ scenario, url: captureUrl.toString(), canvasState, rubric, errors, renderText }, null, 2));
  await page.close();
  return { scenario, screenshot: screenshotPath, state: `${outputDir}/${scenario.id}.json`, rubric, errors, canvasState };
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
try {
  const results = [];
  for (const scenario of scenarios) {
    results.push(await captureScenario(browser, scenario));
  }
  await writeFile(`${outputDir}/report.json`, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, results }, null, 2));
  console.log(JSON.stringify({ outputDir, results }, null, 2));
} finally {
  await browser.close();
}
