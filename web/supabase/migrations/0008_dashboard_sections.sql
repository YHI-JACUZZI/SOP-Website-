-- Dashboard sections: Employee handbook and Policies live alongside SOPs,
-- some documents are for everyone, and a company people directory.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Run 0001 to 0007 first. Safe to run more than once.

-- What kind of document: an SOP, a section of the employee handbook, or a policy.
alter table public.sops add column if not exists kind text not null default 'sop';
alter table public.sops drop constraint if exists sops_kind_check;
alter table public.sops add constraint sops_kind_check check (kind in ('sop', 'handbook', 'policy'));

-- Documents everyone in the company can open, whatever their role.
alter table public.sops add column if not exists for_everyone boolean not null default false;

-- Same rule as before, plus documents marked for everyone.
create or replace function public.can_read_sop(sop text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1 from sops s
      where s.id = sop and s.status = 'published'
        and (
          s.for_everyone
          or s.department_id = public.managed_department_id()
          or exists (select 1 from sop_roles sr where sr.sop_id = s.id and sr.role_id = public.my_role_id())
          or exists (
            select 1 from assignments a
            where a.sop_id = s.id and (a.person_id = auth.uid() or a.role_id = public.my_role_id())
          )
        )
    );
$$;

-- The SOP list itself follows the same rule.
drop policy if exists "Read SOPs you're allowed" on public.sops;
create policy "Read SOPs you're allowed" on public.sops
  for select to authenticated using (public.can_read_sop(id));

-- Company directory: name, email, role and department of everyone active.
-- Only signed-in people get an answer.
create or replace function public.people_directory()
returns table (id uuid, full_name text, email text, role text, is_manager boolean, department_id int, department text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.full_name, p.email, r.name, coalesce(r.is_manager, false), d.id, d.name
  from profiles p
  left join roles r on r.id = p.role_id
  left join departments d on d.id = r.department_id
  where p.active and auth.uid() is not null
  order by d.name nulls first, r.is_manager desc nulls last, coalesce(p.full_name, p.email);
$$;

notify pgrst, 'reload schema';
