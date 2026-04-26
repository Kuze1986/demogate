do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'demoforge'
      and t.typname = 'event_type'
      and e.enumlabel = 'journey_branch_decision'
  ) then
    alter type demoforge.event_type add value 'journey_branch_decision';
  end if;
end
$$;
