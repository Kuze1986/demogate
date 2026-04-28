# DemoForge QA Audit Checklist

Use this checklist to close the remaining manual audit items with evidence.

## Environment

- App URL: `http://localhost:3999` (or deployed env)
- Required: seeded `demoforge` data and at least one session with video modules
- Record evidence: screenshot + browser console + network logs per item

## Video Cross-Browser Matrix

- Chrome latest (desktop)
- Firefox latest (desktop)
- Edge latest (desktop)
- Safari latest (macOS)
- Safari latest (iOS)
- Chrome latest (Android)

For each browser/device verify:

- video can play
- controls work (play, pause, volume, fullscreen)
- autoplay fallback message appears when autoplay is blocked
- loading indicator appears while buffering/initial load
- error UI appears when source is invalid

## Playback Analytics

Open DevTools Network and verify `POST /api/track-event` includes:

- `video_view_start`
- `video_watch_50`
- `module_complete` (or `demo_complete`)
- `cta_click` where applicable

Confirm payload metadata includes attribution when UTM exists:

- `metadata.attribution.utm_source`
- `metadata.attribution.utm_medium`
- `metadata.attribution.utm_campaign`

## Content QA

- Review full demo video end-to-end
- Confirm no dead air or rendering glitches
- Confirm Kuze narration clarity and consistent loudness
- Confirm screens are current product UI
- If captions are configured (`captions_url`/`captionsUrl`), verify they render correctly

## Flow QA

- Intake to session route works for qualified path
- Each module can complete/skip correctly
- Replay works without forcing module advancement
- End CTA actions function:
  - `Upgrade for full rollout` -> `/billing`
  - `Continue with Kuze` -> `/demo/[sessionId]/live`
  - `Copy share link` copies tokenized session URL

## Performance & Integrity

- Initial visit target: under 4s on representative network/device
- No broken links in demo flow and completion actions
- No missing assets (video, images, scripts)
