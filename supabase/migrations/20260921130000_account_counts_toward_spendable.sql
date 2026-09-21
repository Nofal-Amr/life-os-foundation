-- Accounts can be tracked without counting toward "left to spend before payday"
-- (for example a home fund kept apart from personal money).
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS counts_toward_spendable boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.accounts.counts_toward_spendable IS
  'When false, the account is still tracked but left out of the left-to-spend figure.';
