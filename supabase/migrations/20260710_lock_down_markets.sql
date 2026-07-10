-- Market history must only be read through protected server API routes.
-- The server uses SUPABASE_SERVICE_ROLE_KEY after validating the app session.

alter table public.markets enable row level security;

drop policy if exists "allow public read markets" on public.markets;

revoke select on table public.markets from anon;
revoke select on table public.markets from authenticated;
