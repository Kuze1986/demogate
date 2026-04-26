-- Billing, tenancy/RBAC/journey skeleton, integration catalog, video delivery metadata, optimizer state.
-- Schema: demoforge

create schema if not exists demoforge;

-- ---------------------------------------------------------------------------
-- Billing (Stripe sync)
-- ---------------------------------------------------------------------------
create table if not exists demoforge.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  stripe_customer_id text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists billing_customers_email_lower_idx
  on demoforge.billing_customers (lower(email));

create table if not exists demoforge.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  billing_customer_id uuid not null references demoforge.billing_customers (id) on delete cascade,
  stripe_subscription_id text unique not null,
  status text not null,
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists demoforge.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  billing_customer_id uuid not null references demoforge.billing_customers (id) on delete cascade,
  stripe_invoice_id text unique,
  stripe_payment_intent_id text,
  amount_paid integer,
  currency text,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists demoforge.billing_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text unique not null,
  type text not null,
  payload jsonb,
  processed_at timestamptz not null default now()
);

alter table demoforge.billing_customers enable row level security;
alter table demoforge.billing_subscriptions enable row level security;
alter table demoforge.billing_invoices enable row level security;
alter table demoforge.billing_events enable row level security;

drop policy if exists "service_role_billing_customers_all" on demoforge.billing_customers;
create policy "service_role_billing_customers_all" on demoforge.billing_customers
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_billing_subscriptions_all" on demoforge.billing_subscriptions;
create policy "service_role_billing_subscriptions_all" on demoforge.billing_subscriptions
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_billing_invoices_all" on demoforge.billing_invoices;
create policy "service_role_billing_invoices_all" on demoforge.billing_invoices
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_billing_events_all" on demoforge.billing_events;
create policy "service_role_billing_events_all" on demoforge.billing_events
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Hybrid tenancy + RBAC (minimal)
-- ---------------------------------------------------------------------------
create table if not exists demoforge.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  is_dedicated boolean not null default false,
  created_at timestamptz not null default now()
);

-- RBAC roles. Some projects already had demoforge.roles with a different shape; IF NOT EXISTS
-- would skip CREATE, so we always align columns + constraints before seeding.
create table if not exists demoforge.roles (
  id uuid primary key default gen_random_uuid(),
  key text,
  label text,
  created_at timestamptz not null default now()
);

alter table demoforge.roles add column if not exists key text;
alter table demoforge.roles add column if not exists label text;
alter table demoforge.roles add column if not exists created_at timestamptz;
update demoforge.roles set created_at = coalesce(created_at, now());

do $rbac_roles_align$
begin
  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'demoforge'
      and c.table_name = 'roles'
      and c.column_name = 'name'
  ) then
    update demoforge.roles r
       set key = lower(regexp_replace(trim(both from r.name::text), '\s+', '_', 'g')),
           label = trim(both from r.name::text)
     where r.key is null
       and r.name is not null;
  end if;
end
$rbac_roles_align$;

do $rbac_roles_synthetic$
begin
  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'demoforge'
      and c.table_name = 'roles'
      and c.column_name = 'name'
  ) then
    update demoforge.roles r
       set key = 'role_' || replace(r.id::text, '-', ''),
           label = coalesce(r.label, 'Role'),
           name = coalesce(r.name, r.label, 'Role')
     where r.key is null;
  else
    update demoforge.roles r
       set key = 'role_' || replace(r.id::text, '-', ''),
           label = coalesce(r.label, 'Role')
     where r.key is null;
  end if;
end
$rbac_roles_synthetic$;

do $rbac_roles_sync_name$
begin
  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'demoforge'
      and c.table_name = 'roles'
      and c.column_name = 'name'
  ) then
    update demoforge.roles r
       set name = coalesce(r.name, r.label, initcap(replace(r.key, '_', ' ')))
     where r.name is null;
  end if;
end
$rbac_roles_sync_name$;

create unique index if not exists demoforge_roles_key_uidx on demoforge.roles (key);

alter table demoforge.roles alter column key set not null;
alter table demoforge.roles alter column label set not null;

do $rbac_roles_seed$
begin
  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'demoforge'
      and c.table_name = 'roles'
      and c.column_name = 'name'
  ) then
    insert into demoforge.roles (key, label, name)
    values
      ('owner', 'Owner', 'Owner'),
      ('admin', 'Admin', 'Admin'),
      ('operator', 'Operator', 'Operator'),
      ('analyst', 'Analyst', 'Analyst')
    on conflict (key) do nothing;
  else
    insert into demoforge.roles (key, label)
    values
      ('owner', 'Owner'),
      ('admin', 'Admin'),
      ('operator', 'Operator'),
      ('analyst', 'Analyst')
    on conflict (key) do nothing;
  end if;
end
$rbac_roles_seed$;

create table if not exists demoforge.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references demoforge.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null references demoforge.roles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists demoforge.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references demoforge.tenants (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table if exists demoforge.prospects
  add column if not exists tenant_id uuid references demoforge.tenants (id) on delete set null;

alter table if exists demoforge.demo_sessions
  add column if not exists tenant_id uuid references demoforge.tenants (id) on delete set null;

alter table if exists demoforge.demo_tracks
  add column if not exists tenant_id uuid references demoforge.tenants (id) on delete set null;

alter table if exists demoforge.video_jobs
  add column if not exists tenant_id uuid references demoforge.tenants (id) on delete set null;

alter table demoforge.tenants enable row level security;
alter table demoforge.tenant_memberships enable row level security;
alter table demoforge.audit_logs enable row level security;

drop policy if exists "service_role_tenants_all" on demoforge.tenants;
create policy "service_role_tenants_all" on demoforge.tenants
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_tenant_memberships_all" on demoforge.tenant_memberships;
create policy "service_role_tenant_memberships_all" on demoforge.tenant_memberships
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_audit_logs_all" on demoforge.audit_logs;
create policy "service_role_audit_logs_all" on demoforge.audit_logs
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Journey authoring (graph)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Integration webhook catalog + outbound delivery log
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Video asset delivery metadata
-- ---------------------------------------------------------------------------
alter table if exists demoforge.video_renders
  add column if not exists storage_bucket text,
  add column if not exists storage_object_key text,
  add column if not exists cdn_url text,
  add column if not exists retention_until timestamptz;

-- ---------------------------------------------------------------------------
-- Variant optimizer state (closed-loop)
-- ---------------------------------------------------------------------------
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
