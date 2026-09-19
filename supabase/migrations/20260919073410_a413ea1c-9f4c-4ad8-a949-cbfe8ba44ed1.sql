ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS unit_system text NOT NULL DEFAULT 'metric',
  ADD COLUMN IF NOT EXISTS time_format text NOT NULL DEFAULT '24h',
  ADD COLUMN IF NOT EXISTS date_format text NOT NULL DEFAULT 'dmy';

ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_unit_system_check CHECK (unit_system IN ('metric','imperial')),
  ADD CONSTRAINT user_preferences_time_format_check CHECK (time_format IN ('24h','12h')),
  ADD CONSTRAINT user_preferences_date_format_check CHECK (date_format IN ('dmy','mdy','iso'));