-- Food and Gym get a plan side next to the doing side.
-- Applied to production on 2026-11-17 with the owner's OK ("yes food and gym plans").

-- Foods: a recipe to follow and a rough cost per serving.
ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS recipe text CHECK (recipe IS NULL OR char_length(recipe) <= 8000),
  ADD COLUMN IF NOT EXISTS cost numeric CHECK (cost IS NULL OR cost >= 0);

-- The weekly meal plan: which food, which meal, which weekday (0 = Sunday).
CREATE TABLE IF NOT EXISTS public.meal_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  meal text NOT NULL CHECK (char_length(meal) BETWEEN 1 AND 40),
  food_id uuid NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  servings numeric NOT NULL DEFAULT 1 CHECK (servings > 0 AND servings <= 50),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meal_plan_items_user_day_idx ON public.meal_plan_items (user_id, weekday);

-- Gym routines: a named workout for given weekdays, with its planned exercises
-- as [{ "exercise": "Squat", "sets": 3, "reps": 8, "weight": 60 }].
CREATE TABLE IF NOT EXISTS public.workout_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  weekdays smallint[] NOT NULL DEFAULT '{}',
  exercises jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(exercises) = 'array'),
  note text CHECK (note IS NULL OR char_length(note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workout_routines_user_idx ON public.workout_routines (user_id);

-- A workout can say which routine it followed.
ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS routine_id uuid REFERENCES public.workout_routines(id) ON DELETE SET NULL;

-- Your own rows only; a plan item may only point at one of your own foods.
ALTER TABLE public.meal_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meal_plan_items_own ON public.meal_plan_items;
CREATE POLICY meal_plan_items_own ON public.meal_plan_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.foods f WHERE f.id = food_id AND f.user_id = auth.uid())
  );

DROP POLICY IF EXISTS workout_routines_own ON public.workout_routines;
CREATE POLICY workout_routines_own ON public.workout_routines FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS workout_routines_updated_at ON public.workout_routines;
CREATE TRIGGER workout_routines_updated_at BEFORE UPDATE ON public.workout_routines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
