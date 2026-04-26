-- Idempotent objects for control-plane / journey templates / integrations.
-- Apply if you ran role-only fixes but never completed `20260426_billing_and_platform.sql`.

create schema if not exists demoforge;

create table if not exists demoforge.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  is_dedicated boolean not null default false,
  created_at timestamptz not null default now()
);

alter table if exists demoforge.demo_tracks
  add column if not exists entry_node_id uuid;

create table if not exists demoforge.journey_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references demoforge.tenants (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists demoforge.journey_nodes (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references demoforge.demo_tracks (id) on delete cascade,
  module_id uuid references demoforge.demo_modules (id) on delete set null,
  label text,
  node_type text not null default 'module',
  position_x numeric(10,2) default 0,
  position_y numeric(10,2) default 0,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists demoforge.journey_edges (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references demoforge.demo_tracks (id) on delete cascade,
  from_node_id uuid not null references demoforge.journey_nodes (id) on delete cascade,
  to_node_id uuid not null references demoforge.journey_nodes (id) on delete cascade,
  condition jsonb,
  priority int not null default 100,
  created_at timestamptz not null default now()
);

create index if not exists journey_nodes_track_idx on demoforge.journey_nodes (track_id);
create index if not exists journey_edges_track_idx on demoforge.journey_edges (track_id);

alter table demoforge.journey_templates enable row level security;
alter table demoforge.journey_nodes enable row level security;
alter table demoforge.journey_edges enable row level security;

drop policy if exists "service_role_journey_templates_all" on demoforge.journey_templates;
create policy "service_role_journey_templates_all" on demoforge.journey_templates
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_journey_nodes_all" on demoforge.journey_nodes;
create policy "service_role_journey_nodes_all" on demoforge.journey_nodes
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_journey_edges_all" on demoforge.journey_edges;
create policy "service_role_journey_edges_all" on demoforge.journey_edges
  for all to service_role using (true) with check (true);

create table if not exists demoforge.integration_endpoints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references demoforge.tenants (id) on delete cascade,
  name text not null,
  url text not null,
  secret text,
  event_filter text[] default array[]::text[],
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists demoforge.integration_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid references demoforge.integration_endpoints (id) on delete set null,
  event_type text not null,
  idempotency_key text,
  status text not null,
  attempt int not null default 0,
  response_code int,
  error_message text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists integration_deliveries_idem_idx
  on demoforge.integration_deliveries (idempotency_key)
  where idempotency_key is not null;

alter table demoforge.integration_endpoints enable row level security;
alter table demoforge.integration_deliveries enable row level security;

drop policy if exists "service_role_integration_endpoints_all" on demoforge.integration_endpoints;
create policy "service_role_integration_endpoints_all" on demoforge.integration_endpoints
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_integration_deliveries_all" on demoforge.integration_deliveries;
create policy "service_role_integration_deliveries_all" on demoforge.integration_deliveries
  for all to service_role using (true) with check (true);

alter table if exists demoforge.video_renders
  add column if not exists storage_bucket text,
  add column if not exists storage_object_key text,
  add column if not exists cdn_url text,
  add column if not exists retention_until timestamptz;

create table if not exists demoforge.variant_optimization_runs (
  id uuid primary key default gen_random_uuid(),
  product text not null,
  persona text,
  segment text,
  chosen_variants jsonb not null,
  rationale jsonb,
  created_at timestamptz not null default now()
);

alter table demoforge.variant_optimization_runs enable row level security;

drop policy if exists "service_role_variant_optimization_runs_all" on demoforge.variant_optimization_runs;
create policy "service_role_variant_optimization_runs_all" on demoforge.variant_optimization_runs
  for all to service_role using (true) with check (true);
