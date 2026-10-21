-- Work: companies (work spaces) where people clock in and out at places the
-- admin marks, and get a monthly attendance and pay sheet. Separate from the
-- personal app: nothing here reads anyone's personal data, and an admin sees
-- only what's inside the company.
--
-- Access rules:
-- - Members see their company, its places and rules; their own member row
--   (salary included), events, corrections and leave. Owners and admins see
--   everyone's.
-- - Clock events are only ever inserted, as yourself; never edited or
--   deleted. Changes are corrections, which are also never edited.
-- - Joining goes through join_work_org(code); roles change only by the owner.

CREATE TABLE IF NOT EXISTS public.work_orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  invite_code text NOT NULL UNIQUE CHECK (invite_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  rules jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.work_members (
  org_id uuid NOT NULL REFERENCES public.work_orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  base_salary numeric NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  overtime_rate numeric CHECK (overtime_rate IS NULL OR overtime_rate >= 0),
  place_ids uuid[],
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS work_members_user_idx ON public.work_members (user_id);

CREATE TABLE IF NOT EXISTS public.work_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.work_orgs(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  kind text NOT NULL DEFAULT 'office' CHECK (kind IN ('office', 'site')),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  radius_m integer NOT NULL DEFAULT 50 CHECK (radius_m BETWEEN 20 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_places_org_idx ON public.work_places (org_id);

CREATE TABLE IF NOT EXISTS public.work_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.work_orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('in', 'out', 'attempt')),
  -- When it happened on the phone (may be earlier than created_at when offline).
  at timestamptz NOT NULL,
  place_id uuid REFERENCES public.work_places(id) ON DELETE SET NULL,
  place_kind text CHECK (place_kind IS NULL OR place_kind IN ('office', 'site')),
  latitude double precision,
  longitude double precision,
  accuracy_m real,
  distance_m real,
  verified text NOT NULL CHECK (verified IN ('biometric', 'credential')),
  mock boolean NOT NULL DEFAULT false,
  reason text CHECK (reason IS NULL OR char_length(reason) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Set by the server, so it can't be faked: reached the server 10+ minutes late.
  sent_late boolean GENERATED ALWAYS AS (created_at - at > interval '10 minutes') STORED
);
CREATE INDEX IF NOT EXISTS work_events_org_user_at_idx ON public.work_events (org_id, user_id, at);

CREATE TABLE IF NOT EXISTS public.work_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.work_orgs(id) ON DELETE CASCADE,
  -- Whose day it is.
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  field text NOT NULL CHECK (field IN ('in', 'out', 'leave')),
  -- An ISO time for in/out (null removes it), or a leave type id.
  value text,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 300),
  made_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_corrections_org_user_day_idx ON public.work_corrections (org_id, user_id, day);

CREATE TABLE IF NOT EXISTS public.work_leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.work_orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  day date NOT NULL,
  type_id text NOT NULL CHECK (char_length(type_id) BETWEEN 1 AND 40),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved')),
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, day)
);

DROP TRIGGER IF EXISTS work_orgs_set_updated_at ON public.work_orgs;
CREATE TRIGGER work_orgs_set_updated_at BEFORE UPDATE ON public.work_orgs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Membership checks. SECURITY DEFINER so policies can use them without
-- recursing; they only ever answer about auth.uid().
CREATE OR REPLACE FUNCTION public.is_work_member(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.work_members m WHERE m.org_id = target AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_work_admin(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.work_members m
     WHERE m.org_id = target AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_work_owner(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.work_members m
     WHERE m.org_id = target AND m.user_id = auth.uid() AND m.role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION public.is_work_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_work_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_work_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_work_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_work_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_work_owner(uuid) TO authenticated;

-- Clock events: always as yourself, stamped by the server.
CREATE OR REPLACE FUNCTION public.work_events_stamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.user_id := auth.uid();
  NEW.created_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS work_events_stamp ON public.work_events;
CREATE TRIGGER work_events_stamp BEFORE INSERT ON public.work_events
  FOR EACH ROW EXECUTE FUNCTION public.work_events_stamp();

-- Corrections: made by whoever is signed in, stamped by the server.
CREATE OR REPLACE FUNCTION public.work_corrections_stamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.made_by := auth.uid();
  NEW.created_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS work_corrections_stamp ON public.work_corrections;
CREATE TRIGGER work_corrections_stamp BEFORE INSERT ON public.work_corrections
  FOR EACH ROW EXECUTE FUNCTION public.work_corrections_stamp();

-- Roles: only the owner changes them, and the owner stays the owner.
CREATE OR REPLACE FUNCTION public.work_members_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.org_id <> OLD.org_id OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'A membership can''t move' USING ERRCODE = '42501';
  END IF;
  IF NEW.role <> OLD.role THEN
    IF OLD.role = 'owner' OR NEW.role = 'owner' THEN
      RAISE EXCEPTION 'The owner stays the owner' USING ERRCODE = '42501';
    END IF;
    IF NOT public.is_work_owner(NEW.org_id) THEN
      RAISE EXCEPTION 'Only the owner changes roles' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS work_members_guard ON public.work_members;
CREATE TRIGGER work_members_guard BEFORE UPDATE ON public.work_members
  FOR EACH ROW EXECUTE FUNCTION public.work_members_guard();

ALTER TABLE public.work_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_leaves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_orgs_select ON public.work_orgs;
DROP POLICY IF EXISTS work_orgs_update ON public.work_orgs;
DROP POLICY IF EXISTS work_orgs_delete ON public.work_orgs;
CREATE POLICY work_orgs_select ON public.work_orgs FOR SELECT TO authenticated
  USING (public.is_work_member(id));
CREATE POLICY work_orgs_update ON public.work_orgs FOR UPDATE TO authenticated
  USING (public.is_work_admin(id)) WITH CHECK (public.is_work_admin(id));
CREATE POLICY work_orgs_delete ON public.work_orgs FOR DELETE TO authenticated
  USING (public.is_work_owner(id));

-- Member rows hold salaries: your own, or everyone's for owners and admins.
DROP POLICY IF EXISTS work_members_select ON public.work_members;
DROP POLICY IF EXISTS work_members_update ON public.work_members;
DROP POLICY IF EXISTS work_members_delete ON public.work_members;
CREATE POLICY work_members_select ON public.work_members FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.is_work_admin(org_id));
CREATE POLICY work_members_update ON public.work_members FOR UPDATE TO authenticated
  USING (public.is_work_admin(org_id)) WITH CHECK (public.is_work_admin(org_id));
-- Leave yourself (not as owner), or an admin removes a non-owner.
CREATE POLICY work_members_delete ON public.work_members FOR DELETE TO authenticated
  USING (role <> 'owner' AND (user_id = (select auth.uid()) OR public.is_work_admin(org_id)));

DROP POLICY IF EXISTS work_places_select ON public.work_places;
DROP POLICY IF EXISTS work_places_write ON public.work_places;
CREATE POLICY work_places_select ON public.work_places FOR SELECT TO authenticated
  USING (public.is_work_member(org_id));
CREATE POLICY work_places_write ON public.work_places FOR ALL TO authenticated
  USING (public.is_work_admin(org_id)) WITH CHECK (public.is_work_admin(org_id));

-- Events: insert as yourself into your company; read yours (admins: all).
-- No update or delete policy, so nobody can change or remove one.
DROP POLICY IF EXISTS work_events_insert ON public.work_events;
DROP POLICY IF EXISTS work_events_select ON public.work_events;
CREATE POLICY work_events_insert ON public.work_events FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()) AND public.is_work_member(org_id));
CREATE POLICY work_events_select ON public.work_events FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.is_work_admin(org_id));

-- Corrections: admins add them; you see the ones about your days.
DROP POLICY IF EXISTS work_corrections_insert ON public.work_corrections;
DROP POLICY IF EXISTS work_corrections_select ON public.work_corrections;
CREATE POLICY work_corrections_insert ON public.work_corrections FOR INSERT TO authenticated
  WITH CHECK (
    public.is_work_admin(org_id)
    AND EXISTS (SELECT 1 FROM public.work_members m WHERE m.org_id = work_corrections.org_id AND m.user_id = work_corrections.user_id)
  );
CREATE POLICY work_corrections_select ON public.work_corrections FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.is_work_admin(org_id));

-- Leave: ask for your own; admins add, approve and remove.
DROP POLICY IF EXISTS work_leaves_select ON public.work_leaves;
DROP POLICY IF EXISTS work_leaves_insert ON public.work_leaves;
DROP POLICY IF EXISTS work_leaves_update ON public.work_leaves;
DROP POLICY IF EXISTS work_leaves_delete ON public.work_leaves;
CREATE POLICY work_leaves_select ON public.work_leaves FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.is_work_admin(org_id));
CREATE POLICY work_leaves_insert ON public.work_leaves FOR INSERT TO authenticated
  WITH CHECK (
    public.is_work_admin(org_id)
    OR (user_id = (select auth.uid()) AND status = 'requested' AND public.is_work_member(org_id))
  );
CREATE POLICY work_leaves_update ON public.work_leaves FOR UPDATE TO authenticated
  USING (public.is_work_admin(org_id)) WITH CHECK (public.is_work_admin(org_id));
CREATE POLICY work_leaves_delete ON public.work_leaves FOR DELETE TO authenticated
  USING (public.is_work_admin(org_id) OR (user_id = (select auth.uid()) AND status = 'requested'));

-- A fresh, unused invite code (no 0/O/1/I to misread).
CREATE OR REPLACE FUNCTION public.new_work_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.work_orgs o WHERE o.invite_code = code);
  END LOOP;
  RETURN code;
END;
$$;
REVOKE ALL ON FUNCTION public.new_work_code() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_work_org(org_name text, my_name text, org_rules jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000'; END IF;
  IF (SELECT count(*) FROM public.work_members m WHERE m.user_id = uid AND m.role = 'owner') >= 5 THEN
    RAISE EXCEPTION 'You own 5 companies already' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.work_orgs (name, invite_code, rules, created_by)
    VALUES (left(trim(org_name), 60), public.new_work_code(), coalesce(org_rules, '{}'::jsonb), uid)
    RETURNING id INTO new_id;
  INSERT INTO public.work_members (org_id, user_id, display_name, role)
    VALUES (new_id, uid, left(coalesce(nullif(trim(my_name), ''), 'Me'), 40), 'owner');
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_work_org(code text, my_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := auth.uid();
  target uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000'; END IF;
  SELECT o.id INTO target FROM public.work_orgs o WHERE o.invite_code = upper(trim(code));
  IF target IS NULL THEN RAISE EXCEPTION 'No company has that code' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.work_members (org_id, user_id, display_name, role)
    VALUES (target, uid, left(coalesce(nullif(trim(my_name), ''), 'Me'), 40), 'member')
    ON CONFLICT (org_id, user_id) DO NOTHING;
  RETURN target;
END;
$$;

-- Admins: a new code, so the old one stops working.
CREATE OR REPLACE FUNCTION public.renew_work_code(target uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  code text;
BEGIN
  IF NOT public.is_work_admin(target) THEN
    RAISE EXCEPTION 'Only an admin can do that' USING ERRCODE = '42501';
  END IF;
  code := public.new_work_code();
  UPDATE public.work_orgs SET invite_code = code WHERE id = target;
  RETURN code;
END;
$$;

REVOKE ALL ON FUNCTION public.create_work_org(text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_work_org(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.renew_work_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_work_org(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_work_org(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renew_work_code(uuid) TO authenticated;
