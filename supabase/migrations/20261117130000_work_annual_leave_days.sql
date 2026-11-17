-- Each worker's paid vacation days a year, set by HR / the company's admins.
-- Applied to production on 2026-11-17 with the owner's OK ("YES TO BOTH").
alter table public.work_members
  add column if not exists annual_leave_days numeric(5,1) not null default 0
  check (annual_leave_days >= 0);
