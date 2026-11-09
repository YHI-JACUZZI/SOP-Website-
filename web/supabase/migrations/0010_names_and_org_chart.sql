-- Names, job titles and who reports to whom (for the org chart).
-- Paste this whole file into a new query in the Supabase SQL Editor and click Run.
-- If Supabase asks about RLS, choose Run without RLS (RLS is already set up).
-- Run 0001 to 0009 first. Safe to run more than once.

alter table public.profiles add column if not exists job_title text;
alter table public.profiles add column if not exists reports_to uuid references public.profiles (id) on delete set null;

alter table public.profiles drop constraint if exists not_own_manager;
alter table public.profiles add constraint not_own_manager check (reports_to is null or reports_to <> id);

-- Anyone signed in can set their own name (admins can set anyone's).
create or replace function public.set_my_name(new_name text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or new_name is null or length(trim(new_name)) not between 2 and 120 then
    raise exception 'Type your full name.';
  end if;
  update profiles set full_name = trim(new_name) where id = auth.uid();
end;
$$;

-- Company directory, now with job title and manager.
drop function if exists public.people_directory();
create function public.people_directory()
returns table (
  id uuid, full_name text, email text, role text, is_manager boolean,
  department_id int, department text, job_title text, reports_to uuid
)
language sql stable security definer set search_path = public
as $$
  select p.id, p.full_name, p.email, r.name, coalesce(r.is_manager, false), d.id, d.name, p.job_title, p.reports_to
  from profiles p
  left join roles r on r.id = p.role_id
  left join departments d on d.id = r.department_id
  where p.active and auth.uid() is not null
  order by d.name nulls first, r.is_manager desc nulls last, coalesce(p.full_name, p.email);
$$;

notify pgrst, 'reload schema';
