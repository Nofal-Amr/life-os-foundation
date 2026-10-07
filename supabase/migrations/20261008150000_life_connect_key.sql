-- Life Connect: one random secret per account, shared by that account's own
-- phones (row-level security already limits user_preferences to its owner).
-- The phones derive the relay channel name and the encryption key from it;
-- the secret itself never goes over the relay.
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS connect_key text;
ALTER TABLE public.user_preferences DROP CONSTRAINT IF EXISTS user_preferences_connect_key_check;
ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_connect_key_check
  CHECK (connect_key IS NULL OR connect_key ~ '^[0-9a-f]{64}$');
