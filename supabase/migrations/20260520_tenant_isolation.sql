-- Phase 1A: Tenant isolation, branding/quota columns, RLS for self-service SaaS.
-- Idempotent: all statements use IF NOT EXISTS / IF EXISTS guards.

-- ---------------------------------------------------------------------------
-- 1. Extend tenants with branding + quota columns
-- ---------------------------------------------------------------------------
alter table demoforge.tenants
  add column if not exists logo_url text,
  add column if not exists brand_color text not null default '#6366f1',
  add column if not exists elevenlabs_voice_id text,
  add column if not exists plan text not null default 'free',
  add column if not exists videos_limit integer not null default 5,
  add column if not exists videos_used integer not null default 0;

do $plan_check$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tenants_plan_check'
      and conrelid = 'demoforge.tenants'::regclass
  ) then
    alter table demoforge.tenants
      add constraint tenants_plan_check check (plan in ('free', 'pro', 'enterprise'));
  end if;
end
$plan_check$;

-- ---------------------------------------------------------------------------
-- 2. Add tenant_id to tables that are still missing it
-- ---------------------------------------------------------------------------
alter table if exists demoforge.demo_modules
  add column if not exists tenant_id uuid references demoforge.tenants (id) on delete cascade;

alter table if exists demoforge.session_events
  add column if not exists tenant_id uuid references demoforge.tenants (id) on delete cascade;

alter table if exists demoforge.video_renders
  add column if not exists tenant_id uuid references demoforge.tenants (id) on delete cascade;

alter table if exists demoforge.video_variants
  add column if not exists tenant_id uuid references demoforge.tenants (id) on delete cascade;

-- Access token for token-gated public video player (Phase 4)
alter table if exists demoforge.video_renders
  add column if not exists access_token uuid default gen_random_uuid();

create index if not exists video_renders_access_token_idx
  on demoforge.video_renders (access_token);

-- ---------------------------------------------------------------------------
-- 3. Relax demo_tracks unique constraint for multi-tenant use
--    Old: unique(product, persona) → one track per product/persona globally
--    New: unique per (product, persona, tenant_id) with null treated as the
--         internal NEXUS tenant (tenant_id IS NULL = legacy shared tracks).
-- ---------------------------------------------------------------------------
do $drop_old_tracks_unique$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'demo_tracks_product_persona_key'
      and conrelid = 'demoforge.demo_tracks'::regclass
  ) then
    alter table demoforge.demo_tracks drop constraint demo_tracks_product_persona_key;
  end if;
end
$drop_old_tracks_unique$;

create unique index if not exists demo_tracks_product_persona_tenant_uidx
  on demoforge.demo_tracks (product, persona, tenant_id)
  where tenant_id is not null;

create unique index if not exists demo_tracks_product_persona_global_uidx
  on demoforge.demo_tracks (product, persona)
  where tenant_id is null;

-- ---------------------------------------------------------------------------
-- 4. Enable RLS on core tables (no-ops if already enabled)
-- ---------------------------------------------------------------------------
alter table demoforge.demo_tracks    enable row level security;
alter table demoforge.demo_modules   enable row level security;
alter table demoforge.prospects      enable row level security;
alter table demoforge.demo_sessions  enable row level security;
alter table demoforge.session_events enable row level security;
alter table demoforge.video_renders  enable row level security;
alter table demoforge.video_variants enable row level security;

-- ---------------------------------------------------------------------------
-- 5. Helper function: set of tenant_ids the current auth user belongs to
-- ---------------------------------------------------------------------------
create or replace function demoforge.current_user_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = demoforge, public
as $$
  select tenant_id
  from demoforge.tenant_memberships
  where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 6. Authenticated-user tenant-scoped policies
--    Tenants with tenant_id NULL remain readable only via service_role
--    (legacy internal NEXUS tracks / global defaults).
-- ---------------------------------------------------------------------------

-- demo_tracks
drop policy if exists "tenant_demo_tracks" on demoforge.demo_tracks;
create policy "tenant_demo_tracks" on demoforge.demo_tracks
  for all to authenticated
  using (tenant_id in (select demoforge.current_user_tenant_ids()))
  with check (tenant_id in (select demoforge.current_user_tenant_ids()));

drop policy if exists "service_role_demo_tracks_all" on demoforge.demo_tracks;
create policy "service_role_demo_tracks_all" on demoforge.demo_tracks
  for all to service_role using (true) with check (true);

-- demo_modules
drop policy if exists "tenant_demo_modules" on demoforge.demo_modules;
create policy "tenant_demo_modules" on demoforge.demo_modules
  for all to authenticated
  using (tenant_id in (select demoforge.current_user_tenant_ids()))
  with check (tenant_id in (select demoforge.current_user_tenant_ids()));

drop policy if exists "service_role_demo_modules_all" on demoforge.demo_modules;
create policy "service_role_demo_modules_all" on demoforge.demo_modules
  for all to service_role using (true) with check (true);

-- prospects
drop policy if exists "tenant_prospects" on demoforge.prospects;
create policy "tenant_prospects" on demoforge.prospects
  for all to authenticated
  using (tenant_id in (select demoforge.current_user_tenant_ids()))
  with check (tenant_id in (select demoforge.current_user_tenant_ids()));

drop policy if exists "service_role_prospects_all" on demoforge.prospects;
create policy "service_role_prospects_all" on demoforge.prospects
  for all to service_role using (true) with check (true);

-- demo_sessions
drop policy if exists "tenant_demo_sessions" on demoforge.demo_sessions;
create policy "tenant_demo_sessions" on demoforge.demo_sessions
  for all to authenticated
  using (tenant_id in (select demoforge.current_user_tenant_ids()))
  with check (tenant_id in (select demoforge.current_user_tenant_ids()));

drop policy if exists "service_role_demo_sessions_all" on demoforge.demo_sessions;
create policy "service_role_demo_sessions_all" on demoforge.demo_sessions
  for all to service_role using (true) with check (true);

-- session_events
drop policy if exists "tenant_session_events" on demoforge.session_events;
create policy "tenant_session_events" on demoforge.session_events
  for all to authenticated
  using (tenant_id in (select demoforge.current_user_tenant_ids()))
  with check (tenant_id in (select demoforge.current_user_tenant_ids()));

drop policy if exists "service_role_session_events_all" on demoforge.session_events;
create policy "service_role_session_events_all" on demoforge.session_events
  for all to service_role using (true) with check (true);

-- video_renders (tenant-scoped + public read for valid access_token)
drop policy if exists "tenant_video_renders" on demoforge.video_renders;
create policy "tenant_video_renders" on demoforge.video_renders
  for all to authenticated
  using (tenant_id in (select demoforge.current_user_tenant_ids()))
  with check (tenant_id in (select demoforge.current_user_tenant_ids()));

drop policy if exists "public_video_renders_access_token" on demoforge.video_renders;
create policy "public_video_renders_access_token" on demoforge.video_renders
  for select to anon
  using (access_token is not null);

-- video_variants
drop policy if exists "tenant_video_variants" on demoforge.video_variants;
create policy "tenant_video_variants" on demoforge.video_variants
  for all to authenticated
  using (tenant_id in (select demoforge.current_user_tenant_ids()))
  with check (tenant_id in (select demoforge.current_user_tenant_ids()));

drop policy if exists "service_role_video_variants_tenant_all" on demoforge.video_variants;
-- Note: service_role_video_variants_all already created in 20260425_video_platform.sql
