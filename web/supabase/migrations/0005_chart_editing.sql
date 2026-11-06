-- Phase 6: admins edit charts on the site, with a version history to undo.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Run 0004_workflows.sql first. Safe to run more than once.

-- Every save keeps a copy of the chart as it was just before.
create table if not exists public.workflow_versions (
  id          bigserial primary key,
  workflow_id text not null references public.workflows (id) on delete cascade,
  saved_at    timestamptz not null default now(),
  saved_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  lanes       jsonb not null,
  edges       jsonb not null,
  steps       jsonb not null
);

alter table public.workflow_versions enable row level security;

drop policy if exists "Admins read chart history" on public.workflow_versions;
create policy "Admins read chart history" on public.workflow_versions
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins add chart history" on public.workflow_versions;
create policy "Admins add chart history" on public.workflow_versions
  for insert to authenticated with check (public.is_admin());

-- Each lane says who owns its steps: a role or a department. Fill that in for
-- the two starting charts (matched by lane name).
update public.workflows w
set lanes = (
  select jsonb_agg(
    l || case
      when w.department_id is null
        then jsonb_build_object('department_id', (select d.id from public.departments d where d.name = l->>'label'))
      else jsonb_build_object('role_id', (select r.id from public.roles r where r.name = l->>'label'))
    end
    order by ord)
  from jsonb_array_elements(w.lanes) with ordinality as t (l, ord)
)
where w.id in ('company', 'production')
  and not (w.lanes->0 ? 'role_id' or w.lanes->0 ? 'department_id');

-- Save a whole chart in one go. Steps take their owner from their lane.
-- Runs with the caller's permissions, so the admin-only rules still apply.
create or replace function public.save_workflow(w text, new_lanes jsonb, new_edges jsonb, new_steps jsonb)
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can edit charts';
  end if;

  insert into workflow_versions (workflow_id, lanes, edges, steps)
  select x.id, x.lanes, x.edges,
         coalesce((select jsonb_agg(to_jsonb(s) - 'workflow_id') from workflow_steps s where s.workflow_id = w), '[]')
  from workflows x where x.id = w;
  if not found then
    raise exception 'Chart % not found', w;
  end if;

  update workflows set lanes = new_lanes, edges = new_edges, updated_at = now() where id = w;

  delete from workflow_steps where workflow_id = w;
  insert into workflow_steps (workflow_id, key, label, type, lane, col, "row", sop_id, drill_id, owner_role_id, owner_department_id, note)
  select w, s.key, s.label, coalesce(s.type, 'step'), s.lane, coalesce(s.col, 0), coalesce(s."row", 0),
         nullif(trim(s.sop_id), ''), nullif(s.drill_id, ''),
         (l->>'role_id')::int, (l->>'department_id')::int, nullif(trim(s.note), '')
  from jsonb_to_recordset(new_steps)
         as s (key text, label text, type text, lane text, col int, "row" int, sop_id text, drill_id text, note text)
  left join lateral (
    select e from jsonb_array_elements(new_lanes) e where e->>'key' = s.lane limit 1
  ) as ln (l) on true;
end;
$$;

-- Put a chart back the way it was in an earlier version (the current one is
-- kept in the history too, so a restore can itself be undone).
create or replace function public.restore_workflow_version(version_id bigint)
returns void
language plpgsql security invoker set search_path = public
as $$
declare
  v workflow_versions;
begin
  select * into v from workflow_versions where id = version_id;
  if not found then
    raise exception 'Version not found';
  end if;
  perform public.save_workflow(v.workflow_id, v.lanes, v.edges, v.steps);
end;
$$;
