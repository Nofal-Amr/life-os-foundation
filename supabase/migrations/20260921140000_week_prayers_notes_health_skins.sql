-- One migration for this batch so it can be applied in a single SQL run.

-- Week view: which day a week starts on (0 = Sunday, 1 = Monday, 6 = Saturday).
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS week_start smallint NOT NULL DEFAULT 1;
ALTER TABLE public.user_preferences DROP CONSTRAINT IF EXISTS user_preferences_week_start_check;
ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_week_start_check CHECK (week_start IN (0, 1, 6));

-- Skins: Serious (default) or RPG.
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS skin text NOT NULL DEFAULT 'serious';
ALTER TABLE public.user_preferences DROP CONSTRAINT IF EXISTS user_preferences_skin_check;
ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_skin_check CHECK (skin IN ('serious', 'rpg'));

-- Prayers: how each prayer was prayed.
ALTER TABLE public.prayer_logs ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.prayer_logs DROP CONSTRAINT IF EXISTS prayer_logs_status_check;
ALTER TABLE public.prayer_logs
  ADD CONSTRAINT prayer_logs_status_check
  CHECK (status IS NULL OR status IN ('jamaah', 'on_time', 'late', 'missed'));
-- Existing rows keep their meaning.
UPDATE public.prayer_logs
  SET status = CASE
    WHEN completed IS NOT TRUE THEN 'missed'
    WHEN on_time IS FALSE THEN 'late'
    ELSE 'on_time'
  END
  WHERE status IS NULL;

-- Notes: Keep-style pinning, colour, archive and checklists.
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS checklist jsonb;

-- Money: the time of day a transaction happened (the date column stays).
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS occurred_time time;

-- Electricity and other meters: tariff tiers, editable per resource.
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS tariff jsonb;

-- Samsung Health / Health Connect samples, one row per record.
CREATE TABLE IF NOT EXISTS public.health_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  value double precision NOT NULL,
  unit text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  source text,
  external_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, external_id)
);
CREATE INDEX IF NOT EXISTS health_samples_user_kind_start_idx
  ON public.health_samples (user_id, kind, start_at DESC);

-- Private usage analytics: screens and actions, for refining the experience.
CREATE TABLE IF NOT EXISTS public.ux_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  path text,
  platform text,
  props jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ux_events_user_created_idx ON public.ux_events (user_id, created_at DESC);

ALTER TABLE public.health_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ux_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['health_samples', 'ux_events'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)', t || '_select_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t || '_insert_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t || '_update_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.uid() = user_id)', t || '_delete_own', t);
  END LOOP;
END $$;
