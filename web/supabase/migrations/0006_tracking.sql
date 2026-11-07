-- Phase 7: who has opened and finished each SOP, assignments with due dates,
-- and what managers can see about their team.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Run 0001 to 0005 first. Safe to run more than once.

-- Is this person in the department the signed-in person manages?
create or replace function public.is_my_team(person uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles p join roles r on r.id = p.role_id
    where p.id = person and r.department_id = public.managed_department_id()
  );
$$;

-- An SOP that someone must finish: given to one person or to everyone in a role.
create table if not exists public.assignments (
  id          bigserial primary key,
  sop_id      text not null references public.sops (id) on delete cascade,
  person_id   uuid references public.profiles (id) on delete cascade,
  role_id     int  references public.roles (id) on delete cascade,
  due_date    date,
  assigned_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint assigned_to_one check ((person_id is null) <> (role_id is null))
);

-- Someone finished an SOP. One row per person per revision, so a new
-- revision needs reading again.
create table if not exists public.completions (
  sop_id       text not null references public.sops (id) on delete cascade,
  person_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  revision     text not null,
  completed_at timestamptz not null default now(),
  primary key (sop_id, person_id, revision)
);

-- Someone opened an SOP (drives "In progress" and "Last active").
create table if not exists public.sop_views (
  sop_id          text not null references public.sops (id) on delete cascade,
  person_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at  timestamptz not null default now(),
  primary key (sop_id, person_id)
);

-- Can the signed-in person change assignments for this person or role?
create or replace function public.can_assign(person uuid, role int)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin()
    or (person is not null and public.is_my_team(person))
    or (role is not null and exists (
      select 1 from roles r where r.id = role and r.department_id = public.managed_department_id()
    ));
$$;

-- An assigned SOP can always be opened by the people it's assigned to.
create or replace function public.can_read_sop(sop text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1 from sops s
      where s.id = sop and s.status = 'published'
        and (
          s.department_id = public.managed_department_id()
          or exists (select 1 from sop_roles sr where sr.sop_id = s.id and sr.role_id = public.my_role_id())
          or exists (
            select 1 from assignments a
            where a.sop_id = s.id and (a.person_id = auth.uid() or a.role_id = public.my_role_id())
          )
        )
    );
$$;

alter table public.assignments enable row level security;
alter table public.completions enable row level security;
alter table public.sop_views   enable row level security;

-- Assignments: you see your own; managers see and change their department's;
-- admins see and change all.
drop policy if exists "Read assignments" on public.assignments;
create policy "Read assignments" on public.assignments
  for select to authenticated using (
    person_id = auth.uid() or role_id = public.my_role_id() or public.can_assign(person_id, role_id)
  );

drop policy if exists "Managers and admins add assignments" on public.assignments;
create policy "Managers and admins add assignments" on public.assignments
  for insert to authenticated with check (public.can_assign(person_id, role_id) and public.can_read_sop(sop_id));

drop policy if exists "Managers and admins change assignments" on public.assignments;
create policy "Managers and admins change assignments" on public.assignments
  for update to authenticated using (public.can_assign(person_id, role_id)) with check (public.can_assign(person_id, role_id));

drop policy if exists "Managers and admins remove assignments" on public.assignments;
create policy "Managers and admins remove assignments" on public.assignments
  for delete to authenticated using (public.can_assign(person_id, role_id));

-- Completions and views: you record your own, for SOPs you can open.
-- Managers see their team's; admins see everyone's.
drop policy if exists "Read completions" on public.completions;
create policy "Read completions" on public.completions
  for select to authenticated using (person_id = auth.uid() or public.is_admin() or public.is_my_team(person_id));

drop policy if exists "Mark your own SOPs complete" on public.completions;
create policy "Mark your own SOPs complete" on public.completions
  for insert to authenticated with check (person_id = auth.uid() and public.can_read_sop(sop_id));

drop policy if exists "Undo your own completions" on public.completions;
create policy "Undo your own completions" on public.completions
  for delete to authenticated using (person_id = auth.uid());

drop policy if exists "Read views" on public.sop_views;
create policy "Read views" on public.sop_views
  for select to authenticated using (person_id = auth.uid() or public.is_admin() or public.is_my_team(person_id));

drop policy if exists "Record your own views" on public.sop_views;
create policy "Record your own views" on public.sop_views
  for insert to authenticated with check (person_id = auth.uid() and public.can_read_sop(sop_id));

drop policy if exists "Update your own views" on public.sop_views;
create policy "Update your own views" on public.sop_views
  for update to authenticated using (person_id = auth.uid()) with check (person_id = auth.uid());

-- Tell the website about the new tables straight away.
notify pgrst, 'reload schema';
