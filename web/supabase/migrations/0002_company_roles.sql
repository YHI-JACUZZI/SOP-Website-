-- Phase 3: switch to the company's own role list (2026-11-06).
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Run 0001_people_and_roles.sql first. Safe to run more than once.

-- Departments: Operations replaces the old "Admin" department name.
update public.departments set name = 'Operations'
where name = 'Admin'
  and not exists (select 1 from public.departments where name = 'Operations');

insert into public.departments (name) values
  ('Operations'), ('Production'), ('Sales'), ('Marketing')
on conflict (name) do nothing;

-- The roles. Owner and Admin both see and edit everything.
insert into public.roles (name, department_id, is_admin, is_manager) values
  ('Owner',              null, true,  false),
  ('Admin',              null, true,  false),
  ('Operations Manager', (select id from public.departments where name = 'Operations'), false, true),
  ('Production Manager', (select id from public.departments where name = 'Production'), false, true),
  ('Sales Manager',      (select id from public.departments where name = 'Sales'),      false, true),
  ('Marketing Manager',  (select id from public.departments where name = 'Marketing'),  false, true),
  ('Operations',         (select id from public.departments where name = 'Operations'), false, false),
  ('Production',         (select id from public.departments where name = 'Production'), false, false),
  ('Marketing',          (select id from public.departments where name = 'Marketing'),  false, false)
on conflict (name) do update set
  department_id = excluded.department_id,
  is_admin      = excluded.is_admin,
  is_manager    = excluded.is_manager;

-- Remove the starter roles that aren't on the list. Anyone who had one
-- goes back to "no role yet" so an admin can pick the right one.
update public.profiles set role_id = null
where role_id in (
  select id from public.roles where name not in (
    'Owner', 'Admin', 'Operations Manager', 'Production Manager', 'Sales Manager',
    'Marketing Manager', 'Operations', 'Production', 'Marketing'
  )
);

delete from public.roles where name not in (
  'Owner', 'Admin', 'Operations Manager', 'Production Manager', 'Sales Manager',
  'Marketing Manager', 'Operations', 'Production', 'Marketing'
);
