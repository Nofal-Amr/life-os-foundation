-- Additive column on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- ============ body_stats ============
CREATE TABLE public.body_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  height_cm numeric,
  weight_kg numeric,
  birthdate date,
  target_weight_kg numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT body_stats_user_unique UNIQUE (user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_stats TO authenticated;
GRANT ALL ON public.body_stats TO service_role;
ALTER TABLE public.body_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "body_stats_select_own" ON public.body_stats FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "body_stats_insert_own" ON public.body_stats FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "body_stats_update_own" ON public.body_stats FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "body_stats_delete_own" ON public.body_stats FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ health_logs ============
CREATE TABLE public.health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT current_date,
  trained boolean,
  sleep_hours numeric,
  stress_level int CHECK (stress_level BETWEEN 1 AND 5),
  water_ok boolean,
  food_quality int CHECK (food_quality BETWEEN 1 AND 5),
  food_categories text[],
  mood int CHECK (mood BETWEEN 1 AND 5),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_logs_user_date_unique UNIQUE (user_id, log_date)
);
CREATE INDEX health_logs_user_date_idx ON public.health_logs (user_id, log_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_logs TO authenticated;
GRANT ALL ON public.health_logs TO service_role;
ALTER TABLE public.health_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_logs_select_own" ON public.health_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "health_logs_insert_own" ON public.health_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "health_logs_update_own" ON public.health_logs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "health_logs_delete_own" ON public.health_logs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ medications ============
CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dosage text,
  schedule_times text[],
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX medications_user_idx ON public.medications (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medications TO authenticated;
GRANT ALL ON public.medications TO service_role;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medications_select_own" ON public.medications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "medications_insert_own" ON public.medications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "medications_update_own" ON public.medications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "medications_delete_own" ON public.medications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ medication_logs ============
CREATE TABLE public.medication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT current_date,
  time_slot text NOT NULL,
  taken boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT medication_logs_unique UNIQUE (medication_id, log_date, time_slot)
);
CREATE INDEX medication_logs_user_date_idx ON public.medication_logs (user_id, log_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_logs TO authenticated;
GRANT ALL ON public.medication_logs TO service_role;
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medication_logs_select_own" ON public.medication_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "medication_logs_insert_own" ON public.medication_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.medications m WHERE m.id = medication_id AND m.user_id = auth.uid()));
CREATE POLICY "medication_logs_update_own" ON public.medication_logs FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.medications m WHERE m.id = medication_id AND m.user_id = auth.uid()));
CREATE POLICY "medication_logs_delete_own" ON public.medication_logs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ prayer_logs ============
CREATE TABLE public.prayer_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prayer_date date NOT NULL DEFAULT current_date,
  prayer_name text NOT NULL CHECK (prayer_name IN ('fajr','dhuhr','asr','maghrib','isha')),
  completed boolean NOT NULL DEFAULT true,
  on_time boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prayer_logs_unique UNIQUE (user_id, prayer_date, prayer_name)
);
CREATE INDEX prayer_logs_user_date_idx ON public.prayer_logs (user_id, prayer_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prayer_logs TO authenticated;
GRANT ALL ON public.prayer_logs TO service_role;
ALTER TABLE public.prayer_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prayer_logs_select_own" ON public.prayer_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "prayer_logs_insert_own" ON public.prayer_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "prayer_logs_update_own" ON public.prayer_logs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "prayer_logs_delete_own" ON public.prayer_logs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ prayer_settings ============
CREATE TABLE public.prayer_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude numeric,
  longitude numeric,
  city text,
  calc_method text,
  asr_school text DEFAULT 'shafi',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prayer_settings_user_unique UNIQUE (user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prayer_settings TO authenticated;
GRANT ALL ON public.prayer_settings TO service_role;
ALTER TABLE public.prayer_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prayer_settings_select_own" ON public.prayer_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "prayer_settings_insert_own" ON public.prayer_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "prayer_settings_update_own" ON public.prayer_settings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "prayer_settings_delete_own" ON public.prayer_settings FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ user_preferences ============
CREATE TABLE public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dimension_order text[] DEFAULT ARRAY['health','spirit','professional','discipline','knowledge']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_preferences_user_unique UNIQUE (user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_preferences_select_own" ON public.user_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_preferences_insert_own" ON public.user_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_preferences_update_own" ON public.user_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_preferences_delete_own" ON public.user_preferences FOR DELETE TO authenticated USING (user_id = auth.uid());

-- updated_at triggers (reuse existing public.set_updated_at())
CREATE TRIGGER update_body_stats_updated_at BEFORE UPDATE ON public.body_stats FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_health_logs_updated_at BEFORE UPDATE ON public.health_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_medications_updated_at BEFORE UPDATE ON public.medications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_medication_logs_updated_at BEFORE UPDATE ON public.medication_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_prayer_logs_updated_at BEFORE UPDATE ON public.prayer_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_prayer_settings_updated_at BEFORE UPDATE ON public.prayer_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();