-- Repair demoforge.roles when the table already existed without key/label (common cause:
-- CREATE TABLE IF NOT EXISTS skipped, then INSERT ... (key, label) failed with 42703).
-- Safe to re-run.

alter table if exists demoforge.roles add column if not exists key text;
alter table if exists demoforge.roles add column if not exists label text;
alter table if exists demoforge.roles add column if not exists created_at timestamptz;

update demoforge.roles set created_at = coalesce(created_at, now()) where true;

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

-- Legacy tables often keep NOT NULL name; ensure it is populated from label/key.
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

do $rbac_roles_notnull$
begin
  if not exists (select 1 from demoforge.roles where key is null or label is null) then
    alter table demoforge.roles alter column key set not null;
    alter table demoforge.roles alter column label set not null;
  end if;
end
$rbac_roles_notnull$;

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
