-- Habit categories: which part of life a habit belongs to (health, money,
-- work, spirit, home, mind, people, other), so it can show up there.
-- Empty means "not chosen yet"; the app guesses from the name until then.

ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE public.habits DROP CONSTRAINT IF EXISTS habits_category_check;
ALTER TABLE public.habits ADD CONSTRAINT habits_category_check
  CHECK (category IS NULL OR category IN ('health', 'money', 'work', 'spirit', 'home', 'mind', 'people', 'other'));
