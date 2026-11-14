-- Instant note sync across devices (daily notes). NOT APPLIED: needs the owner's approval.
-- Lets Supabase Realtime send "a note changed" events for public.notes. Row-level security
-- still decides who receives each change, so a user only hears about their own notes.
-- Without it, the app falls back to checking every 4 seconds.
alter publication supabase_realtime add table public.notes;
