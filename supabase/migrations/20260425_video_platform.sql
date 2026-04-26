create schema if not exists demoforge;

create table if not exists demoforge.feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag_key text unique not null,
  enabled boolean not null default false,
  description text,
  updated_at timestamptz not null default now()
);

insert into demoforge.feature_flags (flag_key, enabled, description)
values
  ('video_pipeline_enabled', false, 'Enable video generation queue'),
  ('video_ab_enabled', false, 'Enable A/B video variants'),
  ('video_hotspots_enabled', false, 'Enable interactive hotspots in video player'),
  ('video_localization_enabled', false, 'Enable localization flows for video assets')
on conflict (flag_key) do nothing;

alter table if exists demoforge.personas
  add column if not exists opening_line text,
  add column if not exists localization_presets jsonb,
  add column if not exists device_presets jsonb,
  add column if not exists active boolean default true;

create table if not exists demoforge.video_jobs (
  id uuid primary key default gen_random_uuid(),
  parent_session_id uuid not null references demoforge.demo_sessions(id) on delete cascade,
  prospect_id uuid references demoforge.prospects(id) on delete set null,
  triggered_by text not null check (triggered_by in ('intake', 'manual', 'post_live')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'dead_letter')),
  priority int not null default 100,
  target_variants jsonb not null default '[]'::jsonb,
  retries int not null default 0,
  max_retries int not null default 3,
  max_runtime_seconds int not null default 900,
  correlation_id text not null,
  orchestrator_ref text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_jobs_parent_session_idx on demoforge.video_jobs(parent_session_id);
create index if not exists video_jobs_status_idx on demoforge.video_jobs(status);
create index if not exists video_jobs_created_at_idx on demoforge.video_jobs(created_at desc);

create table if not exists demoforge.video_variants (
  id uuid primary key default gen_random_uuid(),
  video_job_id uuid not null references demoforge.video_jobs(id) on delete cascade,
  variant_type text not null,
  variant_label text,
  performance_score numeric(6,2),
  locale text,
  device_profile text,
  created_at timestamptz not null default now()
);

create table if not exists demoforge.video_renders (
  id uuid primary key default gen_random_uuid(),
  video_job_id uuid not null references demoforge.video_jobs(id) on delete cascade,
  variant_id uuid references demoforge.video_variants(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'rendering', 'completed', 'failed')),
  raw_video_path text,
  final_video_path text,
  manifest_json jsonb,
  naturalness_score numeric(6,2),
  duration_seconds int,
  language text,
  device_profile text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists demoforge.video_hotspots (
  id uuid primary key default gen_random_uuid(),
  render_id uuid not null references demoforge.video_renders(id) on delete cascade,
  start_seconds numeric(9,3) not null,
  end_seconds numeric(9,3) not null,
  label text not null,
  target_url text not null,
  context_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists demoforge.video_events (
  id uuid primary key default gen_random_uuid(),
  render_id uuid references demoforge.video_renders(id) on delete cascade,
  session_id uuid references demoforge.demo_sessions(id) on delete set null,
  event_type text not null,
  event_at timestamptz not null default now(),
  playback_seconds numeric(9,3),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists demoforge.behavior_scores (
  id uuid primary key default gen_random_uuid(),
  render_id uuid not null references demoforge.video_renders(id) on delete cascade,
  naturalness_score numeric(6,2) not null,
  engagement_score numeric(6,2),
  scoring_breakdown jsonb,
  created_at timestamptz not null default now()
);

create index if not exists video_renders_status_idx on demoforge.video_renders(status);
create index if not exists video_renders_created_at_idx on demoforge.video_renders(created_at desc);

alter table demoforge.video_jobs enable row level security;
alter table demoforge.video_renders enable row level security;
alter table demoforge.video_variants enable row level security;
alter table demoforge.video_hotspots enable row level security;
alter table demoforge.video_events enable row level security;
alter table demoforge.behavior_scores enable row level security;
alter table demoforge.feature_flags enable row level security;

drop policy if exists "service_role_video_jobs_all" on demoforge.video_jobs;
create policy "service_role_video_jobs_all" on demoforge.video_jobs
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_video_renders_all" on demoforge.video_renders;
create policy "service_role_video_renders_all" on demoforge.video_renders
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_video_variants_all" on demoforge.video_variants;
create policy "service_role_video_variants_all" on demoforge.video_variants
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_video_hotspots_all" on demoforge.video_hotspots;
create policy "service_role_video_hotspots_all" on demoforge.video_hotspots
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_video_events_all" on demoforge.video_events;
create policy "service_role_video_events_all" on demoforge.video_events
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_behavior_scores_all" on demoforge.behavior_scores;
create policy "service_role_behavior_scores_all" on demoforge.behavior_scores
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_feature_flags_all" on demoforge.feature_flags;
create policy "service_role_feature_flags_all" on demoforge.feature_flags
  for all to service_role using (true) with check (true);
