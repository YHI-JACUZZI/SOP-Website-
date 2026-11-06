-- Phase 5: flowcharts (the company map and its drill-downs) and who can see them.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Run 0001 and 0002 first. Safe to run more than once: it never overwrites a
-- chart that is already there.

-- One row per flowchart. Lanes and arrows are stored with the chart so the
-- Phase 6 editor can save a whole chart in one go.
create table if not exists public.workflows (
  id            text primary key,                       -- e.g. company, production
  name          text not null,
  summary       text,
  department_id int references public.departments (id),  -- null = company-wide, everyone sees it
  parent_id     text references public.workflows (id),
  parent_step   text,                                    -- the step on the parent chart that opens this one
  sort          int not null default 0,
  lanes         jsonb not null default '[]',  -- [{key, label, color, rows?}] top to bottom
  edges         jsonb not null default '[]',  -- [{from, to, label?, route?, exit?}]
  routing       text,                         -- 'vertical' bends arrows down into the next lane
  updated_at    timestamptz not null default now()
);

-- One row per box on a chart.
create table if not exists public.workflow_steps (
  workflow_id         text not null references public.workflows (id) on delete cascade,
  key                 text not null,
  label               text not null,
  type                text not null default 'step', -- step | decision | terminal | placeholder
  lane                text not null,                -- a lanes[].key of its chart
  col                 int  not null default 0,
  row                 int  not null default 0,
  sop_id              text,                         -- may name an SOP that isn't written yet
  drill_id            text references public.workflows (id),
  owner_role_id       int references public.roles (id),
  owner_department_id int references public.departments (id),
  note                text,                         -- "needs confirming" note
  primary key (workflow_id, key)
);

-- The signed-in person's department, or null.
create or replace function public.my_department_id()
returns int
language sql stable security definer set search_path = public
as $$
  select r.department_id from profiles p join roles r on r.id = p.role_id
  where p.id = auth.uid() and p.active;
$$;

-- Admins see every chart. Everyone else sees the company-wide charts, their
-- own department's charts, and any chart with a step their role owns.
create or replace function public.can_read_workflow(w text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1 from workflows x
      where x.id = w and (x.department_id is null or x.department_id = public.my_department_id())
    )
    or exists (
      select 1 from workflow_steps s
      where s.workflow_id = w and s.owner_role_id = public.my_role_id()
    );
$$;

alter table public.workflows      enable row level security;
alter table public.workflow_steps enable row level security;

drop policy if exists "Read charts you're allowed" on public.workflows;
create policy "Read charts you're allowed" on public.workflows
  for select to authenticated using (public.can_read_workflow(id));

drop policy if exists "Admins manage charts" on public.workflows;
create policy "Admins manage charts" on public.workflows
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Read steps of charts you're allowed" on public.workflow_steps;
create policy "Read steps of charts you're allowed" on public.workflow_steps
  for select to authenticated using (public.can_read_workflow(workflow_id));

drop policy if exists "Admins manage steps" on public.workflow_steps;
create policy "Admins manage steps" on public.workflow_steps
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Starting charts, copied from the test site
-- ---------------------------------------------------------------------------

insert into public.workflows (id, name, summary, department_id, sort, lanes, edges) values (
  'company', 'Company map', 'From signed sale to installed and closed job.', null, 0,
  '[{"key":"marketing","label":"Marketing","color":"sales"},
    {"key":"sales","label":"Sales","color":"sm","rows":2},
    {"key":"admin","label":"Admin","color":"admin"},
    {"key":"production","label":"Production","color":"prod"}]',
  '[{"from":"start","to":"s1"},{"from":"s1","to":"s2"},{"from":"s2","to":"d1"},
    {"from":"d1","to":"s3","label":"Yes"},{"from":"d1","to":"s5","label":"No","exit":"bottom"},
    {"from":"s3","to":"s4","route":"rv"},{"from":"s4","to":"s2","label":"Costing back to SM","route":"lv"},
    {"from":"s5","to":"s6"},{"from":"s6","to":"s7"},{"from":"s7","to":"s8"},{"from":"s8","to":"end"}]'
) on conflict (id) do nothing;

insert into public.workflows (id, name, summary, department_id, parent_id, parent_step, sort, lanes, edges, routing) values (
  'production', 'Production process / install', 'From job start through install, closing and AR.',
  (select id from public.departments where name = 'Production'), 'company', 's8', 1,
  '[{"key":"pc","label":"Project Coordinator","color":"pc"},
    {"key":"fm","label":"Field Manager","color":"fm"},
    {"key":"wh","label":"Warehouse","color":"wh"},
    {"key":"inst","label":"Installer","color":"inst"}]',
  '[{"from":"start","to":"p1"},{"from":"p1","to":"p2"},{"from":"p2","to":"p3"},{"from":"p3","to":"p4"},
    {"from":"p4","to":"p5","route":"down-over"},{"from":"p5","to":"p6"},{"from":"p6","to":"p7"},
    {"from":"p7","to":"p8"},{"from":"p8","to":"p9"},{"from":"p9","to":"p10"},{"from":"p10","to":"p11"},
    {"from":"p11","to":"p12"},{"from":"p12","to":"p13"}]',
  'vertical'
) on conflict (id) do nothing;

-- Company map steps: each lane is a department.
insert into public.workflow_steps (workflow_id, key, label, type, lane, col, row, sop_id, drill_id, owner_department_id, note)
select 'company', v.key, v.label, v.type, v.lane, v.col, v.row, v.sop_id, v.drill_id,
       (select id from public.departments d where d.name = v.dept), v.note
from (values
  ('start', 'Start',                                   'terminal', 'marketing',  0, 0, null,          null,         'Marketing',  null),
  ('s1',    'Price & sign in FlexX',                   'step',     'marketing',  1, 0, 'SOP-JAC-001', null,         'Marketing',  'Confirm the name of the pricing tool (FlexX).'),
  ('s2',    'Contract delivers to Sales Manager for review', 'step', 'sales',    2, 0, 'SOP-JAC-002', null,         'Sales',      null),
  ('d1',    'Special quote?',                          'decision', 'sales',      3, 0, 'SOP-JAC-003', null,         'Sales',      'Owner assumed to be Sales.'),
  ('s3',    'Send to PM for costing',                  'step',     'sales',      4, 0, 'SOP-JAC-004', null,         'Sales',      null),
  ('s5',    'Send to Admin',                           'step',     'sales',      4, 1, 'SOP-JAC-005', null,         'Sales',      'Owner assumed to be Sales.'),
  ('s4',    'PM fills & sends back',                   'step',     'production', 5, 0, 'SOP-JAC-006', null,         'Production', null),
  ('s6',    'Admin review + upload to QB, JT, Keap, LP', 'step',   'admin',      6, 0, 'SOP-JAC-007', null,         'Admin',      'Confirm what QB, JT and LP stand for.'),
  ('s7',    'Contract lands in JT',                    'step',     'admin',      7, 0, 'SOP-JAC-008', null,         'Admin',      'Owner assumed to be Admin.'),
  ('s8',    'Production process / install',            'step',     'production', 8, 0, 'SOP-JAC-009', 'production', 'Production', 'Owner assumed to be a Production team.'),
  ('end',   'Close',                                   'terminal', 'production', 9, 0, null,          null,         'Production', null)
) as v (key, label, type, lane, col, row, sop_id, drill_id, dept, note)
on conflict (workflow_id, key) do nothing;

-- Production steps: each lane is a role.
insert into public.workflow_steps (workflow_id, key, label, type, lane, col, sop_id, owner_role_id, note)
select 'production', v.key, v.label, v.type, v.lane, v.col, v.sop_id,
       (select id from public.roles r where r.name = v.role), v.note
from (values
  ('start', 'Job Start Steps',                                'terminal', 'pc',   0, 'SOP-PRD-000', 'Project Coordinator', null),
  ('p1',    'PreSite',                                        'step',     'fm',   0, 'SOP-PRD-001', 'Field Manager',       null),
  ('p2',    'Material Ordering / PO',                         'step',     'pc',   1, 'SOP-PRD-002', 'Project Coordinator', null),
  ('p3',    'Customer Touch Call 1',                          'step',     'pc',   2, 'SOP-PRD-003', 'Project Coordinator', null),
  ('p4',    'Customer Touch Call 2',                          'step',     'pc',   3, 'SOP-PRD-004', 'Project Coordinator', null),
  ('p5',    'Materials Received',                             'step',     'wh',   2, 'SOP-PRD-005', 'Warehouse',           null),
  ('p6',    'Materials RTG',                                  'step',     'wh',   3, 'SOP-PRD-006', 'Warehouse',           'Confirm RTG means Ready to Go.'),
  ('p7',    'Confirmation Calls with Customer and Installer', 'step',     'pc',   4, 'SOP-PRD-007', 'Project Coordinator', null),
  ('p8',    'Installer PO',                                   'step',     'pc',   5, 'SOP-PRD-008', 'Project Coordinator', null),
  ('p9',    'Material Pickup',                                'step',     'wh',   5, 'SOP-PRD-009', 'Warehouse',           null),
  ('p10',   'Office Job Start',                               'step',     'fm',   6, 'SOP-PRD-010', 'Field Manager',       null),
  ('p11',   'Install',                                        'step',     'inst', 6, 'SOP-PRD-011', 'Installer',           null),
  ('p12',   'Closing Steps',                                  'step',     'pc',   7, 'SOP-PRD-012', 'Project Coordinator', null),
  ('p13',   'AR Steps',                                       'step',     'pc',   8, 'SOP-PRD-013', 'Project Coordinator', null)
) as v (key, label, type, lane, col, sop_id, role, note)
on conflict (workflow_id, key) do nothing;
