-- Phase 4: the SOP library and who can open each SOP.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Run 0001_people_and_roles.sql first. Safe to run more than once.

create table if not exists public.sops (
  id            text primary key,          -- e.g. SOP-PRD-001
  title         text not null,
  revision      text not null default '00',
  department_id int references public.departments (id),
  status        text not null default 'published', -- draft | published | archived
  updated_at    timestamptz not null default now()
);

-- Which roles an SOP is for. Admins see every SOP, and managers see every
-- SOP in their department, so they don't need rows here.
create table if not exists public.sop_roles (
  sop_id  text references public.sops (id) on delete cascade,
  role_id int  references public.roles (id) on delete cascade,
  primary key (sop_id, role_id)
);

-- The signed-in person's role, or null.
create or replace function public.my_role_id()
returns int
language sql stable security definer set search_path = public
as $$
  select role_id from profiles where id = auth.uid() and active;
$$;

-- Can the signed-in person open this SOP?
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
        )
    );
$$;

alter table public.sops      enable row level security;
alter table public.sop_roles enable row level security;

drop policy if exists "Read SOPs you're allowed" on public.sops;
create policy "Read SOPs you're allowed" on public.sops
  for select to authenticated using (public.can_read_sop(id));

drop policy if exists "Admins manage SOPs" on public.sops;
create policy "Admins manage SOPs" on public.sops
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Read SOP roles you're allowed" on public.sop_roles;
create policy "Read SOP roles you're allowed" on public.sop_roles
  for select to authenticated using (public.can_read_sop(sop_id));

drop policy if exists "Admins manage SOP roles" on public.sop_roles;
create policy "Admins manage SOP roles" on public.sop_roles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- The three Production SOPs from the test site.
insert into public.sops (id, title, department_id) values
  ('SOP-PRD-000', 'Job Start Steps',   (select id from public.departments where name = 'Production')),
  ('SOP-PRD-001', 'PreSite',           (select id from public.departments where name = 'Production')),
  ('SOP-PRD-002', 'Material Ordering', (select id from public.departments where name = 'Production'))
on conflict (id) do nothing;

insert into public.sop_roles (sop_id, role_id)
select v.sop_id, r.id
from (values
  ('SOP-PRD-000', 'Project Coordinator'),
  ('SOP-PRD-001', 'Field Manager'),
  ('SOP-PRD-002', 'Project Coordinator')
) as v (sop_id, role_name)
join public.roles r on r.name = v.role_name
on conflict do nothing;
