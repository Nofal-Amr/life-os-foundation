-- RPG skin: a shop of rewards you set yourself ("coffee out: 30 gold"),
-- bought with gold earned from real XP. Private to each user.
CREATE TABLE IF NOT EXISTS public.rpg_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  cost integer NOT NULL CHECK (cost BETWEEN 1 AND 100000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rpg_rewards_user_idx ON public.rpg_rewards (user_id);

CREATE TABLE IF NOT EXISTS public.rpg_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  cost integer NOT NULL CHECK (cost BETWEEN 1 AND 100000),
  bought_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rpg_purchases_user_idx ON public.rpg_purchases (user_id, bought_at);

ALTER TABLE public.rpg_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpg_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rpg_rewards_own ON public.rpg_rewards;
DROP POLICY IF EXISTS rpg_purchases_own ON public.rpg_purchases;
CREATE POLICY rpg_rewards_own ON public.rpg_rewards FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY rpg_purchases_own ON public.rpg_purchases FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
