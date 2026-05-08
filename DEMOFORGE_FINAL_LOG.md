# DemoForge — final completion log

Format: `[CATEGORY] Description` → **STATUS** → notes / file.

---

## PART A — Ilita observer

`[ILITA]` Added `observe()` targeting `ilita.app_observations` with service credentials (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_KEY`, with `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` fallbacks). Swallows all errors.  
**STATUS:** BUILT  
**FILE:** `lib/ilita.ts`

`[ILITA]` Wired `demo_requested` after qualified intake session is created (product, email, org, ids).  
**STATUS:** BUILT  
**FILE:** `app/api/route-prospect/route.ts`

`[ILITA]` Wired `demo_completed` when `demo_complete` is processed (product, `session_id`, `duration_seconds` from `started_at` / `completed_at`).  
**STATUS:** BUILT  
**FILE:** `app/api/track-event/route.ts`

`[ILITA]` Wired `followup_sent` after Resend send succeeds and DB rows update.  
**STATUS:** BUILT  
**FILE:** `lib/session-followup.ts`

`[ILITA]` Wired `lead_written_to_axis` only after successful `axis.leads` + `axis.lead_touches` writes.  
**STATUS:** BUILT  
**FILE:** `lib/axis-lead.ts`

---

## PART B — Axis lead handoff

`[AXIS]` New `writeLeadToAxisForSession(sessionId)` — loads prospect + track from `demoforge`, inserts into `axis.leads` then `axis.lead_touches` using the same Supabase URL + service key (no HTTP to `AXIS_URL`; `AXIS_URL` is a **feature flag**: unset = skip). On duplicate email, falls back to latest `axis.leads` row by email for touch insert. Failures go to `demoforge.system_logs` via `logSystemEvent`, never thrown to the client.  
**STATUS:** BUILT  
**FILE:** `lib/axis-lead.ts`, `app/api/track-event/route.ts` (called inside `after()` on `demo_complete`, before follow-up email)

`[AXIS]` `AXIS_URL` documented in `.env.example` for Railway / local parity.  
**STATUS:** BUILT  
**FILE:** `.env.example`

**Axis schema reality:** Table/column names must match nexus-core (`axis.leads`, `axis.lead_touches`). If migrations differ, inserts will error and log — **CONFIRMED** only after SQL matches production.

---

## PART C — Resend live delivery

`[EMAIL]` Full UI submit + inbox check + Resend dashboard review against deployed Railway.  
**STATUS:** CANNOT CONFIRM (no access to your Railway deployment, mailbox, or Resend dashboard from this agent run)

---

## PART D — RLS verification

`[DB]` `pg_tables` / `pg_policies` / live `prospects` sample queries on nexus-core.  
**STATUS:** CANNOT CONFIRM (Supabase SQL editor not executed from this workspace)

---

## PART E — Kuze / Anthropic

`[KUZE]` In-process `/api/kuze-chat` + Anthropic; Crucible forward uses `kuze_mode` `**operator`** (prior audit fix).  
**STATUS:** CONFIRMED (code review)  
**FILE:** `app/api/kuze-chat/route.ts`

`[KUZE]` `ANTHROPIC_API_KEY` present on Railway for DemoForge service.  
**STATUS:** CANNOT CONFIRM (environment not visible here)

---

## PART F — Env documentation

`[ENV]` `.env.example` aligned with stack (Supabase, Anthropic, Resend, app URL, optional Axis flag, Crucible, admin email).  
**STATUS:** BUILT  
**FILE:** `.env.example`

---

## DEMOFORGE FINAL SUMMARY


| Item                           | Status                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Ilita observer                 | **BUILT** (4 events wired: `demo_requested`, `demo_completed`, `followup_sent`, `lead_written_to_axis`) |
| Axis lead handoff              | **BUILT** — **NOT CONFIRMED** against live `axis` schema until DB matches                               |
| Resend live delivery           | **CANNOT CONFIRM** (run full flow on Railway + check inbox / resend.com/emails)                         |
| From email domain verified     | **CANNOT CONFIRM**                                                                                      |
| RLS on `demoforge` schema      | **CANNOT CONFIRM** (run Part D SQL in Supabase)                                                         |
| Kuze mode = operator           | **CONFIRMED** (code)                                                                                    |
| Anthropic key in Railway       | **CANNOT CONFIRM**                                                                                      |
| Prospect records landing in DB | **CANNOT CONFIRM** (requires live Supabase)                                                             |


**Status:** **NEEDS FIXES** only if live checks fail (Resend domain, RLS gaps, or `axis` table mismatch). Code path is ready for verification on your environment.

---

## DEMOFORGE FINAL SUMMARY (template)

Ilita observer: **BUILT** (4 events wired)  
Axis lead handoff: **BUILT** / **NOT CONFIRMED** (needs live `axis` schema + `AXIS_URL` set)  
Resend live delivery: **CANNOT CONFIRM** (no deployed run from this session)  
From email domain verified: **CANNOT CONFIRM**  
RLS on demoforge schema: **CANNOT CONFIRM** (run Part D SQL in Supabase)  
Kuze mode = operator: **CONFIRMED** (code)  
Anthropic key in Railway: **CANNOT CONFIRM**  
Prospect records landing in DB: **CANNOT CONFIRM**  

**Status:** **NEEDS FIXES** — pending only your live verification (Resend, RLS, Axis DDL, Ilita table). Code + env template are in place.

### Your next steps (manual)

1. Set `AXIS_URL` (e.g. `1`) on Railway when `axis.leads` / `lead_touches` exist and service role has insert rights.
2. Complete Part C checklist on production; fix Resend env/domain if send fails.
3. Run Part D SQL in Supabase; fix any tables missing RLS if found.
4. Query `ilita.app_observations` after a test demo to confirm Ilita rows.

