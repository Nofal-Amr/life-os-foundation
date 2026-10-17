-- The sunnah of Fajr and Witr can be logged alongside the five prayers.
ALTER TABLE public.prayer_logs DROP CONSTRAINT IF EXISTS prayer_logs_prayer_name_check;
ALTER TABLE public.prayer_logs ADD CONSTRAINT prayer_logs_prayer_name_check
  CHECK (prayer_name IN ('sunnah_fajr','fajr','dhuhr','asr','maghrib','isha','witr'));
