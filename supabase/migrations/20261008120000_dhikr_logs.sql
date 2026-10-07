-- Azkar and tasbih: a plain record of what was read, private to its owner.
-- kind: 'morning' / 'evening' (a finished azkar session) or 'tasbih' (a
-- counter session; label is the dhikr, count how many).

CREATE TABLE IF NOT EXISTS public.dhikr_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('morning', 'evening', 'tasbih')),
  label text CHECK (label IS NULL OR char_length(label) <= 200),
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0 AND count <= 1000000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dhikr_logs_user_date_idx ON public.dhikr_logs (user_id, log_date);
ALTER TABLE public.dhikr_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dhikr_logs_select_own ON public.dhikr_logs;
DROP POLICY IF EXISTS dhikr_logs_insert_own ON public.dhikr_logs;
DROP POLICY IF EXISTS dhikr_logs_update_own ON public.dhikr_logs;
DROP POLICY IF EXISTS dhikr_logs_delete_own ON public.dhikr_logs;
CREATE POLICY dhikr_logs_select_own ON public.dhikr_logs FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY dhikr_logs_insert_own ON public.dhikr_logs FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY dhikr_logs_update_own ON public.dhikr_logs FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY dhikr_logs_delete_own ON public.dhikr_logs FOR DELETE USING ((select auth.uid()) = user_id);
