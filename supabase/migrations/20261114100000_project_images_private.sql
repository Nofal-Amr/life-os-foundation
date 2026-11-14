-- Project covers: private, like avatars, with the size and type limits the app already shows
-- (src/data/projects.ts). Security audit M1. The app reads covers through signed URLs only, so
-- nothing needs public access.
--
-- The bucket was created outside the migrations, so this also records it: on a fresh database
-- it is created; on the live one its settings are updated. Existing files are not touched.
--
-- Roll back:
--   update storage.buckets
--   set public = true, file_size_limit = null, allowed_mime_types = null
--   where id = 'project-images';
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-images',
  'project-images',
  false,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
