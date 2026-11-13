-- NOT APPLIED. Needs the owner's approval of this exact SQL (staging first).
--
-- Lets a habit count toward a goal, the way a task already can (tasks.goal_id).
-- Optional: existing habits keep goal_id = null and behave as before.
-- Deleting a goal unlinks its habits; it never deletes a habit.
-- Row-level security on habits is unchanged (owner-only), and a goal is only
-- readable by its owner, so a link never exposes another person's goal.

alter table public.habits
  add column if not exists goal_id uuid references public.goals(id) on delete set null;

create index if not exists habits_goal_id_idx on public.habits (goal_id);
