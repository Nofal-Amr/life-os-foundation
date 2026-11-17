-- Gym: workouts and their sets. Every row is private to its owner, and a set
-- can only belong to one of your own workouts.
-- Applied to production on 2026-11-17 with the owner's OK. Before that, the
-- Gym page said it needed a one-time database update.

CREATE TABLE IF NOT EXISTS public.workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  performed_on date NOT NULL DEFAULT current_date,
  name text CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 80),
  note text CHECK (note IS NULL OR char_length(note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workouts_user_day_idx ON public.workouts (user_id, performed_on DESC);

CREATE TABLE IF NOT EXISTS public.workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  exercise text NOT NULL CHECK (char_length(exercise) BETWEEN 1 AND 80),
  position integer NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 1000),
  reps integer CHECK (reps IS NULL OR reps BETWEEN 0 AND 1000),
  weight numeric CHECK (weight IS NULL OR (weight >= 0 AND weight <= 2000)),
  unit text NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg', 'lb')),
  seconds integer CHECK (seconds IS NULL OR seconds BETWEEN 0 AND 86400),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workout_sets_workout_idx ON public.workout_sets (workout_id, position);
CREATE INDEX IF NOT EXISTS workout_sets_user_exercise_idx ON public.workout_sets (user_id, exercise);

-- Row-level security: your own rows only.
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workouts_own ON public.workouts;
CREATE POLICY workouts_own ON public.workouts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- A set may only point at one of your own workouts.
DROP POLICY IF EXISTS workout_sets_own ON public.workout_sets;
CREATE POLICY workout_sets_own ON public.workout_sets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = workout_id AND w.user_id = auth.uid())
  );

DROP TRIGGER IF EXISTS workouts_set_updated_at ON public.workouts;
CREATE TRIGGER workouts_set_updated_at BEFORE UPDATE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
