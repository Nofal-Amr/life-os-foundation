-- Google Calendar sync. NOT APPLIED: needs the owner's written approval first.
--
-- google_calendar_connections: one row per person who connected Google Calendar.
--   The refresh token is encrypted on the server (AES-256-GCM, key in the
--   GOOGLE_TOKEN_KEY environment variable) before it is stored, so this column
--   is useless without the server key. Access tokens are never stored.
-- google_event_links: which Life OS event matches which Google event, so edits
--   and deletes go to the right place. event_id becomes null when the Life OS
--   event is deleted, so the next sync can delete it in Google too.
--
-- Access: each person reads and changes only their own rows. Everything is
-- removed with the account.

CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_email text,
  refresh_token_enc text NOT NULL,
  scopes text NOT NULL,
  read_calendar_ids text[] NOT NULL DEFAULT '{}',
  write_calendar_id text,
  sync_enabled boolean NOT NULL DEFAULT false,
  sync_tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.google_event_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  calendar_id text NOT NULL,
  google_event_id text NOT NULL,
  etag text,
  google_updated_at timestamptz,
  lifeos_synced_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  origin text NOT NULL CHECK (origin IN ('google', 'lifeos')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, calendar_id, google_event_id)
);
CREATE INDEX IF NOT EXISTS google_event_links_event_idx ON public.google_event_links (event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_event_links TO authenticated;
GRANT ALL ON public.google_calendar_connections TO service_role;
GRANT ALL ON public.google_event_links TO service_role;

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_event_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gcal_connections_own" ON public.google_calendar_connections
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gcal_links_own" ON public.google_event_links
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER google_calendar_connections_set_updated_at
  BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
