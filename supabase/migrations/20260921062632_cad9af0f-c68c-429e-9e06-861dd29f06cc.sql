-- Task scheduling and estimate units
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS max_date date,
  ADD COLUMN IF NOT EXISTS estimate_unit text;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_estimate_unit_check
  CHECK (estimate_unit IS NULL OR estimate_unit IN ('minutes','hours','days'));

-- Resource cycles in real calendar months
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS cycle_unit text,
  ADD COLUMN IF NOT EXISTS cycle_count integer;

ALTER TABLE public.resources
  ADD CONSTRAINT resources_cycle_unit_check
  CHECK (cycle_unit IS NULL OR cycle_unit IN ('days','months'));

-- Sleep and vitals read off a watch
ALTER TABLE public.health_logs
  ADD COLUMN IF NOT EXISTS sleep_score integer,
  ADD COLUMN IF NOT EXISTS sleep_source text,
  ADD COLUMN IF NOT EXISTS sleep_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS sleep_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS time_in_bed_minutes integer,
  ADD COLUMN IF NOT EXISTS actual_sleep_minutes integer,
  ADD COLUMN IF NOT EXISTS deep_sleep_minutes integer,
  ADD COLUMN IF NOT EXISTS rem_sleep_minutes integer,
  ADD COLUMN IF NOT EXISTS light_sleep_minutes integer,
  ADD COLUMN IF NOT EXISTS awake_minutes integer,
  ADD COLUMN IF NOT EXISTS sleep_latency_minutes integer,
  ADD COLUMN IF NOT EXISTS blood_oxygen_avg numeric,
  ADD COLUMN IF NOT EXISTS heart_rate_avg numeric,
  ADD COLUMN IF NOT EXISTS respiratory_rate_avg numeric;

ALTER TABLE public.health_logs
  ADD CONSTRAINT health_logs_sleep_score_check
  CHECK (sleep_score IS NULL OR (sleep_score >= 0 AND sleep_score <= 100));