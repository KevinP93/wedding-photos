create extension if not exists pgcrypto;
create extension if not exists unaccent;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'profiles_display_name_key'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles drop constraint profiles_display_name_key;
  end if;
end
$$;

alter table public.profiles
  add column if not exists username text,
  add column if not exists avatar_url text,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.normalize_username(input_name text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      regexp_replace(
        regexp_replace(lower(unaccent(trim(input_name))), '[^a-z0-9]+', '-', 'g'),
        '(^-+|-+$)',
        '',
        'g'
      ),
      ''
    ),
    'invite'
  );
$$;

with prepared_profiles as (
  select
    p.id,
    public.normalize_username(p.display_name) as base_username,
    row_number() over (
      partition by public.normalize_username(p.display_name)
      order by p.created_at, p.id
    ) as duplicate_rank
  from public.profiles p
  where p.username is null or trim(p.username) = ''
)
update public.profiles p
set username = case
  when prepared_profiles.duplicate_rank = 1 then prepared_profiles.base_username
  else prepared_profiles.base_username || '-' || prepared_profiles.duplicate_rank
end,
updated_at = now()
from prepared_profiles
where prepared_profiles.id = p.id;

insert into public.profiles (id, username, display_name, role, avatar_url)
select
  au.id,
  public.normalize_username(
    coalesce(
      nullif(trim(au.raw_user_meta_data ->> 'username'), ''),
      split_part(coalesce(au.email, au.phone, au.id::text), '@', 1)
    )
  ) as username,
  coalesce(
    nullif(trim(au.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(au.raw_user_meta_data ->> 'username'), ''),
    split_part(coalesce(au.email, au.phone, au.id::text), '@', 1)
  ) as display_name,
  case
    when coalesce(au.raw_app_meta_data ->> 'role', 'guest') = 'admin' then 'admin'
    else 'guest'
  end as role,
  nullif(trim(au.raw_user_meta_data ->> 'avatar_url'), '') as avatar_url
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null
on conflict (id) do nothing;

update public.profiles
set username = public.normalize_username(username),
    display_name = trim(display_name),
    updated_at = now()
where username is not null;

update public.profiles p
set avatar_url = nullif(trim(au.raw_user_meta_data ->> 'avatar_url'), '')
from auth.users au
where au.id = p.id
  and (p.avatar_url is null or trim(p.avatar_url) = '');

alter table public.profiles
  alter column username set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_key'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_username_key unique (username);
  end if;
end
$$;

insert into public.albums (owner_id, title)
select
  p.id,
  'Album de ' || p.display_name
from public.profiles p
left join public.albums a on a.owner_id = p.id
where a.owner_id is null;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  );
$$;

create or replace function public.handle_auth_user_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text;
  resolved_display_name text;
  resolved_role text;
  resolved_avatar_url text;
begin
  normalized_username := public.normalize_username(
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      split_part(coalesce(new.email, new.phone, new.id::text), '@', 1)
    )
  );

  resolved_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(coalesce(new.email, new.phone, new.id::text), '@', 1)
  );

  resolved_role := case
    when coalesce(new.raw_app_meta_data ->> 'role', 'guest') = 'admin' then 'admin'
    else 'guest'
  end;

  resolved_avatar_url := nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '');

  if exists (
    select 1
    from public.profiles
    where profiles.username = normalized_username
      and profiles.id <> new.id
  ) then
    raise exception 'Ce nom utilisateur existe deja.';
  end if;

  insert into public.profiles (id, username, display_name, role, avatar_url)
  values (new.id, normalized_username, resolved_display_name, resolved_role, resolved_avatar_url)
  on conflict (id) do update
  set username = excluded.username,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      role = case
        when public.profiles.role = 'admin' or excluded.role = 'admin' then 'admin'
        else excluded.role
      end,
      updated_at = now();

  insert into public.albums (owner_id, title)
  values (new.id, 'Album de ' || resolved_display_name)
  on conflict (owner_id) do update
  set title = excluded.title;

  return new;
end;
$$;

drop trigger if exists on_auth_user_sync on auth.users;
create trigger on_auth_user_sync
after insert or update of email, phone, raw_user_meta_data, raw_app_meta_data
on auth.users
for each row
execute function public.handle_auth_user_sync();

create or replace function public.handle_profile_sync_album()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.albums
  set title = 'Album de ' || new.display_name
  where owner_id = new.id;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists on_profile_sync_album on public.profiles;
create trigger on_profile_sync_album
before update of display_name
on public.profiles
for each row
execute function public.handle_profile_sync_album();

create or replace function public.increment_photo_download_count(p_photo_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  update public.photos
  set download_count = download_count + 1
  where id = p_photo_id
  returning download_count into next_count;

  if next_count is null then
    raise exception 'Photo introuvable.';
  end if;

  return next_count;
end;
$$;

grant execute on function public.increment_photo_download_count(uuid) to authenticated;

drop policy if exists "profiles are readable by authenticated users" on public.profiles;
drop policy if exists "users can create their own profile" on public.profiles;
drop policy if exists "users can update their own profile" on public.profiles;
drop policy if exists "albums are readable by authenticated users" on public.albums;
drop policy if exists "users can create their own album" on public.albums;
drop policy if exists "users can update their own album" on public.albums;
drop policy if exists "owners or admins can update albums" on public.albums;
drop policy if exists "owners or admins can delete albums" on public.albums;
drop policy if exists "photos are readable by authenticated users" on public.photos;
drop policy if exists "users can insert photos in their own album" on public.photos;
drop policy if exists "users can delete photos from their own album" on public.photos;
drop policy if exists "owners or admins can delete photos" on public.photos;
drop policy if exists "likes are readable by authenticated users" on public.photo_likes;
drop policy if exists "users can like with their own account" on public.photo_likes;
drop policy if exists "users can remove their own likes" on public.photo_likes;

create policy "profiles are readable by authenticated users"
on public.profiles
for select
to authenticated
using (true);

create policy "users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role = (select profiles.role from public.profiles where profiles.id = auth.uid())
);

create policy "albums are readable by authenticated users"
on public.albums
for select
to authenticated
using (true);

create policy "owners or admins can update albums"
on public.albums
for update
to authenticated
using (owner_id = auth.uid() or public.is_current_user_admin())
with check (owner_id = auth.uid() or public.is_current_user_admin());

create policy "owners or admins can delete albums"
on public.albums
for delete
to authenticated
using (owner_id = auth.uid() or public.is_current_user_admin());

create policy "photos are readable by authenticated users"
on public.photos
for select
to authenticated
using (true);

create policy "users can insert photos in their own album"
on public.photos
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.albums a
    where a.id = album_id
      and a.owner_id = auth.uid()
  )
);

create policy "owners or admins can delete photos"
on public.photos
for delete
to authenticated
using (
  public.is_current_user_admin()
  or exists (
    select 1
    from public.albums a
    where a.id = album_id
      and a.owner_id = auth.uid()
  )
);

create policy "likes are readable by authenticated users"
on public.photo_likes
for select
to authenticated
using (true);

create policy "users can like with their own account"
on public.photo_likes
for insert
to authenticated
with check (user_id = auth.uid());

create policy "users can remove their own likes"
on public.photo_likes
for delete
to authenticated
using (user_id = auth.uid());
