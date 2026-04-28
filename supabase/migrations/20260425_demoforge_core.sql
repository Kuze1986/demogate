-- DemoForge 2.0 core schema for existing Supabase project
-- Creates demoforge schema/tables/types without touching existing schemas.

create schema if not exists demoforge;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'demoforge' and t.typname = 'product_key'
  ) then
    create type demoforge.product_key as enum (
      'keystone', 'meridian', 'scripta', 'rxblitz', 'bioloop'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'demoforge' and t.typname = 'module_type'
  ) then
    create type demoforge.module_type as enum (
      'video', 'slide', 'interactive', 'iframe', 'narration_card'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'demoforge' and t.typname = 'session_status'
  ) then
    create type demoforge.session_status as enum (
      'started', 'in_progress', 'completed', 'dropped', 'deflected'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'demoforge' and t.typname = 'event_type'
  ) then
    create type demoforge.event_type as enum (
      'module_start', 'module_complete', 'module_skip', 'module_replay',
      'kuze_live_start', 'kuze_message_sent', 'cta_click',
      'demo_complete', 'demo_drop'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'demoforge' and t.typname = 'prospect_persona'
  ) then
    create type demoforge.prospect_persona as enum (
      'workforce_admin', 'pharmacy_director', 'training_coordinator',
      'individual_learner', 'executive', 'it_evaluator', 'unknown'
    );
  end if;
end
$$;

create table if not exists demoforge.demo_tracks (
  id uuid primary key default gen_random_uuid(),
  product demoforge.product_key not null,
  persona demoforge.prospect_persona not null,
  name text not null,
  description text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(product, persona)
);

create table if not exists demoforge.demo_modules (
  id uuid primary key default gen_random_uuid(),
  track_id uuid references demoforge.demo_tracks(id) on delete cascade,
  sequence_order integer not null,
  title text not null,
  module_type demoforge.module_type not null,
  content_url text,
  narration_script text,
  interaction_config jsonb,
  duration_seconds integer,
  is_skippable boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists demoforge.prospects (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  email text not null,
  organization text,
  role text,
  persona demoforge.prospect_persona default 'unknown',
  pain_points text[],
  product_interest demoforge.product_key[],
  intake_raw jsonb,
  routing_reason text,
  is_qualified boolean default true,
  deflection_reason text,
  created_at timestamptz default now()
);

create table if not exists demoforge.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references demoforge.prospects(id),
  track_id uuid references demoforge.demo_tracks(id),
  status demoforge.session_status default 'started',
  current_module_id uuid references demoforge.demo_modules(id),
  modules_completed integer default 0,
  modules_total integer default 0,
  live_mode_activated boolean default false,
  engagement_score numeric(5,2),
  score_breakdown jsonb,
  started_at timestamptz default now(),
  completed_at timestamptz,
  drop_module_id uuid references demoforge.demo_modules(id),
  follow_up_sent boolean default false,
  follow_up_sent_at timestamptz,
  token text unique default encode(gen_random_bytes(24), 'hex')
);

create table if not exists demoforge.session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references demoforge.demo_sessions(id) on delete cascade,
  module_id uuid references demoforge.demo_modules(id),
  event_type demoforge.event_type not null,
  metadata jsonb,
  occurred_at timestamptz default now()
);

create table if not exists demoforge.kuze_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references demoforge.demo_sessions(id) on delete cascade,
  transcript jsonb default '[]'::jsonb,
  message_count integer default 0,
  started_at timestamptz default now(),
  ended_at timestamptz
);

create table if not exists demoforge.follow_ups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references demoforge.demo_sessions(id),
  prospect_id uuid references demoforge.prospects(id),
  subject text,
  body_html text,
  resend_message_id text,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  error text
);

create table if not exists demoforge.system_logs (
  id uuid primary key default gen_random_uuid(),
  function_name text not null,
  session_id uuid,
  status text not null,
  message text,
  payload jsonb,
  occurred_at timestamptz default now()
);

create index if not exists idx_sessions_prospect on demoforge.demo_sessions(prospect_id);
create index if not exists idx_sessions_track on demoforge.demo_sessions(track_id);
create index if not exists idx_sessions_token on demoforge.demo_sessions(token);
create index if not exists idx_events_session on demoforge.session_events(session_id);
create index if not exists idx_events_type on demoforge.session_events(event_type);
create index if not exists idx_modules_track on demoforge.demo_modules(track_id, sequence_order);

create or replace function demoforge.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_tracks_updated'
  ) then
    create trigger trg_tracks_updated
    before update on demoforge.demo_tracks
    for each row execute function demoforge.update_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_modules_updated'
  ) then
    create trigger trg_modules_updated
    before update on demoforge.demo_modules
    for each row execute function demoforge.update_updated_at();
  end if;
end
$$;

insert into demoforge.demo_tracks (product, persona, name, description) values
  ('keystone', 'workforce_admin', 'Keystone — Workforce Admin Track', 'For workforce development directors and program managers'),
  ('meridian', 'pharmacy_director', 'Meridian — Pharmacy Director Track', 'For pharmacy education directors and clinical training leads'),
  ('scripta', 'training_coordinator', 'Scripta — Training Coordinator Track', 'For LMS evaluators and learning and development coordinators'),
  ('rxblitz', 'individual_learner', 'RxBlitz — Certification Prep Track', 'For individuals preparing for pharmacy tech certification'),
  ('bioloop', 'executive', 'BioLoop — Executive Pitch Track', 'For C-suite and VP evaluators focused on behavioral intelligence')
on conflict (product, persona) do nothing;
