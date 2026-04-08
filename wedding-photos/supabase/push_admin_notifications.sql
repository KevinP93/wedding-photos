create extension if not exists pgcrypto;

alter table public.notifications
  alter column photo_id drop not null;

alter table public.notifications
  alter column album_id drop not null;

alter table public.notifications
  add column if not exists title text;

alter table public.notifications
  add column if not exists message text;

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('photo_tag', 'admin_announcement'));

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id, created_at desc);

create or replace function public.set_push_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_push_subscription_updated_at on public.push_subscriptions;

create trigger set_push_subscription_updated_at
before update on public.push_subscriptions
for each row
execute function public.set_push_subscription_updated_at();

alter table public.push_subscriptions enable row level security;

drop policy if exists "users can read their push subscriptions" on public.push_subscriptions;
drop policy if exists "users can insert their push subscriptions" on public.push_subscriptions;
drop policy if exists "users can update their push subscriptions" on public.push_subscriptions;
drop policy if exists "users can delete their push subscriptions" on public.push_subscriptions;

create policy "users can read their push subscriptions"
on public.push_subscriptions
for select
to authenticated
using (user_id = auth.uid());

create policy "users can insert their push subscriptions"
on public.push_subscriptions
for insert
to authenticated
with check (user_id = auth.uid());

create policy "users can update their push subscriptions"
on public.push_subscriptions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete their push subscriptions"
on public.push_subscriptions
for delete
to authenticated
using (user_id = auth.uid());
