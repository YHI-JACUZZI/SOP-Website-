-- Phase 3: departments, roles, people and who can see what.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.departments (
  id   serial primary key,
  name text not null unique
);

create table if not exists public.roles (
  id            serial primary key,
  name          text not null unique,
  department_id int references public.departments (id),
  is_admin      boolean not null default false, -- sees and edits everything
  is_manager    boolean not null default false  -- sees their department's people and progress
);

-- One row per person with a login. Created automatically when someone is
-- invited or added in Supabase; an admin then picks their role.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  role_id    int references public.roles (id),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Starting departments and roles (edit later from the site)
-- ---------------------------------------------------------------------------

insert into public.departments (name) values
  ('Marketing'), ('Sales'), ('Admin'), ('Production')
on conflict (name) do nothing;

insert into public.roles (name, department_id, is_admin, is_manager) values
  ('Admin',               null, true,  false),
  ('Production Manager',  (select id from public.departments where name = 'Production'), false, true),
  ('Project Coordinator', (select id from public.departments where name = 'Production'), false, false),
  ('Field Manager',       (select id from public.departments where name = 'Production'), false, false),
  ('Warehouse',           (select id from public.departments where name = 'Production'), false, false),
  ('Installer',           (select id from public.departments where name = 'Production'), false, false),
  ('Sales Manager',       (select id from public.departments where name = 'Sales'),      false, true),
  ('Sales Rep',           (select id from public.departments where name = 'Sales'),      false, false),
  ('Marketing Manager',   (select id from public.departments where name = 'Marketing'),  false, true),
  ('Office Manager',      (select id from public.departments where name = 'Admin'),      false, true)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers the permission rules use. "security definer" lets them read
-- profiles without tripping the rules they are part of.
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles p join roles r on r.id = p.role_id
    where p.id = auth.uid() and p.active and r.is_admin
  );
$$;

-- The department the signed-in person manages, or null if they aren't a manager.
create or replace function public.managed_department_id()
returns int
language sql stable security definer set search_path = public
as $$
  select r.department_id from profiles p join roles r on r.id = p.role_id
  where p.id = auth.uid() and p.active and r.is_manager;
$$;

-- ---------------------------------------------------------------------------
-- New logins get a profile automatically
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- People who signed up before this ran (like you) get a profile too.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Permission rules (row level security)
-- ---------------------------------------------------------------------------

alter table public.departments enable row level security;
alter table public.roles       enable row level security;
alter table public.profiles    enable row level security;

drop policy if exists "Signed-in people can read departments" on public.departments;
create policy "Signed-in people can read departments" on public.departments
  for select to authenticated using (true);

drop policy if exists "Admins manage departments" on public.departments;
create policy "Admins manage departments" on public.departments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Signed-in people can read roles" on public.roles;
create policy "Signed-in people can read roles" on public.roles
  for select to authenticated using (true);

drop policy if exists "Admins manage roles" on public.roles;
create policy "Admins manage roles" on public.roles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Everyone sees their own profile; admins see everyone; managers see their department.
drop policy if exists "Read own, managed or all profiles" on public.profiles;
create policy "Read own, managed or all profiles" on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.is_admin()
    or role_id in (
      select r.id from public.roles r
      where r.department_id = public.managed_department_id()
    )
  );

-- Only admins change roles or deactivate people.
drop policy if exists "Admins update profiles" on public.profiles;
create policy "Admins update profiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Make yourself the first Admin: put your login email between the quotes.
-- ---------------------------------------------------------------------------

update public.profiles
set role_id = (select id from public.roles where name = 'Admin')
where email = 'YOUR-EMAIL-HERE';
