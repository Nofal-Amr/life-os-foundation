-- Any day can start the week (Saturday, Sunday and Monday stay the usual choices).
ALTER TABLE public.user_preferences DROP CONSTRAINT IF EXISTS user_preferences_week_start_check;
ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_week_start_check CHECK (week_start BETWEEN 0 AND 6);
