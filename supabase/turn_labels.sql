-- ============================================================================
--  Turn labels — run this in the Supabase SQL editor.
--  Stores rider corrections to auto-detected turns as TRAINING DATA: every
--  "that's a cutback, not a top turn" and best/worst mark is captured here so a
--  real turn classifier can be trained later (the path past the 2D-pose
--  heuristic ceiling). Written server-side from /resegment.
--
--  The same correction is also applied live (it overrides the turn's type/mark
--  in sessions.analysis.segments via manual_tags) — this table is the durable,
--  queryable label store, one row per (session, turn).
-- ============================================================================

create table if not exists turn_labels (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid        not null references sessions(id) on delete cascade,
  turn_index      int         not null,           -- 1-based index within the ride
  predicted_type  text,                            -- what segmentation guessed
  corrected_type  text,                            -- what the rider says it is
  mark            text        check (mark in ('best', 'worst')),
  -- Turn window (original-video time) so the pose features can be re-extracted
  -- from sessions.frame_data when building a training set.
  start_s         real,
  peak_s          real,
  end_s           real,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (session_id, turn_index)
);

create index if not exists turn_labels_session_idx on turn_labels (session_id);

-- RLS on, with NO public policies: corrections are written server-side via the
-- service-role key (which bypasses RLS). The browser never touches this table —
-- it sees the applied overrides inside sessions.analysis.segments.
alter table turn_labels enable row level security;

grant select, insert, update, delete on public.turn_labels to service_role;
