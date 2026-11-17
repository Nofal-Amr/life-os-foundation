-- Excuses: an admin can excuse a day's late arrival and/or early leave, so it
-- doesn't count. Stored as a correction with field 'excuse' and value
-- 'late', 'early', 'both' or 'none' (taken back); the latest for a day wins.
alter table public.work_corrections drop constraint if exists work_corrections_field_check;
alter table public.work_corrections
  add constraint work_corrections_field_check
  check (field in ('in', 'out', 'leave', 'excuse'));
