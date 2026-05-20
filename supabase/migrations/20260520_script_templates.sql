-- Phase 1B: Tenant products + demo script templates.
-- Replaces hardcoded product/persona model for self-service SaaS tenants.

-- ---------------------------------------------------------------------------
-- 1. Tenant products (the thing being demoed)
-- ---------------------------------------------------------------------------
create table if not exists demoforge.tenant_products (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references demoforge.tenants (id) on delete cascade,
  name        text not null,
  description text,
  base_url    text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists tenant_products_tenant_idx on demoforge.tenant_products (tenant_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_tenant_products_updated'
  ) then
    create trigger trg_tenant_products_updated
    before update on demoforge.tenant_products
    for each row execute function demoforge.update_updated_at();
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Demo script templates (steps + talking points per tenant product)
-- ---------------------------------------------------------------------------
create table if not exists demoforge.demo_script_templates (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references demoforge.tenants (id) on delete cascade,
  product_id     uuid references demoforge.tenant_products (id) on delete set null,
  name           text not null,
  steps          jsonb not null default '[]'::jsonb,
  talking_points text[] not null default '{}',
  tone           text not null default 'confident',
  is_default     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

do $tone_check$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'demo_script_templates_tone_check'
      and conrelid = 'demoforge.demo_script_templates'::regclass
  ) then
    alter table demoforge.demo_script_templates
      add constraint demo_script_templates_tone_check
      check (tone in ('confident', 'friendly', 'urgent', 'neutral'));
  end if;
end
$tone_check$;

create index if not exists demo_script_templates_tenant_idx on demoforge.demo_script_templates (tenant_id);
create index if not exists demo_script_templates_product_idx on demoforge.demo_script_templates (product_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_demo_script_templates_updated'
  ) then
    create trigger trg_demo_script_templates_updated
    before update on demoforge.demo_script_templates
    for each row execute function demoforge.update_updated_at();
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. Link video_jobs to the script template that was used
-- ---------------------------------------------------------------------------
alter table if exists demoforge.video_jobs
  add column if not exists script_template_id uuid
    references demoforge.demo_script_templates (id) on delete set null;

alter table if exists demoforge.video_jobs
  add column if not exists voice_id text;

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table demoforge.tenant_products      enable row level security;
alter table demoforge.demo_script_templates enable row level security;

drop policy if exists "tenant_tenant_products" on demoforge.tenant_products;
create policy "tenant_tenant_products" on demoforge.tenant_products
  for all to authenticated
  using (tenant_id in (select demoforge.current_user_tenant_ids()))
  with check (tenant_id in (select demoforge.current_user_tenant_ids()));

drop policy if exists "service_role_tenant_products_all" on demoforge.tenant_products;
create policy "service_role_tenant_products_all" on demoforge.tenant_products
  for all to service_role using (true) with check (true);

drop policy if exists "tenant_demo_script_templates" on demoforge.demo_script_templates;
create policy "tenant_demo_script_templates" on demoforge.demo_script_templates
  for all to authenticated
  using (tenant_id in (select demoforge.current_user_tenant_ids()))
  with check (tenant_id in (select demoforge.current_user_tenant_ids()));

drop policy if exists "service_role_demo_script_templates_all" on demoforge.demo_script_templates;
create policy "service_role_demo_script_templates_all" on demoforge.demo_script_templates
  for all to service_role using (true) with check (true);
