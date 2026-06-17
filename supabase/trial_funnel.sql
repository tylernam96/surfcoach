-- ============================================================================
--  Free Trial Funnel — run this in the Supabase SQL editor.
--  Creates the trial_requests table, links trial uploads into `sessions`,
--  and schedules a pg_cron job to expire stale trial links after 48h.
-- ============================================================================

-- ── Trial requests ──────────────────────────────────────────────────────────
create table if not exists trial_requests (
  id          uuid primary key default gen_random_uuid(),
  email       text        not null,
  name        text        not null,
  status      text        not null default 'pending'
                          check (status in ('pending', 'sent', 'expired')),
  token       text        not null unique,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '48 hours',
  used_at     timestamptz,            -- non-null once the single upload is consumed
  session_id  uuid                    -- set when the trial video is uploaded
);

create index if not exists trial_requests_token_idx  on trial_requests (token);
create index if not exists trial_requests_status_idx on trial_requests (status, expires_at);

-- RLS on, with NO public policies: every read/write happens server-side via the
-- service-role key (which bypasses RLS). This keeps tokens out of the browser.
alter table trial_requests enable row level security;

-- The service-role key bypasses RLS but still needs table-level privileges.
-- (Supabase usually grants these automatically; grant explicitly to be safe.)
grant select, insert, update, delete on public.trial_requests to service_role;

-- ── Link trial uploads into the existing sessions table ─────────────────────
alter table sessions add column if not exists is_trial boolean not null default false;
alter table sessions add column if not exists trial_request_id uuid references trial_requests(id);

-- Trial sessions have no authenticated user. If sessions.user_id is NOT NULL
-- (or FKs auth.users with a NOT NULL constraint), make it nullable so
-- service-role inserts with user_id = null succeed.
alter table sessions alter column user_id drop not null;

-- ── pg_cron: expire stale links every 15 minutes ───────────────────────────
-- Housekeeping/reporting only. Every server route also performs a lazy
-- `now() > expires_at` check, so an expired link is never honored even
-- between cron runs.
create extension if not exists pg_cron;

select cron.schedule(
  'expire-trials',
  '*/15 * * * *',
  $$
    update trial_requests
       set status = 'expired'
     where status in ('pending', 'sent')
       and used_at is null
       and now() > expires_at
  $$
);

-- To inspect / remove later:
--   select * from cron.job;
--   select cron.unschedule('expire-trials');
