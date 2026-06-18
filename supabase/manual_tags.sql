-- ============================================================================
--  Timeline tagging — run this in the Supabase SQL editor.
--  Adds a `manual_tags` column to `sessions` for rider corrections that feed
--  back into segmentation (Tier 2 tagging). First user: the takeoff tap.
--
--  Shape of manual_tags (jsonb):
--    {
--      "takeoff_s": 1.4,                          -- tap-to-mark takeoff (item 4)
--      "clip": [2.0, 9.5],                        -- trim to one wave (item 6)
--      "turn_labels": {                           -- turn corrections (item 5)
--        "2": { "type": "Cutback", "mark": "best" }
--      }
--    }
--  /resegment receives the full desired manual_tags and re-runs analysis on the
--  stored pose data (no MediaPipe). Turn corrections are also mirrored into the
--  turn_labels table (see turn_labels.sql) as durable training data.
-- ============================================================================

alter table sessions
  add column if not exists manual_tags jsonb not null default '{}'::jsonb;
