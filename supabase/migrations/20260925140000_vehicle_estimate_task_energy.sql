-- A vehicle's own "a full tank lasts about … km", task energy for
-- "match my energy" on Today, and tighter execute rights on trigger helpers.

-- 1. Vehicles: the tank size uses resources.quota_amount (litres); this is
--    the starting estimate of how far a full tank goes, until fill-ups say.
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS full_tank_km numeric;
ALTER TABLE public.resources DROP CONSTRAINT IF EXISTS resources_full_tank_km_check;
ALTER TABLE public.resources
  ADD CONSTRAINT resources_full_tank_km_check CHECK (full_tank_km IS NULL OR full_tank_km > 0);

-- 2. Tasks: how much energy a task needs (1 low, 2 medium, 3 high), optional.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS energy smallint;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_energy_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_energy_check CHECK (energy IS NULL OR energy BETWEEN 1 AND 3);

-- 3. Trigger helpers are only meant to run as triggers, never through the API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
