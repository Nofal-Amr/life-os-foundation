-- One-off check of the work tables' access rules. Run it inside a transaction
-- that is rolled back (nothing stays): BEGIN; <this file>; ROLLBACK;
-- Two throwaway users: A makes a company, B joins it.
INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'work-a@test.invalid'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'work-b@test.invalid');

DO $$
DECLARE
  a uuid := '00000000-0000-4000-8000-0000000000a1';
  b uuid := '00000000-0000-4000-8000-0000000000b1';
  org uuid;
  code text;
  n int;
  failed boolean;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- A makes the company and records a clock-in; sets their own salary.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  org := public.create_work_org('Test Co', 'A', '{}'::jsonb);
  SELECT invite_code INTO code FROM public.work_orgs WHERE id = org;
  UPDATE public.work_members SET base_salary = 9500 WHERE org_id = org AND user_id = a;
  INSERT INTO public.work_events (org_id, kind, at, verified) VALUES (org, 'in', now(), 'biometric');

  -- B joins.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM public.join_work_org(code, 'B');

  -- B can't see A's member row (salary) or A's events.
  SELECT count(*) INTO n FROM public.work_members WHERE org_id = org AND user_id = a;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: B sees A''s member row'; END IF;
  SELECT count(*) INTO n FROM public.work_events WHERE org_id = org AND user_id = a;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: B sees A''s events'; END IF;

  -- B's insert as A is stamped as B.
  INSERT INTO public.work_events (org_id, user_id, kind, at, verified) VALUES (org, a, 'in', now(), 'biometric');
  SELECT count(*) INTO n FROM public.work_events WHERE org_id = org AND user_id = b;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: an event inserted for A was not stamped as B'; END IF;

  -- B can't edit or delete an event, not even their own.
  UPDATE public.work_events SET at = now() - interval '1 day' WHERE org_id = org;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: B updated an event'; END IF;
  DELETE FROM public.work_events WHERE org_id = org;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: B deleted an event'; END IF;

  -- B can't raise their own salary or make themselves admin.
  UPDATE public.work_members SET base_salary = 99999 WHERE org_id = org AND user_id = b;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: B changed their own salary'; END IF;

  -- B can't add a correction or an approved leave.
  failed := false;
  BEGIN
    INSERT INTO public.work_corrections (org_id, user_id, day, field, value, reason)
      VALUES (org, b, current_date, 'in', now()::text, 'test');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'FAIL: B added a correction'; END IF;
  failed := false;
  BEGIN
    INSERT INTO public.work_leaves (org_id, day, type_id, status) VALUES (org, current_date, 'with', 'approved');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'FAIL: B approved their own leave'; END IF;

  -- A (owner) sees both members and both events, and can correct B's day.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM public.work_members WHERE org_id = org;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: owner sees % members', n; END IF;
  SELECT count(*) INTO n FROM public.work_events WHERE org_id = org;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: owner sees % events', n; END IF;
  INSERT INTO public.work_corrections (org_id, user_id, day, field, value, reason)
    VALUES (org, b, current_date, 'out', now()::text, 'Forgot to clock out');

  -- The owner can't stop being the owner.
  failed := false;
  BEGIN
    UPDATE public.work_members SET role = 'member' WHERE org_id = org AND user_id = a;
  EXCEPTION WHEN insufficient_privilege THEN failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'FAIL: the owner was demoted'; END IF;

  RAISE NOTICE 'work RLS check: all passed';
END;
$$;
