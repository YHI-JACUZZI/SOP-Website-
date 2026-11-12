-- Who's online: the site notes when each person was last active, so admins
-- and department managers can see who is signed in on their team.
-- Paste this whole file into a new query in the Supabase SQL Editor and click Run.
-- If Supabase asks about RLS, choose Run without RLS (RLS is already set up).
-- Run 0001 to 0010 first. Safe to run more than once.

alter table public.profiles add column if not exists last_seen_at timestamptz;

-- Called as people move around the site. Only ever stamps your own row, and
-- at most once a minute, so it stays cheap.
create or replace function public.touch_last_seen()
returns void
language sql volatile security definer set search_path = public
as $$
  update profiles set last_seen_at = now()
  where id = auth.uid()
    and (last_seen_at is null or last_seen_at < now() - interval '1 minute');
$$;

-- Signing out takes you off "Online now" straight away.
create or replace function public.mark_signed_out()
returns void
language sql volatile security definer set search_path = public
as $$
  update profiles set last_seen_at = now() - interval '5 minutes'
  where id = auth.uid() and last_seen_at > now() - interval '5 minutes';
$$;

notify pgrst, 'reload schema';
