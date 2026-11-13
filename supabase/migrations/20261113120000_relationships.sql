-- Relationships: the people in your life, how they connect, when you last
-- spoke, and the rules for which reminders you want. Every row is private to
-- its owner; links, interactions and rules can only point at your own people.
-- NOT APPLIED YET: waiting for the owner's approval (staging first).

CREATE TABLE IF NOT EXISTS public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  is_me boolean NOT NULL DEFAULT false,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  relation text NOT NULL DEFAULT 'other' CHECK (relation IN (
    'me', 'father', 'mother', 'parent', 'sibling', 'spouse', 'child', 'grandparent',
    'uncle_aunt', 'cousin', 'nephew_niece', 'relative', 'friend', 'colleague', 'other')),
  circle text NOT NULL DEFAULT 'friends'
    CHECK (circle IN ('me', 'closest', 'family', 'relatives', 'friends', 'work')),
  birthday_month smallint CHECK (birthday_month IS NULL OR birthday_month BETWEEN 1 AND 12),
  birthday_day smallint CHECK (birthday_day IS NULL OR birthday_day BETWEEN 1 AND 31),
  birth_year smallint CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND 2100),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 40),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 4000),
  goal text CHECK (goal IS NULL OR char_length(goal) <= 500),
  checkin_every_days integer CHECK (checkin_every_days IS NULL OR checkin_every_days BETWEEN 1 AND 366),
  checkin_since date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((birthday_month IS NULL) = (birthday_day IS NULL))
);
CREATE INDEX IF NOT EXISTS people_user_idx ON public.people (user_id);
-- One "Me" per account.
CREATE UNIQUE INDEX IF NOT EXISTS people_one_me_idx ON public.people (user_id) WHERE is_me;

CREATE TABLE IF NOT EXISTS public.person_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  from_person uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  to_person uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'parent', 'child', 'sibling', 'spouse', 'cousin', 'friend', 'colleague', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_person <> to_person)
);
CREATE INDEX IF NOT EXISTS person_links_user_idx ON public.person_links (user_id);

CREATE TABLE IF NOT EXISTS public.person_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('call', 'message', 'visit', 'met', 'note')),
  occurred_on date NOT NULL DEFAULT current_date,
  note text CHECK (note IS NULL OR char_length(note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS person_interactions_person_idx
  ON public.person_interactions (user_id, person_id, occurred_on DESC);

CREATE TABLE IF NOT EXISTS public.relationship_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('everyone', 'circle', 'relation', 'person')),
  scope_value text CHECK (scope_value IS NULL OR char_length(scope_value) <= 60),
  topic text NOT NULL CHECK (topic IN ('birthday', 'checkin', 'both')),
  action text NOT NULL CHECK (action IN ('remind', 'quiet')),
  except_person_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope_type = 'everyone') = (scope_value IS NULL))
);
CREATE INDEX IF NOT EXISTS relationship_rules_user_idx ON public.relationship_rules (user_id);

-- Row-level security: your own rows only.
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS people_own ON public.people;
CREATE POLICY people_own ON public.people FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- A link may only join two of your own people.
DROP POLICY IF EXISTS person_links_own ON public.person_links;
CREATE POLICY person_links_own ON public.person_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = from_person AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = to_person AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS person_interactions_own ON public.person_interactions;
CREATE POLICY person_interactions_own ON public.person_interactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = person_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS relationship_rules_own ON public.relationship_rules;
CREATE POLICY relationship_rules_own ON public.relationship_rules FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS people_set_updated_at ON public.people;
CREATE TRIGGER people_set_updated_at BEFORE UPDATE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS relationship_rules_set_updated_at ON public.relationship_rules;
CREATE TRIGGER relationship_rules_set_updated_at BEFORE UPDATE ON public.relationship_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
