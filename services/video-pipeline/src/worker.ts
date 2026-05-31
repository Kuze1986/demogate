// @ts-nocheck
/**
 * DemoForge Video Pipeline Worker — ground-up rewrite
 * Fully self-contained: zero lib/ imports, zero @/ aliases.
 * Only npm packages + Node builtins.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { buildGeneratedScript } from "./script-generator.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const QUEUE_NAME    = "demoforge-video-jobs";
const SCHEMA        = "demoforge";
const MAX_RETRIES   = 3;
const MAX_RUNTIME_S = 15 * 60;

// ── Supabase ──────────────────────────────────────────────────────────────────

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: SCHEMA },
  });
}

async function logOp(op, status, sessionId, correlationId, message, payload) {
  try {
    await db().from("system_logs").insert({
      function_name: `video_${op}`,
      session_id:    sessionId ?? null,
      status,
      message:       message ?? null,
      payload:       { correlation_id: correlationId ?? null, ...(payload ?? {}) },
    });
  } catch { /* logging must never kill the job */ }
}

// ── Crucible behavioral profile ───────────────────────────────────────────────

const DEFAULT_BEHAVIOR = { delayMultiplier: 1, thinkingPauseMultiplier: 1, mousePathJitterPx: 30, hoverWobblePx: 2, mouseCurveSteps: 28 };

async function fetchBehaviorProfile(correlationId, product, persona) {
  const baseUrl = process.env.CRUCIBLE_SIM_BASE_URL;
  if (!baseUrl) return { profile: DEFAULT_BEHAVIOR, source: "default" };
  try {
    const res = await fetch(new URL(process.env.CRUCIBLE_SIM_PROFILE_PATH ?? "/api/behavior/profile", baseUrl), {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...(process.env.CRUCIBLE_SIM_API_KEY ? { Authorization: `Bearer ${process.env.CRUCIBLE_SIM_API_KEY}` } : {}) },
      body:    JSON.stringify({ correlationId, product, persona }),
      signal:  AbortSignal.timeout(2500),
    });
    if (!res.ok) return { profile: DEFAULT_BEHAVIOR, source: "default" };
    const { profile: p } = await res.json();
    if (!p) return { profile: DEFAULT_BEHAVIOR, source: "default" };
    return {
      profile: {
        delayMultiplier:         Math.max(0.5, Math.min(Number(p.delayMultiplier         ?? 1),  2.5)),
        thinkingPauseMultiplier: Math.max(0.5, Math.min(Number(p.thinkingPauseMultiplier ?? 1),  2.5)),
        mousePathJitterPx:       Math.max(5,   Math.min(Number(p.mousePathJitterPx       ?? 30), 120)),
        hoverWobblePx:           Math.max(0,   Math.min(Number(p.hoverWobblePx           ?? 2),  12)),
        mouseCurveSteps:         Math.max(10,  Math.min(Math.round(Number(p.mouseCurveSteps ?? 28)), 80)),
      },
      source: "crucible",
    };
  } catch { return { profile: DEFAULT_BEHAVIOR, source: "default" }; }
}

// ── Human-like mouse / timing helpers ────────────────────────────────────────

const jitter = (min, max) => min + Math.random() * (max - min);

async function humanDelay(baseMs, t) {
  await new Promise(r => setTimeout(r, Math.round(baseMs * (t?.delayMultiplier ?? 1) * (0.7 + Math.random() * 0.6))));
}
async function thinkingPause(t) {
  await new Promise(r => setTimeout(r, Math.round(jitter(350, 1200) * (t?.thinkingPauseMultiplier ?? 1))));
}
async function moveMouseBezier(page, from, to, t) {
  const cj = t?.mousePathJitterPx ?? 30;
  const steps = t?.mouseCurveSteps ?? 28;
  const cp1 = { x: from.x + (to.x - from.x) * 0.3 + jitter(-cj, cj), y: from.y + (to.y - from.y) * 0.2 + jitter(-cj, cj) };
  const cp2 = { x: from.x + (to.x - from.x) * 0.75 + jitter(-cj, cj), y: from.y + (to.y - from.y) * 0.8 + jitter(-cj, cj) };
  for (let i = 1; i <= steps; i++) {
    const s = i / steps;
    await page.mouse.move(
      Math.pow(1-s,3)*from.x + 3*Math.pow(1-s,2)*s*cp1.x + 3*(1-s)*s*s*cp2.x + s*s*s*to.x,
      Math.pow(1-s,3)*from.y + 3*Math.pow(1-s,2)*s*cp1.y + 3*(1-s)*s*s*cp2.y + s*s*s*to.y
    );
  }
}
async function hoverWobble(page, at, t) {
  const w = t?.hoverWobblePx ?? 2;
  await page.mouse.move(at.x + jitter(-w, w), at.y + jitter(-w, w));
  await page.mouse.move(at.x + jitter(-w/2, w/2), at.y + jitter(-w/2, w/2));
}

// ── Playwright capture ────────────────────────────────────────────────────────

async function runCapture(jobId, script) {
  const outDir   = join(process.cwd(), "tmp", "video-jobs", jobId);
  const videoDir = join(outDir, "video");
  mkdirSync(videoDir, { recursive: true });

  const behavior = await fetchBehaviorProfile(script.correlationId, script.product, script.persona);
  const appUrl   = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

  // Pre-warm base URL if it's a remote host
  if (script.baseUrl && script.baseUrl.startsWith("http")) {
    console.log(`[worker] pre-warming ${script.baseUrl}...`);
    await fetch(script.baseUrl, { signal: AbortSignal.timeout(15000) }).catch(() => {});
    console.log("[worker] pre-warm done");
  }

  const browser  = await chromium.launch({ headless: true });
  const context  = await browser.newContext({
    viewport:    script.deviceProfile === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
  });
  const page       = await context.newPage();
  const startedAt  = Date.now();
  const timestamps = [];

  try {
    for (const step of script.steps) {
      const t0 = (Date.now() - startedAt) / 1000;

      // Calculate wait time: use narration estimated seconds if available
      const narrationCue = script.narration?.find(c => c.stepId === step.id);
      const narrationWaitMs = narrationCue ? Math.round(narrationCue.estimatedSeconds * 1000) : 0;

      if (step.action === "navigate" && step.value) {
        const url = step.value.startsWith("http") ? step.value : `${appUrl}${step.value}`;
        await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
        // Hold on navigated page for the narration duration
        if (narrationWaitMs > 1500) {
          await humanDelay(Math.max(0, narrationWaitMs - 1500), behavior.profile);
        }
      } else if (step.action === "click" && step.selector) {
        const loc = page.locator(step.selector);
        await loc.scrollIntoViewIfNeeded();
        const box = await loc.boundingBox();
        if (box) {
          await moveMouseBezier(page, { x: box.x - 40, y: box.y - 20 }, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, behavior.profile);
          await hoverWobble(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, behavior.profile);
        }
        await thinkingPause(behavior.profile);
        await loc.click();
      } else if (step.action === "type" && step.selector) {
        await page.locator(step.selector).click();
        await page.locator(step.selector).pressSequentially(step.value ?? "", { delay: 60 });
      } else if (step.action === "keyboard" && step.key) {
        await page.keyboard.press(step.key);
      } else if (step.action === "clickText" && step.value) {
        await page.getByText(step.value, { exact: false }).click();
      } else if (step.action === "waitForURL" && step.value) {
        await page.waitForURL(url => !url.includes(step.value), { timeout: 15000 }).catch(() => {});
      } else {
        // For explicit wait steps, use the longer of waitMs or narration time
        const waitMs = Math.max(step.waitMs ?? 500, narrationWaitMs || 0);
        await humanDelay(waitMs, behavior.profile);
      }
      timestamps.push({ stepId: step.id, startSeconds: t0, endSeconds: (Date.now() - startedAt) / 1000 });
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const files    = readdirSync(videoDir);
  const webmFile = files.find(f => f.endsWith(".webm"));
  const rawVideoPath = join(outDir, "capture.webm");
  if (webmFile) copyFileSync(join(videoDir, webmFile), rawVideoPath);
  writeFileSync(join(outDir, "timeline.json"), JSON.stringify(timestamps, null, 2));

  const appUrlBase = appUrl || process.env.NEXT_PUBLIC_APP_URL || "";
  return {
    rawVideoPath,
    manifest: {
      correlationId: script.correlationId,
      scriptVersion: "v2",
      stepTimestamps: timestamps,
      hotspots: [{
        label:          "View live demo",
        startSeconds:   timestamps[0]?.startSeconds ?? 0,
        endSeconds:     Math.max(5, timestamps[0]?.endSeconds ?? 5),
        targetUrl:      `${appUrlBase}/intake`,
        contextPayload: { source: "video_hotspot", correlationId: script.correlationId, behavior_source: behavior.source },
      }],
    },
  };
}

// ── ElevenLabs TTS synthesis ──────────────────────────────────────────────────

function toneToVoiceSettings(tone) {
  switch (tone) {
    case "confident": return { stability: 0.55, similarity_boost: 0.8,  style: 0.2,  use_speaker_boost: true  };
    case "urgent":    return { stability: 0.35, similarity_boost: 0.85, style: 0.45, use_speaker_boost: true  };
    case "friendly":  return { stability: 0.65, similarity_boost: 0.75, style: 0.1,  use_speaker_boost: false };
    default:          return { stability: 0.7,  similarity_boost: 0.75, style: 0.0,  use_speaker_boost: false };
  }
}

async function synthesizeCue(text, voiceId, tone) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method:  "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", "Accept": "audio/mpeg" },
    body:    JSON.stringify({ text, model_id: "eleven_turbo_v2", voice_settings: toneToVoiceSettings(tone) }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${msg}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Generate and write narration MP3 for all narration cues.
 * Returns total estimated audio duration in seconds.
 */
async function synthesizeNarration(narrationCues, voiceId, narrationPath) {
  if (!narrationCues || narrationCues.length === 0) {
    writeFileSync(narrationPath, "");
    return 0;
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    console.warn("[worker] ELEVENLABS_API_KEY not set — skipping TTS, video will be silent");
    writeFileSync(narrationPath, "");
    return 0;
  }
  const resolvedVoiceId = voiceId ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID;
  if (!resolvedVoiceId) {
    console.warn("[worker] No voice ID configured — skipping TTS");
    writeFileSync(narrationPath, "");
    return 0;
  }

  console.log(`[worker] synthesizing narration: ${narrationCues.length} cues, voice=${resolvedVoiceId}`);

  const buffers = [];
  let totalEstimatedSeconds = 0;
  for (const cue of narrationCues) {
    if (!cue.text?.trim()) continue;
    try {
      const buf = await synthesizeCue(cue.text, resolvedVoiceId, cue.tone ?? "neutral");
      buffers.push(buf);
      totalEstimatedSeconds += cue.estimatedSeconds ?? 5;
    } catch (err) {
      console.error(`[worker] TTS failed for cue ${cue.stepId}:`, err.message);
    }
  }

  if (buffers.length === 0) {
    writeFileSync(narrationPath, "");
    return 0;
  }

  const combined = Buffer.concat(buffers);
  writeFileSync(narrationPath, combined);
  console.log(`[worker] narration written: ${combined.length} bytes, ~${totalEstimatedSeconds}s`);
  return totalEstimatedSeconds;
}

// ── FFmpeg post-process ───────────────────────────────────────────────────────

// Lower-third watermark burned into every rendered MP4.
// Appears bottom-right, white text with drop shadow for legibility on any background.
const WATERMARK_FILTER =
  "drawtext=text=Made with DemoForge | demoforge.bioloopnexus.com" +
  ":fontcolor=white@0.75" +
  ":fontsize=13" +
  ":x=w-tw-14" +
  ":y=h-th-14" +
  ":shadowcolor=black@0.55" +
  ":shadowx=1" +
  ":shadowy=1";

async function runFfmpeg(rawVideoPath, narrationPath, outputPath) {
  const hasAudio = existsSync(narrationPath) && statSync(narrationPath).size > 0;
  const args = hasAudio
    ? ["-i", rawVideoPath, "-i", narrationPath, "-vf", WATERMARK_FILTER, "-c:v", "libx264", "-preset", "medium", "-shortest", "-y", outputPath]
    : ["-i", rawVideoPath, "-vf", WATERMARK_FILTER, "-c:v", "libx264", "-preset", "medium", "-an", "-y", outputPath];

  await new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: "inherit" });
    proc.on("exit",  code  => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
    proc.on("error", reject);
  });
}

// ── Storage upload ────────────────────────────────────────────────────────────

async function uploadVideo(localPath, objectKey) {
  const bucket = process.env.DEMOFORGE_VIDEO_BUCKET ?? "demoforge-video";
  const { error } = await db().storage.from(bucket).upload(objectKey, readFileSync(localPath), { contentType: "video/mp4", upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const cdn  = process.env.DEMOFORGE_MEDIA_CDN_BASE_URL?.replace(/\/$/, "");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return { bucket, objectKey, cdnUrl: cdn ? `${cdn}/${bucket}/${objectKey}` : `${base}/storage/v1/object/public/${bucket}/${objectKey}` };
}

// ── Orchestrator notify ───────────────────────────────────────────────────────

async function notify(event, correlationId, videoJobId, payload) {
  const endpoint = process.env.ORCHESTRATOR_WEBHOOK_URL;
  if (!endpoint) return;
  await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, correlationId, videoJobId, payload }) }).catch(() => {});
}

// ── Post-render: send "video ready" email to prospect ────────────────────────

async function sendVideoReadyNotification(renderId, sessionId, tenantId, accessToken) {
  try {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    const videoUrl = `${appUrl}/watch/${renderId}?token=${accessToken}`;

    const supabase = db();
    const { data: session } = await supabase
      .from("demo_sessions")
      .select("prospect_id")
      .eq("id", sessionId)
      .maybeSingle();

    const { data: prospect } = session?.prospect_id
      ? await supabase
          .from("prospects")
          .select("first_name,last_name,email")
          .eq("id", session.prospect_id)
          .maybeSingle()
      : { data: null };

    const { data: tenant } = tenantId
      ? await supabase
          .from("tenants")
          .select("name,logo_url")
          .eq("id", tenantId)
          .maybeSingle()
      : { data: null };

    if (!prospect?.email) return;

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return;

    const firstName = prospect.first_name ?? "there";
    const tenantName = tenant?.name ?? "DemoForge";
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "demos@demoforge.app";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:sans-serif;background:#0f0f0f;color:#e5e7eb;padding:40px 20px;margin:0">
  <div style="max-width:520px;margin:0 auto">
    ${tenant?.logo_url ? `<img src="${tenant.logo_url}" alt="${tenantName}" height="36" style="margin-bottom:24px" />` : `<h2 style="color:#6366f1;margin:0 0 24px">${tenantName}</h2>`}
    <h1 style="color:#f9fafb;font-size:24px;margin:0 0 12px">Your personalized demo is ready</h1>
    <p style="color:#9ca3af;line-height:1.6;margin:0 0 32px">
      Hi ${firstName}, your AI-narrated product demo has been generated just for you. Click below to watch it.
    </p>
    <a href="${videoUrl}" style="display:inline-block;background:#6366f1;color:#fff;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px">
      Watch your demo &rarr;
    </a>
    <p style="color:#6b7280;font-size:12px;margin-top:40px">
      This link is unique to you. Powered by ${tenantName}.
    </p>
  </div>
</body>
</html>`.trim();

    await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body:    JSON.stringify({
        from:    fromEmail,
        to:      [prospect.email],
        subject: `Your ${tenantName} demo is ready to watch`,
        html,
      }),
    });
    console.log(`[worker] video-ready email sent to ${prospect.email}`);
  } catch (err) {
    console.error("[worker] video-ready email failed:", err.message);
  }
}

// ── Main job processor ────────────────────────────────────────────────────────

async function processJob(payload) {
  const supabase  = db();
  const { jobId, sessionId, variants = ["default"], deviceProfiles = ["desktop"] } = payload;
  const tenantId  = payload.tenantId ?? null;
  const startedAt = Date.now();

  console.log(`[worker] job started: ${jobId} session=${sessionId} tenant=${tenantId ?? "legacy"}`);
  await supabase.from("video_jobs").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", jobId);
  await notify("job_started", payload.correlationId ?? "", jobId, {});

  // 1. Build script (LLM-generated narration + template steps)
  const script = await buildGeneratedScript({ ...payload });
  const voiceId = script.voiceId ?? payload.voiceId;
  const tmpDir = join(process.cwd(), "tmp", "video-jobs", jobId);
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(join(tmpDir, "script.json"), JSON.stringify({ ...script, voiceId }, null, 2));
  console.log(`[worker] script ready: product=${script.product} prospect="${script.prospectName}" narration=${script.narration.length} cues`);

  // 2. Playwright screen capture (wait times adjusted to narration timing)
  console.log("[worker] playwright capture starting");
  const { rawVideoPath, manifest } = await runCapture(jobId, script);
  console.log(`[worker] capture done: ${rawVideoPath}`);

  // 3. TTS synthesis (ElevenLabs) — writes narration.mp3 or empty file
  const narrationPath = join(tmpDir, "narration.mp3");
  const outputPath    = join(tmpDir, "final.mp4");
  await synthesizeNarration(script.narration, voiceId, narrationPath);

  // 4. FFmpeg merge video + audio
  console.log("[worker] ffmpeg starting");
  await runFfmpeg(rawVideoPath, narrationPath, outputPath);
  console.log(`[worker] ffmpeg done: ${outputPath}`);

  // 5. Write render records and upload
  let firstRenderId = null;
  let firstAccessToken = null;

  for (const variantType of (variants.length ? variants : ["default"])) {
    for (const device of (deviceProfiles.length ? deviceProfiles : ["desktop"])) {
      const { data: variant } = await supabase.from("video_variants")
        .insert({
          video_job_id:  jobId,
          variant_type:  variantType,
          variant_label: `Auto ${variantType}/${device}`,
          locale:        payload.locale ?? "en",
          device_profile: device,
          tenant_id:     tenantId,
        })
        .select("id").single();

      const { data: render } = await supabase.from("video_renders")
        .insert({
          video_job_id:     jobId,
          variant_id:       variant?.id ?? null,
          status:           "completed",
          raw_video_path:   rawVideoPath,
          final_video_path: outputPath,
          manifest_json:    manifest,
          naturalness_score: 85.0,
          duration_seconds: Math.round((Date.now() - startedAt) / 1000),
          language:         payload.locale ?? "en",
          device_profile:   device,
          tenant_id:        tenantId,
        })
        .select("id, access_token").single();

      const renderId    = render?.id;
      const accessToken = render?.access_token;
      if (!firstRenderId && renderId) {
        firstRenderId    = renderId;
        firstAccessToken = accessToken;
      }

      if (renderId && process.env.DEMOFORGE_VIDEO_UPLOAD !== "false") {
        try {
          const objectKey = `renders/${jobId}/${renderId}.mp4`;
          const { bucket, objectKey: key, cdnUrl } = await uploadVideo(outputPath, objectKey);
          const retentionUntil = new Date(Date.now() + Math.max(1, Number(process.env.DEMOFORGE_MEDIA_RETENTION_DAYS ?? 30)) * 86400000).toISOString();
          await supabase.from("video_renders").update({ storage_bucket: bucket, storage_object_key: key, cdn_url: cdnUrl, retention_until: retentionUntil }).eq("id", renderId);
          console.log(`[worker] uploaded render ${renderId} → ${cdnUrl}`);
        } catch (uploadErr) {
          console.error("[worker] upload failed:", uploadErr.message);
          await logOp("video_storage_upload", "error", sessionId, payload.correlationId, uploadErr.message, {});
        }
      }

      for (const hotspot of manifest.hotspots) {
        await supabase.from("video_hotspots").insert({
          render_id:       renderId ?? null,
          start_seconds:   hotspot.startSeconds,
          end_seconds:     hotspot.endSeconds,
          label:           hotspot.label,
          target_url:      hotspot.targetUrl,
          context_payload: hotspot.contextPayload ?? null,
        });
      }
    }
  }

  // 6. Increment tenant video usage
  if (tenantId) {
    await supabase.rpc("increment_tenant_videos_used", { p_tenant_id: tenantId }).catch(async () => {
      const { data: t } = await supabase.from("tenants").select("videos_used").eq("id", tenantId).single();
      if (t) await supabase.from("tenants").update({ videos_used: (t.videos_used ?? 0) + 1 }).eq("id", tenantId);
    });
  }

  // 7. Send video-ready email to prospect
  if (firstRenderId && firstAccessToken) {
    await sendVideoReadyNotification(firstRenderId, sessionId, tenantId, firstAccessToken);
  }

  await supabase.from("video_jobs").update({ status: "succeeded", updated_at: new Date().toISOString() }).eq("id", jobId);
  await logOp("worker_complete", "success", sessionId, payload.correlationId, null, { video_job_id: jobId, output_path: outputPath });
  await notify("job_succeeded", payload.correlationId ?? "", jobId, { outputPath });
  console.log(`[worker] job complete: ${jobId} (${Math.round((Date.now() - startedAt) / 1000)}s)`);
}

// ── BullMQ Worker ─────────────────────────────────────────────────────────────

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error("Missing REDIS_URL");

const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const started = Date.now();
    try {
      await processJob(job.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[worker] job ${job.data.jobId} failed:`, message);
      const supabase = db();
      await supabase.from("video_jobs").update({
        status:        job.attemptsMade >= MAX_RETRIES ? "dead_letter" : "failed",
        retries:       job.attemptsMade,
        error_message: message,
        updated_at:    new Date().toISOString(),
      }).eq("id", job.data.jobId);
      await logOp("worker_complete", "error", job.data.sessionId, job.data.correlationId, message, {});
      await notify("job_failed", job.data.correlationId ?? "", job.data.jobId, { message });
      throw e;
    } finally {
      if ((Date.now() - started) / 1000 > MAX_RUNTIME_S) throw new Error("Job exceeded max runtime");
    }
  },
  {
    connection,
    concurrency: Number(process.env.VIDEO_WORKER_CONCURRENCY ?? "2"),
    // @ts-ignore
    enablePriorityQueue: true,
  }
);

worker.on("error",     (err)      => console.error("[worker] error:", err));
worker.on("failed",    (job, err) => console.error("[worker] failed:", job?.id, err?.message));
worker.on("active",    (job)      => console.log("[worker] active:", job.id));
worker.on("completed", (job)      => console.log("[worker] completed:", job.id));

// Crucible health check
if (process.env.CRUCIBLE_SIM_BASE_URL) {
  fetch(new URL("/api/health", process.env.CRUCIBLE_SIM_BASE_URL), { signal: AbortSignal.timeout(3000) })
    .then(r => console.log(r.ok ? "[startup] Crucible reachable — behavioral loop active" : "[startup] Crucible returned non-OK"))
    .catch(() => console.warn("[startup] Crucible unreachable — using default behavior"));
}

console.log("[video-pipeline] worker started (narration: ElevenLabs, scripts: LLM-generated)");
