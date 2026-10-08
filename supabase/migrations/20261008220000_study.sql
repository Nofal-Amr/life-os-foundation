-- Student mode: courses, a weekly timetable, and assignments/exams.
-- Private to each user, like everything else.
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  code text CHECK (code IS NULL OR char_length(code) <= 30),
  teacher text CHECK (teacher IS NULL OR char_length(teacher) <= 100),
  color text CHECK (color IS NULL OR char_length(color) <= 30),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS courses_user_idx ON public.courses (user_id);

CREATE TABLE IF NOT EXISTS public.class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts time NOT NULL,
  ends time NOT NULL,
  room text CHECK (room IS NULL OR char_length(room) <= 60),
  kind text CHECK (kind IS NULL OR char_length(kind) <= 30),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends > starts)
);
CREATE INDEX IF NOT EXISTS class_sessions_user_idx ON public.class_sessions (user_id, weekday);

CREATE TABLE IF NOT EXISTS public.study_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('assignment', 'exam', 'quiz', 'project', 'reading')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  due_at timestamptz,
  weight numeric CHECK (weight IS NULL OR (weight >= 0 AND weight <= 100)),
  grade numeric CHECK (grade IS NULL OR (grade >= 0 AND grade <= 1000)),
  max_grade numeric CHECK (max_grade IS NULL OR (max_grade > 0 AND max_grade <= 1000)),
  done boolean NOT NULL DEFAULT false,
  note text CHECK (note IS NULL OR char_length(note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS study_items_user_due_idx ON public.study_items (user_id, due_at);
DROP TRIGGER IF EXISTS study_items_set_updated_at ON public.study_items;
CREATE TRIGGER study_items_set_updated_at BEFORE UPDATE ON public.study_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS courses_own ON public.courses;
DROP POLICY IF EXISTS class_sessions_own ON public.class_sessions;
DROP POLICY IF EXISTS study_items_own ON public.study_items;
CREATE POLICY courses_own ON public.courses FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY class_sessions_own ON public.class_sessions FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.user_id = (select auth.uid()))
  );
CREATE POLICY study_items_own ON public.study_items FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (course_id IS NULL OR EXISTS (
      SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.user_id = (select auth.uid())
    ))
  );
