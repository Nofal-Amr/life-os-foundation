
-- Enums
create type public.project_status as enum ('planning','active','on_hold','completed','archived');
create type public.priority_level as enum ('low','medium','high','critical');
create type public.task_status as enum ('inbox','todo','in_progress','waiting','completed','cancelled');
create type public.habit_frequency as enum ('daily','weekly');
create type public.goal_status as enum ('not_started','active','completed','archived');

-- shared updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles for delete to authenticated using (auth.uid() = user_id);
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- auto profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (user_id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  status public.project_status not null default 'planning',
  priority public.priority_level not null default 'medium',
  start_date date,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;
create policy "projects_select_own" on public.projects for select to authenticated using (auth.uid() = user_id);
create policy "projects_insert_own" on public.projects for insert to authenticated with check (auth.uid() = user_id);
create policy "projects_update_own" on public.projects for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "projects_delete_own" on public.projects for delete to authenticated using (auth.uid() = user_id);
create index projects_user_id_idx on public.projects(user_id);
create index projects_status_idx on public.projects(user_id, status);
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();

-- tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text,
  status public.task_status not null default 'inbox',
  priority public.priority_level not null default 'medium',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
alter table public.tasks enable row level security;
create policy "tasks_select_own" on public.tasks for select to authenticated using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.tasks for insert to authenticated with check (
  auth.uid() = user_id and (project_id is null or exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
);
create policy "tasks_update_own" on public.tasks for update to authenticated using (auth.uid() = user_id) with check (
  auth.uid() = user_id and (project_id is null or exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
);
create policy "tasks_delete_own" on public.tasks for delete to authenticated using (auth.uid() = user_id);
create index tasks_user_id_idx on public.tasks(user_id);
create index tasks_project_id_idx on public.tasks(project_id);
create index tasks_due_date_idx on public.tasks(user_id, due_date);
create index tasks_status_idx on public.tasks(user_id, status);
create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();

-- habits
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  frequency public.habit_frequency not null default 'daily',
  target integer not null default 1 check (target > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.habits to authenticated;
grant all on public.habits to service_role;
alter table public.habits enable row level security;
create policy "habits_select_own" on public.habits for select to authenticated using (auth.uid() = user_id);
create policy "habits_insert_own" on public.habits for insert to authenticated with check (auth.uid() = user_id);
create policy "habits_update_own" on public.habits for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habits_delete_own" on public.habits for delete to authenticated using (auth.uid() = user_id);
create index habits_user_id_idx on public.habits(user_id);
create trigger habits_set_updated_at before update on public.habits for each row execute function public.set_updated_at();

-- habit_logs
create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  log_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date)
);
grant select, insert, update, delete on public.habit_logs to authenticated;
grant all on public.habit_logs to service_role;
alter table public.habit_logs enable row level security;
create policy "habit_logs_select_own" on public.habit_logs for select to authenticated using (auth.uid() = user_id);
create policy "habit_logs_insert_own" on public.habit_logs for insert to authenticated with check (
  auth.uid() = user_id and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = auth.uid())
);
create policy "habit_logs_update_own" on public.habit_logs for update to authenticated using (auth.uid() = user_id) with check (
  auth.uid() = user_id and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = auth.uid())
);
create policy "habit_logs_delete_own" on public.habit_logs for delete to authenticated using (auth.uid() = user_id);
create index habit_logs_user_id_idx on public.habit_logs(user_id);
create index habit_logs_habit_date_idx on public.habit_logs(habit_id, log_date desc);

-- goals
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  category text,
  target_date date,
  status public.goal_status not null default 'not_started',
  progress integer not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.goals to authenticated;
grant all on public.goals to service_role;
alter table public.goals enable row level security;
create policy "goals_select_own" on public.goals for select to authenticated using (auth.uid() = user_id);
create policy "goals_insert_own" on public.goals for insert to authenticated with check (auth.uid() = user_id);
create policy "goals_update_own" on public.goals for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals_delete_own" on public.goals for delete to authenticated using (auth.uid() = user_id);
create index goals_user_id_idx on public.goals(user_id);
create trigger goals_set_updated_at before update on public.goals for each row execute function public.set_updated_at();

-- notes
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.notes to authenticated;
grant all on public.notes to service_role;
alter table public.notes enable row level security;
create policy "notes_select_own" on public.notes for select to authenticated using (auth.uid() = user_id);
create policy "notes_insert_own" on public.notes for insert to authenticated with check (auth.uid() = user_id);
create policy "notes_update_own" on public.notes for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes_delete_own" on public.notes for delete to authenticated using (auth.uid() = user_id);
create index notes_user_id_idx on public.notes(user_id);
create index notes_tags_idx on public.notes using gin(tags);
create trigger notes_set_updated_at before update on public.notes for each row execute function public.set_updated_at();

-- events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at is null or end_at >= start_at)
);
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "events_select_own" on public.events for select to authenticated using (auth.uid() = user_id);
create policy "events_insert_own" on public.events for insert to authenticated with check (auth.uid() = user_id);
create policy "events_update_own" on public.events for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "events_delete_own" on public.events for delete to authenticated using (auth.uid() = user_id);
create index events_user_start_idx on public.events(user_id, start_at);
create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();

-- daily_reviews
create table public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_date date not null default current_date,
  wins text,
  challenges text,
  gratitude text,
  mood integer check (mood between 1 and 5),
  tomorrow_focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, review_date)
);
grant select, insert, update, delete on public.daily_reviews to authenticated;
grant all on public.daily_reviews to service_role;
alter table public.daily_reviews enable row level security;
create policy "daily_reviews_select_own" on public.daily_reviews for select to authenticated using (auth.uid() = user_id);
create policy "daily_reviews_insert_own" on public.daily_reviews for insert to authenticated with check (auth.uid() = user_id);
create policy "daily_reviews_update_own" on public.daily_reviews for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_reviews_delete_own" on public.daily_reviews for delete to authenticated using (auth.uid() = user_id);
create index daily_reviews_user_date_idx on public.daily_reviews(user_id, review_date desc);
create trigger daily_reviews_set_updated_at before update on public.daily_reviews for each row execute function public.set_updated_at();
