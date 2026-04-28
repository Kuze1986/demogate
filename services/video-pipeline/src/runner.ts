import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { fetchCrucibleBehaviorProfile } from "../../../lib/crucible/client";
import type { GeneratedScript, RenderManifest } from "../../../lib/video/contracts";
import { hoverWobble, humanDelay, moveMouseBezier, thinkingPause } from "./humanBehavior";

export async function runCapture(script: GeneratedScript): Promise<{
  rawVideoPath: string;
  manifest: RenderManifest;
}> {
  const outDir = join(process.cwd(), "tmp", "video-jobs", script.correlationId);
  mkdirSync(outDir, { recursive: true });
  const videoDir = join(outDir, "video");
  mkdirSync(videoDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  const startedAt = Date.now();
  try {
    const behavior = await fetchCrucibleBehaviorProfile({
      correlationId: script.correlationId,
      product: script.product,
      persona: script.persona,
      sessionId: undefined,
    });
    context = await browser.newContext({
      viewport: script.deviceProfile === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
    });
    page = await context.newPage();
    const timestamps: RenderManifest["stepTimestamps"] = [];

    for (const step of script.steps) {
      const stepStart = (Date.now() - startedAt) / 1000;
      if (step.action === "navigate" && step.value) {
        await page.goto(step.value.startsWith("http") ? step.value : `${process.env.NEXT_PUBLIC_APP_URL}${step.value}`, {
          waitUntil: "domcontentloaded",
        });
      } else if (step.action === "click" && step.selector) {
        const loc = page.locator(step.selector);
        await loc.scrollIntoViewIfNeeded();
        const box = await loc.boundingBox();
        if (box) {
          await moveMouseBezier(
            page,
            { x: box.x - 40, y: box.y - 20 },
            { x: box.x + box.width / 2, y: box.y + box.height / 2 },
            behavior.profile
          );
          await hoverWobble(
            page,
            { x: box.x + box.width / 2, y: box.y + box.height / 2 },
            behavior.profile
          );
        }
        await thinkingPause(behavior.profile);
        await loc.click();
      } else if (step.action === "type" && step.selector) {
        await page.fill(step.selector, step.value ?? "");
      } else {
        await humanDelay(step.waitMs ?? 500, behavior.profile);
      }
      const stepEnd = (Date.now() - startedAt) / 1000;
      timestamps.push({ stepId: step.id, startSeconds: stepStart, endSeconds: stepEnd });
    }

    const recordedVideo = page.video();
    await context.close();
    const rawVideoPath = join(videoDir, "capture.mp4");
    if (recordedVideo) {
      const recordedPath = await recordedVideo.path();
      copyFileSync(recordedPath, rawVideoPath);
    }
    writeFileSync(join(outDir, "timeline.json"), JSON.stringify(timestamps, null, 2));
    const manifest: RenderManifest = {
      correlationId: script.correlationId,
      scriptVersion: script.scriptVersion,
      stepTimestamps: timestamps,
      hotspots: [
        {
          label: "Jump to live Kuze",
          startSeconds: Math.max(0, timestamps[0]?.startSeconds ?? 0),
          endSeconds: Math.max(5, timestamps[0]?.endSeconds ?? 5),
          targetUrl: `${process.env.NEXT_PUBLIC_APP_URL}/demo`,
          contextPayload: {
            source: "video_hotspot",
            correlationId: script.correlationId,
            behavior_source: behavior.source,
          },
        },
      ],
    };
    return { rawVideoPath, manifest };
  } finally {
    if (page && !page.isClosed()) {
      await page.close();
    }
    if (context) {
      await context.close().catch(() => undefined);
    }
    await browser.close();
  }
}
