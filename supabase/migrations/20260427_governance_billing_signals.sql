-- billing ↔ tenant, membership self-read RLS, permissions, behavior signals

alter table if exists demoforge.billing_customers
  add column if not exists tenant_id uuid references demoforge.tenants (id) on delete set null;

create table if not exists demoforge.permissions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  created_at timestamptz not null default now()
);

insert into demoforge.permissions (key, label)
values
  ('admin.access', 'Access admin workspace'),
  ('billing.manage', 'Manage billing and subscriptions')
on conflict (key) do nothing;

create table if not exists demoforge.role_permissions (
  role_id uuid not null references demoforge.roles (id) on delete cascade,
  permission_id uuid not null references demoforge.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

insert into demoforge.role_permissions (role_id, permission_id)
select r.id, p.id
from demoforge.roles r
cross join demoforge.permissions p
where r.key in ('owner', 'admin')
  and p.key in ('admin.access', 'billing.manage')
  and not exists (
    select 1
    from demoforge.role_permissions rp
    where rp.role_id = r.id
      and rp.permission_id = p.id
  );

alter table demoforge.permissions enable row level security;
alter table demoforge.role_permissions enable row level security;

drop policy if exists "service_role_permissions_all" on demoforge.permissions;
create policy "service_role_permissions_all" on demoforge.permissions
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_role_permissions_all" on demoforge.role_permissions;
create policy "service_role_role_permissions_all" on demoforge.role_permissions
  for all to service_role using (true) with check (true);

drop policy if exists "memberships_select_own" on demoforge.tenant_memberships;
create policy "memberships_select_own" on demoforge.tenant_memberships
  for select to authenticated
  using (auth.uid() = user_id);

create table if not exists demoforge.behavior_signals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references demoforge.demo_sessions (id) on delete set null,
  render_id uuid references demoforge.video_renders (id) on delete set null,
  signal_kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists behavior_signals_session_idx
  on demoforge.behavior_signals (session_id, created_at desc);

alter table demoforge.behavior_signals enable row level security;

drop policy if exists "service_role_behavior_signals_all" on demoforge.behavior_signals;
create policy "service_role_behavior_signals_all" on demoforge.behavior_signals
  for all to service_role using (true) with check (true);
