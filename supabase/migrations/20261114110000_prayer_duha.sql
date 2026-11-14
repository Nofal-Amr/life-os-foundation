-- Duha can be logged alongside the five, like the sunnah of Fajr and Witr.
-- Only widens the list of allowed names: every existing row still passes.
--
-- Roll back (first remove any Duha logs, or the check fails):
--   delete from public.prayer_logs where prayer_name = 'duha';
--   alter table public.prayer_logs drop constraint if exists prayer_logs_prayer_name_check;
--   alter table public.prayer_logs add constraint prayer_logs_prayer_name_check
--     check (prayer_name in ('sunnah_fajr','fajr','dhuhr','asr','maghrib','isha','witr'));
ALTER TABLE public.prayer_logs DROP CONSTRAINT IF EXISTS prayer_logs_prayer_name_check;
ALTER TABLE public.prayer_logs ADD CONSTRAINT prayer_logs_prayer_name_check
  CHECK (prayer_name IN ('sunnah_fajr','fajr','duha','dhuhr','asr','maghrib','isha','witr'));
