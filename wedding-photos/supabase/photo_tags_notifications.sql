create table if not exists public.photo_tags (
  photo_id uuid not null references public.photos(id) on delete cascade,
  tagged_user_id uuid not null references public.profiles(id) on delete cascade,
  tagged_by_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, tagged_user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  album_id uuid not null references public.albums(id) on delete cascade,
  type text not null default 'photo_tag' check (type in ('photo_tag')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists photo_tags_tagged_user_idx
  on public.photo_tags (tagged_user_id, created_at desc);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);

create index if not exists notifications_recipient_is_read_idx
  on public.notifications (recipient_user_id, is_read);

alter table public.photo_tags enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "photo tags are readable by authenticated users" on public.photo_tags;
drop policy if exists "owners or admins can insert photo tags" on public.photo_tags;
drop policy if exists "owners or admins can delete photo tags" on public.photo_tags;
drop policy if exists "users can read their notifications" on public.notifications;
drop policy if exists "users can update their notifications" on public.notifications;

create policy "photo tags are readable by authenticated users"
on public.photo_tags
for select
to authenticated
using (true);

create policy "owners or admins can insert photo tags"
on public.photo_tags
for insert
to authenticated
with check (
  tagged_by_user_id = auth.uid()
  and exists (
    select 1
    from public.photos p
    where p.id = photo_id
      and (p.uploaded_by = auth.uid() or public.is_current_user_admin())
  )
);

create policy "owners or admins can delete photo tags"
on public.photo_tags
for delete
to authenticated
using (
  exists (
    select 1
    from public.photos p
    where p.id = photo_id
      and (p.uploaded_by = auth.uid() or public.is_current_user_admin())
  )
);

create policy "users can read their notifications"
on public.notifications
for select
to authenticated
using (recipient_user_id = auth.uid() or public.is_current_user_admin());

create policy "users can update their notifications"
on public.notifications
for update
to authenticated
using (recipient_user_id = auth.uid() or public.is_current_user_admin())
with check (recipient_user_id = auth.uid() or public.is_current_user_admin());

create or replace function public.tag_photo_users(
  p_photo_id uuid,
  p_tagged_user_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  photo_owner_id uuid;
  photo_album_id uuid;
  target_user_id uuid;
begin
  if current_user_id is null then
    raise exception 'Connexion requise.';
  end if;

  select p.uploaded_by, p.album_id
  into photo_owner_id, photo_album_id
  from public.photos p
  where p.id = p_photo_id;

  if photo_owner_id is null or photo_album_id is null then
    raise exception 'Photo introuvable.';
  end if;

  if photo_owner_id <> current_user_id and not public.is_current_user_admin() then
    raise exception 'Action non autorisée.';
  end if;

  if p_tagged_user_ids is null or coalesce(array_length(p_tagged_user_ids, 1), 0) = 0 then
    return;
  end if;

  foreach target_user_id in array p_tagged_user_ids loop
    if target_user_id is null or target_user_id = current_user_id then
      continue;
    end if;

    if not exists (
      select 1
      from public.profiles
      where id = target_user_id
    ) then
      continue;
    end if;

    insert into public.photo_tags (
      photo_id,
      tagged_user_id,
      tagged_by_user_id
    )
    values (
      p_photo_id,
      target_user_id,
      current_user_id
    )
    on conflict (photo_id, tagged_user_id) do nothing;

    if found then
      insert into public.notifications (
        recipient_user_id,
        actor_user_id,
        photo_id,
        album_id,
        type,
        is_read
      )
      values (
        target_user_id,
        current_user_id,
        p_photo_id,
        photo_album_id,
        'photo_tag',
        false
      );
    end if;
  end loop;
end;
$$;

grant execute on function public.tag_photo_users(uuid, uuid[]) to authenticated;
