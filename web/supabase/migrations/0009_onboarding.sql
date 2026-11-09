-- Onboarding: a checklist every new hire works through, with who does each
-- task and when it's due, and a record of what's been ticked off.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Run 0001 to 0008 first. Safe to run more than once.

-- When each person started (onboarding due dates count from here).
alter table public.profiles add column if not exists start_date date;

-- The checklist. A task can be for everyone, one department or one role.
-- Who does it: the new hire, their manager, or an admin (IT, HR, office).
-- A task linked to a document is done automatically once the new hire
-- finishes or signs that document.
create table if not exists public.onboarding_tasks (
  id            bigserial primary key,
  category      text not null default 'General',
  title         text not null check (length(trim(title)) > 0),
  owner         text not null default 'employee' check (owner in ('employee', 'manager', 'admin')),
  due_days      int  not null default 7 check (due_days between 0 and 365),
  sop_id        text references public.sops (id) on delete set null,
  department_id int  references public.departments (id) on delete cascade,
  role_id       int  references public.roles (id) on delete cascade,
  sort          int  not null default 0,
  created_at    timestamptz not null default now()
);

-- One row per ticked task per person.
create table if not exists public.onboarding_progress (
  person_id uuid   not null references public.profiles (id) on delete cascade,
  task_id   bigint not null references public.onboarding_tasks (id) on delete cascade,
  done_at   timestamptz not null default now(),
  done_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  primary key (person_id, task_id)
);

-- Can the signed-in person tick this task for this person? New hires tick
-- their own tasks; managers tick anything for their team; admins anything.
create or replace function public.can_tick_onboarding(person uuid, task bigint)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin()
    or public.is_my_team(person)
    or (person = auth.uid() and exists (select 1 from onboarding_tasks t where t.id = task and t.owner = 'employee'));
$$;

-- Managers set start dates for their team (admins already can edit profiles).
create or replace function public.set_start_date(person uuid, d date)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not (public.is_admin() or public.is_my_team(person)) then
    raise exception 'You can only set start dates for your own team.';
  end if;
  update profiles set start_date = d where id = person;
end;
$$;

alter table public.onboarding_tasks    enable row level security;
alter table public.onboarding_progress enable row level security;

drop policy if exists "Signed-in people read the checklist" on public.onboarding_tasks;
create policy "Signed-in people read the checklist" on public.onboarding_tasks
  for select to authenticated using (true);

drop policy if exists "Admins edit the checklist" on public.onboarding_tasks;
create policy "Admins edit the checklist" on public.onboarding_tasks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Read onboarding progress" on public.onboarding_progress;
create policy "Read onboarding progress" on public.onboarding_progress
  for select to authenticated using (person_id = auth.uid() or public.is_admin() or public.is_my_team(person_id));

drop policy if exists "Tick onboarding tasks" on public.onboarding_progress;
create policy "Tick onboarding tasks" on public.onboarding_progress
  for insert to authenticated with check (public.can_tick_onboarding(person_id, task_id) and done_by = auth.uid());

drop policy if exists "Untick onboarding tasks" on public.onboarding_progress;
create policy "Untick onboarding tasks" on public.onboarding_progress
  for delete to authenticated using (public.can_tick_onboarding(person_id, task_id));

-- A starter checklist to edit on the site. Only added if the checklist is empty.
insert into public.onboarding_tasks (category, title, owner, due_days, sort)
select v.category, v.title, v.owner, v.due_days, v.sort
from (values
  ('Accounts & equipment', 'Create company email address',               'admin',    0,  10),
  ('Accounts & equipment', 'Set up SOP Hub login and role',              'admin',    0,  20),
  ('Accounts & equipment', 'Set up JobTread access',                     'admin',    1,  30),
  ('Accounts & equipment', 'Issue phone, tablet or tools',               'admin',    1,  40),
  ('New hire paperwork',   'Complete direct deposit form',               'employee', 3,  50),
  ('New hire paperwork',   'Review and sign I-9',                        'employee', 3,  60),
  ('New hire paperwork',   'Review and sign W-4',                        'employee', 3,  70),
  ('New hire paperwork',   'Read the employee handbook',                 'employee', 7,  80),
  ('Getting to know us',   'Meet your manager',                          'manager',  1,  90),
  ('Getting to know us',   'Office and warehouse tour',                  'manager',  2, 100),
  ('Getting to know us',   'Introduce to the team',                      'manager',  2, 110),
  ('Training',             'Read and sign the SOPs for your role',            'employee', 14, 120),
  ('Training',             'Shadow a job from start to finish',          'manager',  21, 130),
  ('Training',             '30-day check-in with your manager',          'manager',  30, 140)
) as v (category, title, owner, due_days, sort)
where not exists (select 1 from public.onboarding_tasks);

notify pgrst, 'reload schema';
