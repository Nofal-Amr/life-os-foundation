-- Lets a signed-in person delete their own account and everything stored for it.
--
-- Runs as the function owner so it can remove the login itself, but only ever
-- for auth.uid(): there is no argument, so nobody can name another account.
-- Every public table with a user_id column is cleared first (tables created
-- outside the repo included), retrying in passes so rows that other rows
-- point at go last. Any failure rolls the whole thing back.
-- Profile pictures in Storage are removed by the app before calling this.

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  remaining text[];
  blocked text[];
  target text;
  pass int := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
  END IF;

  SELECT array_agg(c.table_name::text)
    INTO remaining
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
   WHERE c.table_schema = 'public'
     AND c.column_name = 'user_id'
     AND t.table_type = 'BASE TABLE';

  WHILE remaining IS NOT NULL AND cardinality(remaining) > 0 AND pass < 10 LOOP
    blocked := '{}';
    FOREACH target IN ARRAY remaining LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE user_id::text = $1', target) USING uid::text;
      EXCEPTION WHEN foreign_key_violation THEN
        blocked := blocked || target;
      END;
    END LOOP;
    remaining := blocked;
    pass := pass + 1;
  END LOOP;

  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
