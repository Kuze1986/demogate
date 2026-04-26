# DemoForge Video Pipeline

Dedicated worker service for automated video script execution, capture, post-production, and variant persistence.

## Responsibilities

- Consume jobs from `demoforge-video-jobs` (BullMQ + Redis).
- Build deterministic script payloads (`script_version`, `input_payload`, `generated_script_json`).
- Execute Playwright capture with human behavior middleware.
- Run FFmpeg post-processing.
- Persist `video_jobs`, `video_variants`, `video_renders`, `video_hotspots`.
- Emit orchestrator callbacks and `demoforge.system_logs`.

## Local dev

1. Ensure app env vars are available (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `REDIS_URL`).
2. Run Redis + worker:

```bash
docker compose -f docker-compose.video.yml up --build
```

## Failed render runbook

1. Check `video_jobs.status` / `error_message` and `retries`.
2. Inspect worker logs with correlation ID.
3. Verify Redis queue depth and stuck jobs.
4. Check FFmpeg executable availability in worker container.
5. Requeue by inserting a new `video_jobs` row or replaying queue payload.
