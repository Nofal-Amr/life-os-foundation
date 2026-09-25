-- Reminders, vehicle fuel, task time and repeat, food preferences, Clutch,
-- and energy in the daily review. Every new table is private to its owner.

-- 1. Prayer status "clutch": prayed in the last minutes of its time.
ALTER TABLE public.prayer_logs DROP CONSTRAINT IF EXISTS prayer_logs_status_check;
ALTER TABLE public.prayer_logs
  ADD CONSTRAINT prayer_logs_status_check
  CHECK (status IS NULL OR status IN ('jamaah', 'on_time', 'clutch', 'late', 'missed'));

-- 2. Reminders that aren't tasks ("call the bank at 3").
CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  note text CHECK (note IS NULL OR char_length(note) <= 2000),
  remind_at timestamptz NOT NULL,
  repeat text NOT NULL DEFAULT 'none'
    CHECK (repeat IN ('none', 'daily', 'weekdays', 'weekly', 'monthly')),
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reminders_user_time_idx ON public.reminders (user_id, remind_at);
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reminders_select_own ON public.reminders;
DROP POLICY IF EXISTS reminders_insert_own ON public.reminders;
DROP POLICY IF EXISTS reminders_update_own ON public.reminders;
DROP POLICY IF EXISTS reminders_delete_own ON public.reminders;
CREATE POLICY reminders_select_own ON public.reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY reminders_insert_own ON public.reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY reminders_update_own ON public.reminders FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY reminders_delete_own ON public.reminders FOR DELETE USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS reminders_set_updated_at ON public.reminders;
CREATE TRIGGER reminders_set_updated_at BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Tasks: an optional time on the due date, and repeating tasks.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_time time;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS repeat text;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_repeat_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_repeat_check
  CHECK (repeat IS NULL OR repeat IN ('daily', 'weekdays', 'weekly', 'monthly'));

-- 4. Vehicles as a resource, and fuel fill-ups against them.
ALTER TYPE public.resource_kind ADD VALUE IF NOT EXISTS 'vehicle';

CREATE TABLE IF NOT EXISTS public.fuel_fillups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  filled_at timestamptz NOT NULL DEFAULT now(),
  odometer_km numeric NOT NULL CHECK (odometer_km >= 0),
  litres numeric CHECK (litres IS NULL OR litres > 0),
  price_per_litre numeric CHECK (price_per_litre IS NULL OR price_per_litre >= 0),
  total_cost numeric CHECK (total_cost IS NULL OR total_cost >= 0),
  grade text CHECK (grade IS NULL OR grade IN ('80', '92', '95', 'diesel', 'electric', 'other')),
  full_tank boolean NOT NULL DEFAULT true,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fuel_fillups_resource_idx ON public.fuel_fillups (resource_id, filled_at);
ALTER TABLE public.fuel_fillups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fuel_fillups_select_own ON public.fuel_fillups;
DROP POLICY IF EXISTS fuel_fillups_insert_own ON public.fuel_fillups;
DROP POLICY IF EXISTS fuel_fillups_update_own ON public.fuel_fillups;
DROP POLICY IF EXISTS fuel_fillups_delete_own ON public.fuel_fillups;
CREATE POLICY fuel_fillups_select_own ON public.fuel_fillups FOR SELECT USING (auth.uid() = user_id);
-- A fill-up can only be added to your own vehicle.
CREATE POLICY fuel_fillups_insert_own ON public.fuel_fillups FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.resources r WHERE r.id = resource_id AND r.user_id = auth.uid())
);
CREATE POLICY fuel_fillups_update_own ON public.fuel_fillups FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.resources r WHERE r.id = resource_id AND r.user_id = auth.uid())
);
CREATE POLICY fuel_fillups_delete_own ON public.fuel_fillups FOR DELETE USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS fuel_fillups_set_updated_at ON public.fuel_fillups;
CREATE TRIGGER fuel_fillups_set_updated_at BEFORE UPDATE ON public.fuel_fillups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Food you like, chosen once, for suggestions when logging a meal.
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS food_prefs jsonb;

-- 6. Energy next to mood in the daily review (1-5, optional).
ALTER TABLE public.daily_reviews ADD COLUMN IF NOT EXISTS energy integer;
ALTER TABLE public.daily_reviews DROP CONSTRAINT IF EXISTS daily_reviews_energy_check;
ALTER TABLE public.daily_reviews
  ADD CONSTRAINT daily_reviews_energy_check CHECK (energy IS NULL OR energy BETWEEN 1 AND 5);
