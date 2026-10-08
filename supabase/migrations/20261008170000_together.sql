-- Together: small shared spaces ("pods") for family or friends, joined with
-- a 6-letter invite code. A space holds only what its members put in it — a
-- shared calendar and shared lists. Nothing from anyone's own Life OS data is
-- visible to anyone else.
--
-- Access rule everywhere: you can see and change a space's things only while
-- you're a member of it. Joining goes through join_pod(code), so nobody can
-- list spaces or read codes; leaving deletes your membership row.

CREATE TABLE IF NOT EXISTS public.pods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  invite_code text NOT NULL UNIQUE CHECK (invite_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pod_members (
  pod_id uuid NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pod_id, user_id)
);
CREATE INDEX IF NOT EXISTS pod_members_user_idx ON public.pod_members (user_id);

CREATE TABLE IF NOT EXISTS public.pod_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  note text CHECK (note IS NULL OR char_length(note) <= 1000),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX IF NOT EXISTS pod_events_pod_time_idx ON public.pod_events (pod_id, starts_at);

CREATE TABLE IF NOT EXISTS public.pod_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pod_lists_pod_idx ON public.pod_lists (pod_id);

CREATE TABLE IF NOT EXISTS public.pod_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.pod_lists(id) ON DELETE CASCADE,
  pod_id uuid NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 300),
  done boolean NOT NULL DEFAULT false,
  done_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pod_list_items_list_idx ON public.pod_list_items (list_id, position);

DROP TRIGGER IF EXISTS pod_events_set_updated_at ON public.pod_events;
CREATE TRIGGER pod_events_set_updated_at BEFORE UPDATE ON public.pod_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS pod_list_items_set_updated_at ON public.pod_list_items;
CREATE TRIGGER pod_list_items_set_updated_at BEFORE UPDATE ON public.pod_list_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Membership checks. SECURITY DEFINER so policies on pod_members can use them
-- without recursing; they only ever answer about auth.uid().
CREATE OR REPLACE FUNCTION public.is_pod_member(target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pod_members m WHERE m.pod_id = target AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_pod_owner(target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pod_members m
     WHERE m.pod_id = target AND m.user_id = auth.uid() AND m.role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION public.is_pod_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_pod_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_pod_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pod_owner(uuid) TO authenticated;

ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_list_items ENABLE ROW LEVEL SECURITY;

-- Spaces: members see them; only the owner renames or deletes. Creating goes
-- through create_pod() so the creator is always the first (owner) member.
DROP POLICY IF EXISTS pods_select ON public.pods;
DROP POLICY IF EXISTS pods_update ON public.pods;
DROP POLICY IF EXISTS pods_delete ON public.pods;
CREATE POLICY pods_select ON public.pods FOR SELECT TO authenticated USING (public.is_pod_member(id));
CREATE POLICY pods_update ON public.pods FOR UPDATE TO authenticated
  USING (public.is_pod_owner(id)) WITH CHECK (public.is_pod_owner(id));
CREATE POLICY pods_delete ON public.pods FOR DELETE TO authenticated USING (public.is_pod_owner(id));

-- Members: see who's in your spaces; leave; the owner can remove others.
-- Joining is only through join_pod(), renaming yourself through
-- rename_me_in_pod(), so nobody can make themselves owner.
DROP POLICY IF EXISTS pod_members_select ON public.pod_members;
DROP POLICY IF EXISTS pod_members_update ON public.pod_members;
DROP POLICY IF EXISTS pod_members_delete ON public.pod_members;
CREATE POLICY pod_members_select ON public.pod_members FOR SELECT TO authenticated
  USING (public.is_pod_member(pod_id));
CREATE POLICY pod_members_delete ON public.pod_members FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()) OR public.is_pod_owner(pod_id));

-- Shared things: any member of the space.
DROP POLICY IF EXISTS pod_events_all ON public.pod_events;
CREATE POLICY pod_events_all ON public.pod_events FOR ALL TO authenticated
  USING (public.is_pod_member(pod_id)) WITH CHECK (public.is_pod_member(pod_id));
DROP POLICY IF EXISTS pod_lists_all ON public.pod_lists;
CREATE POLICY pod_lists_all ON public.pod_lists FOR ALL TO authenticated
  USING (public.is_pod_member(pod_id)) WITH CHECK (public.is_pod_member(pod_id));
DROP POLICY IF EXISTS pod_list_items_all ON public.pod_list_items;
CREATE POLICY pod_list_items_all ON public.pod_list_items FOR ALL TO authenticated
  USING (public.is_pod_member(pod_id))
  WITH CHECK (
    public.is_pod_member(pod_id)
    AND EXISTS (SELECT 1 FROM public.pod_lists l WHERE l.id = list_id AND l.pod_id = pod_list_items.pod_id)
  );

-- A fresh, unused invite code (no 0/O/1/I to misread).
CREATE OR REPLACE FUNCTION public.new_pod_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.pods p WHERE p.invite_code = code);
  END LOOP;
  RETURN code;
END;
$$;
REVOKE ALL ON FUNCTION public.new_pod_code() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_pod(pod_name text, my_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000'; END IF;
  IF (SELECT count(*) FROM public.pod_members m WHERE m.user_id = uid) >= 10 THEN
    RAISE EXCEPTION 'You are in 10 spaces already' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.pods (name, invite_code, created_by)
    VALUES (left(trim(pod_name), 60), public.new_pod_code(), uid)
    RETURNING id INTO new_id;
  INSERT INTO public.pod_members (pod_id, user_id, display_name, role)
    VALUES (new_id, uid, left(coalesce(nullif(trim(my_name), ''), 'Me'), 40), 'owner');
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_pod(code text, my_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  target uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000'; END IF;
  SELECT p.id INTO target FROM public.pods p WHERE p.invite_code = upper(trim(code));
  IF target IS NULL THEN RAISE EXCEPTION 'No space has that code' USING ERRCODE = 'P0002'; END IF;
  IF (SELECT count(*) FROM public.pod_members m WHERE m.pod_id = target) >= 12 THEN
    RAISE EXCEPTION 'That space is full' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.pod_members (pod_id, user_id, display_name, role)
    VALUES (target, uid, left(coalesce(nullif(trim(my_name), ''), 'Me'), 40), 'member')
    ON CONFLICT (pod_id, user_id) DO NOTHING;
  RETURN target;
END;
$$;

-- Owner only: a new code, so the old one stops working.
CREATE OR REPLACE FUNCTION public.renew_pod_code(target uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  code text;
BEGIN
  IF NOT public.is_pod_owner(target) THEN
    RAISE EXCEPTION 'Only the owner can do that' USING ERRCODE = '42501';
  END IF;
  code := public.new_pod_code();
  UPDATE public.pods SET invite_code = code WHERE id = target;
  RETURN code;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pod(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_pod(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.renew_pod_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pod(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_pod(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renew_pod_code(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rename_me_in_pod(target uuid, my_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.pod_members
     SET display_name = left(coalesce(nullif(trim(my_name), ''), 'Me'), 40)
   WHERE pod_id = target AND user_id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.rename_me_in_pod(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_me_in_pod(uuid, text) TO authenticated;

-- Someone left (or deleted their account): if the owner went, the member who
-- joined first takes over; an empty space is removed with everything in it.
CREATE OR REPLACE FUNCTION public.pod_member_left()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pod_members m WHERE m.pod_id = OLD.pod_id) THEN
    DELETE FROM public.pods WHERE id = OLD.pod_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.pod_members m WHERE m.pod_id = OLD.pod_id AND m.role = 'owner'
  ) THEN
    UPDATE public.pod_members SET role = 'owner'
     WHERE pod_id = OLD.pod_id
       AND user_id = (
         SELECT m.user_id FROM public.pod_members m
          WHERE m.pod_id = OLD.pod_id ORDER BY m.joined_at LIMIT 1
       );
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.pod_member_left() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS pod_members_after_delete ON public.pod_members;
CREATE TRIGGER pod_members_after_delete AFTER DELETE ON public.pod_members
  FOR EACH ROW EXECUTE FUNCTION public.pod_member_left();
