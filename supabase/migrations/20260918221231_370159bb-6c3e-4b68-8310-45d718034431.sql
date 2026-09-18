CREATE TABLE public.capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capabilities TO authenticated;
GRANT ALL ON public.capabilities TO service_role;
ALTER TABLE public.capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY capabilities_select_own ON public.capabilities FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY capabilities_insert_own ON public.capabilities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY capabilities_update_own ON public.capabilities FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY capabilities_delete_own ON public.capabilities FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX capabilities_user_id_idx ON public.capabilities(user_id);
CREATE TRIGGER set_capabilities_updated_at BEFORE UPDATE ON public.capabilities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  capability_id uuid REFERENCES public.capabilities(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.evidence TO authenticated;
GRANT ALL ON public.evidence TO service_role;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_select_own ON public.evidence FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY evidence_insert_own ON public.evidence FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX evidence_user_id_idx ON public.evidence(user_id);
CREATE INDEX evidence_capability_id_idx ON public.evidence(capability_id);

ALTER TABLE public.tasks
  ADD COLUMN capability_id uuid REFERENCES public.capabilities(id) ON DELETE SET NULL,
  ADD COLUMN goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL;

ALTER TABLE public.goals
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;