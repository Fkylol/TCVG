-- ============================================================
--  TCVG — schéma Supabase
--  À coller tel quel dans : Dashboard > SQL Editor > New query
-- ============================================================

-- ————— Profils —————
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  last_booster_at timestamptz,
  boosters_opened integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: lecture de son profil" on public.profiles;
create policy "profiles: lecture de son profil"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles: creation de son profil" on public.profiles;
create policy "profiles: creation de son profil"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles: mise a jour de son profil" on public.profiles;
create policy "profiles: mise a jour de son profil"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ————— Collection —————
create table if not exists public.collection (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  quantity integer not null default 1 check (quantity > 0),
  first_obtained_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create index if not exists collection_user_idx on public.collection (user_id);

alter table public.collection enable row level security;

-- Lecture seule côté client : les écritures passent uniquement par open_booster().
drop policy if exists "collection: lecture de sa collection" on public.collection;
create policy "collection: lecture de sa collection"
  on public.collection for select
  using (auth.uid() = user_id);

-- ————— Création automatique du profil à l'inscription —————
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ————— Ouverture de booster (atomique, anti-triche sur le cooldown) —————
create or replace function public.open_booster(p_cards text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_last timestamptz;
  v_cooldown interval := interval '10 minutes';
  v_next timestamptz;
  v_card text;
  v_new text[] := '{}';
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_cards is null
     or array_length(p_cards, 1) is null
     or array_length(p_cards, 1) > 5 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  -- Verrouille la ligne du profil : deux clics simultanés ne peuvent pas
  -- ouvrir deux boosters.
  select last_booster_at
    into v_last
    from public.profiles
   where id = v_uid
     for update;

  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  if v_last is not null and v_last + v_cooldown > now() then
    return jsonb_build_object('ok', false, 'next_booster_at', v_last + v_cooldown);
  end if;

  foreach v_card in array p_cards loop
    if not exists (
      select 1 from public.collection
       where user_id = v_uid and card_id = v_card
    ) then
      v_new := array_append(v_new, v_card);
    end if;

    insert into public.collection as c (user_id, card_id, quantity)
    values (v_uid, v_card, 1)
    on conflict (user_id, card_id)
      do update set quantity = c.quantity + 1;
  end loop;

  update public.profiles
     set last_booster_at = now(),
         boosters_opened = boosters_opened + 1
   where id = v_uid
  returning last_booster_at + v_cooldown into v_next;

  return jsonb_build_object(
    'ok', true,
    'next_booster_at', v_next,
    'new_cards', to_jsonb(v_new)
  );
end;
$$;

revoke all on function public.open_booster(text[]) from public;
revoke all on function public.open_booster(text[]) from anon;
grant execute on function public.open_booster(text[]) to authenticated;
