-- Money an admin adds to someone's pay: an incentive, a transport allowance,
-- or anything else; once (from_month = until_month) or every month until
-- stopped (until_month null). Admins add, stop and remove; you see your own.
create table if not exists public.work_pay_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.work_orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('incentive', 'allowance', 'other')),
  label text not null check (char_length(label) between 1 and 80),
  amount numeric(12,2) not null check (amount > 0),
  from_month date not null check (extract(day from from_month) = 1),
  until_month date check (until_month is null or until_month >= from_month),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists work_pay_items_org_user_idx on public.work_pay_items (org_id, user_id);

alter table public.work_pay_items enable row level security;

create policy work_pay_items_select on public.work_pay_items for select to authenticated
  using (user_id = (select auth.uid()) or public.is_work_admin(org_id));
create policy work_pay_items_insert on public.work_pay_items for insert to authenticated
  with check (
    public.is_work_admin(org_id)
    and exists (select 1 from public.work_members m
                 where m.org_id = work_pay_items.org_id and m.user_id = work_pay_items.user_id)
  );
create policy work_pay_items_update on public.work_pay_items for update to authenticated
  using (public.is_work_admin(org_id)) with check (public.is_work_admin(org_id));
create policy work_pay_items_delete on public.work_pay_items for delete to authenticated
  using (public.is_work_admin(org_id));
