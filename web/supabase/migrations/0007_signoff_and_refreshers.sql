-- Phase 7b: signed sign-off on assigned SOPs, certificates, manager emails,
-- and refresher training with a short quiz.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Run 0001 to 0006 first. Safe to run more than once.

-- ---------------------------------------------------------------------------
-- Sign-off: a finished SOP can carry a typed signature, the statement the
-- person agreed to, and a certificate number.
-- ---------------------------------------------------------------------------

alter table public.completions add column if not exists signed_name text;
alter table public.completions add column if not exists statement text;
alter table public.completions add column if not exists certificate_id uuid not null default gen_random_uuid();
create unique index if not exists completions_certificate_id on public.completions (certificate_id);

alter table public.completions drop constraint if exists signed_name_length;
alter table public.completions add constraint signed_name_length
  check (signed_name is null or length(trim(signed_name)) between 2 and 120);

-- The database stamps who signed and when; the browser cannot change them.
create or replace function public.stamp_signoff()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.person_id := auth.uid();
    new.completed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_completion on public.completions;
create trigger stamp_completion before insert on public.completions
  for each row execute function public.stamp_signoff();

-- A signed sign-off is a record: only an admin can remove it.
drop policy if exists "Undo your own completions" on public.completions;
create policy "Undo your own completions" on public.completions
  for delete to authenticated using ((person_id = auth.uid() and signed_name is null) or public.is_admin());

-- How often an assignment needs a refresher (in months). Empty means never.
alter table public.assignments add column if not exists refresh_months int;
alter table public.assignments drop constraint if exists refresh_months_range;
alter table public.assignments add constraint refresh_months_range
  check (refresh_months is null or refresh_months between 1 and 24);

-- ---------------------------------------------------------------------------
-- Quiz questions. People taking a refresher never see the answers: they get
-- the questions through quiz_for() and are marked by submit_refresher().
-- ---------------------------------------------------------------------------

create table if not exists public.quiz_questions (
  id         bigserial primary key,
  sop_id     text not null references public.sops (id) on delete cascade,
  question   text not null check (length(trim(question)) > 0),
  choices    jsonb not null check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) between 2 and 6),
  answer     int not null check (answer >= 0),
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

-- Admins write any quiz; managers write quizzes for their department's SOPs.
create or replace function public.can_edit_quiz(sop text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from sops s where s.id = sop and s.department_id = public.managed_department_id()
  );
$$;

alter table public.quiz_questions enable row level security;

drop policy if exists "Quiz writers manage questions" on public.quiz_questions;
create policy "Quiz writers manage questions" on public.quiz_questions
  for all to authenticated using (public.can_edit_quiz(sop_id)) with check (public.can_edit_quiz(sop_id));

create or replace function public.quiz_for(sop text)
returns table (id bigint, question text, choices jsonb)
language sql stable security definer set search_path = public
as $$
  select q.id, q.question, q.choices from quiz_questions q
  where q.sop_id = sop and public.can_read_sop(sop)
  order by q.sort, q.id;
$$;

-- Starter questions for the first three SOPs (drafts to check and edit on the
-- site). Only added when an SOP has no questions yet.
insert into public.quiz_questions (sop_id, question, choices, answer, sort)
select v.sop_id, v.question, v.choices::jsonb, v.answer, v.sort
from (values
  ('SOP-PRD-000', 'Where do you enter the contract price?', '["In the customer notes", "Extended price on the Jacuzzi Project line in the Budget tab", "Only on the payment schedule tab"]', 1, 1),
  ('SOP-PRD-000', 'When do you change the payment schedule?', '["When the down payment is anything other than 1000 dollars", "On every job", "Never"]', 0, 2),
  ('SOP-PRD-000', 'What must you uncheck before approving the customer order?', '["Save", "Internal", "Notify, so the customer does not see it"]', 2, 3),
  ('SOP-PRD-001', 'Where is the costing file for a job?', '["On the JobTread message board", "In Dropbox: Jacuzzi Open > Job Name > FINAL COSTING CONTRACTS SPECIAL QUOTES", "With the warehouse"]', 1, 1),
  ('SOP-PRD-001', 'Something is sold on the contract but missing in pricing. What do you do?', '["Add it in the After Presite column", "Leave it out", "Ask the customer to pay separately"]', 0, 2),
  ('SOP-PRD-001', 'On the survey call the customer wants to add something. What next?', '["Add it at no charge", "Tell them it cannot be changed", "Generate a Change Order for them to sign"]', 2, 3),
  ('SOP-PRD-002', 'What do you check before ordering materials?', '["That all earlier tasks in the job schedule are complete", "Installer availability", "Nothing, just order"]', 0, 1),
  ('SOP-PRD-002', 'What is saved in JobTread files as proof of what was ordered?', '["A photo of the contract", "The exported cut sheet", "The installer PO"]', 1, 2),
  ('SOP-PRD-002', 'Where do you upload the .CSV order file?', '["The JobTread budget tab", "Dropbox", "The Jacuzzi ordering site: Quick Order > File Upload"]', 2, 3)
) as v (sop_id, question, choices, answer, sort)
where exists (select 1 from public.sops s where s.id = v.sop_id)
  and not exists (select 1 from public.quiz_questions q where q.sop_id = v.sop_id);

-- ---------------------------------------------------------------------------
-- Refreshers: one row per attempt, so retention can be tracked over time.
-- ---------------------------------------------------------------------------

create table if not exists public.refreshers (
  id             bigserial primary key,
  sop_id         text not null references public.sops (id) on delete cascade,
  person_id      uuid not null references public.profiles (id) on delete cascade,
  revision       text not null,
  score          int not null,          -- percent correct
  total          int not null,          -- number of questions
  passed         boolean not null,
  answers        jsonb not null default '{}',
  signed_name    text,
  statement      text,
  certificate_id uuid not null default gen_random_uuid() unique,
  completed_at   timestamptz not null default now()
);

alter table public.refreshers enable row level security;

drop policy if exists "Read refreshers" on public.refreshers;
create policy "Read refreshers" on public.refreshers
  for select to authenticated using (person_id = auth.uid() or public.is_admin() or public.is_my_team(person_id));
-- No insert policy on purpose: attempts only go in through submit_refresher().

-- Marks the quiz, records the attempt and returns the result. A pass needs 80%.
-- Wrong answers come back by question number so people know what to re-read,
-- without giving the answers away.
create or replace function public.submit_refresher(sop text, picked jsonb, signed text, agreed text)
returns table (score int, total int, passed boolean, wrong bigint[], certificate_id uuid)
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  rev text;
  n int;
  right_count int;
  missed bigint[];
  pct int;
  ok boolean;
  cert uuid;
begin
  if me is null or not public.can_read_sop(sop) then
    raise exception 'You cannot take this refresher.';
  end if;
  if signed is null or length(trim(signed)) not between 2 and 120 then
    raise exception 'Type your full name to sign.';
  end if;
  select s.revision into rev from sops s where s.id = sop;

  select count(*),
         count(*) filter (where picked ->> q.id::text = q.answer::text),
         coalesce(array_agg(q.id order by q.sort, q.id) filter (where (picked ->> q.id::text) is distinct from q.answer::text), '{}')
    into n, right_count, missed
    from quiz_questions q where q.sop_id = sop;

  pct := case when n = 0 then 100 else round(100.0 * right_count / n) end;
  ok := pct >= 80;

  insert into refreshers (sop_id, person_id, revision, score, total, passed, answers, signed_name, statement)
  values (sop, me, rev, pct, n, ok, coalesce(picked, '{}'), trim(signed), agreed)
  returning refreshers.certificate_id into cert;

  return query select pct, n, ok, missed, cert;
end;
$$;

-- ---------------------------------------------------------------------------
-- Manager emails
-- ---------------------------------------------------------------------------

-- The managers of the signed-in person's department (who gets the email).
create or replace function public.my_manager_contacts()
returns table (full_name text, email text)
language sql stable security definer set search_path = public
as $$
  select p.full_name, p.email from profiles p join roles r on r.id = p.role_id
  where p.active and r.is_manager and r.department_id = public.my_department_id()
    and p.id <> auth.uid();
$$;

-- Every email the site tries to send, so admins can check what went out
-- (and what would have, before email is set up).
create table if not exists public.email_log (
  id         bigserial primary key,
  sent_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  to_email   text not null,
  subject    text not null,
  status     text not null,
  detail     text,
  created_at timestamptz not null default now()
);

alter table public.email_log enable row level security;

drop policy if exists "Admins read email log" on public.email_log;
create policy "Admins read email log" on public.email_log
  for select to authenticated using (public.is_admin());

drop policy if exists "Log your own emails" on public.email_log;
create policy "Log your own emails" on public.email_log
  for insert to authenticated with check (sent_by = auth.uid());

-- Tell the website about the new tables straight away.
notify pgrst, 'reload schema';
